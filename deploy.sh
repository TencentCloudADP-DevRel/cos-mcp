#!/bin/bash

# COS-MCP VPS 部署脚本
# 使用方法: ./deploy.sh [方法] [选项]
# 方法: docker | pm2 | systemd
# 示例: ./deploy.sh docker

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_NAME="cos-mcp"
DEPLOY_METHOD=${1:-docker}
PORT=${2:-3001}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  COS-MCP VPS 部署脚本${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${RED}错误: .env 文件不存在!${NC}"
    echo -e "${YELLOW}请从 .env.example 创建 .env 文件并填入配置${NC}"
    exit 1
fi

# 检查 Node.js 版本
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            echo -e "${RED}Node.js 版本过低 (需要 >= 18)${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ Node.js 版本检查通过: $(node -v)${NC}"
    else
        echo -e "${RED}错误: 未安装 Node.js${NC}"
        exit 1
    fi
}

# Docker 部署
deploy_docker() {
    echo -e "${YELLOW}使用 Docker 部署...${NC}"
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}错误: 未安装 Docker${NC}"
        exit 1
    fi
    
    # 停止旧容器
    echo "停止旧容器..."
    docker stop cos-mcp-server 2>/dev/null || true
    docker rm cos-mcp-server 2>/dev/null || true
    
    # 构建镜像
    echo "构建 Docker 镜像..."
    docker build -t cos-mcp:latest .
    
    # 启动容器
    echo "启动容器..."
    docker run -d \
        --name cos-mcp-server \
        --restart unless-stopped \
        -p ${PORT}:3001 \
        --env-file .env \
        cos-mcp:latest
    
    echo -e "${GREEN}✓ Docker 部署完成!${NC}"
    echo -e "${GREEN}容器名称: cos-mcp-server${NC}"
    echo -e "${GREEN}访问地址: http://localhost:${PORT}/mcp${NC}"
    echo ""
    echo "查看日志: docker logs -f cos-mcp-server"
    echo "停止服务: docker stop cos-mcp-server"
}

# Docker Compose 部署
deploy_docker_compose() {
    echo -e "${YELLOW}使用 Docker Compose 部署...${NC}"
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}错误: 未安装 Docker Compose${NC}"
        exit 1
    fi
    
    # 停止旧服务
    echo "停止旧服务..."
    docker-compose down 2>/dev/null || docker compose down 2>/dev/null || true
    
    # 启动服务
    echo "启动服务..."
    docker-compose up -d --build || docker compose up -d --build
    
    echo -e "${GREEN}✓ Docker Compose 部署完成!${NC}"
    echo -e "${GREEN}访问地址: http://localhost:${PORT}/mcp${NC}"
    echo ""
    echo "查看日志: docker-compose logs -f"
    echo "停止服务: docker-compose down"
}

# PM2 部署
deploy_pm2() {
    echo -e "${YELLOW}使用 PM2 部署...${NC}"
    
    check_node
    
    # 检查 PM2
    if ! command -v pm2 &> /dev/null; then
        echo "安装 PM2..."
        npm install -g pm2
    fi
    
    # 安装依赖
    echo "安装依赖..."
    npm ci --production
    
    # 构建项目
    echo "构建项目..."
    npm run build
    
    # 创建日志目录
    mkdir -p logs
    
    # 停止旧进程
    echo "停止旧进程..."
    pm2 delete cos-mcp-streamablehttp 2>/dev/null || true
    
    # 启动服务
    echo "启动服务..."
    pm2 start ecosystem.config.cjs --only cos-mcp-streamablehttp
    
    # 保存 PM2 配置
    pm2 save
    
    # 设置开机自启
    pm2 startup
    
    echo -e "${GREEN}✓ PM2 部署完成!${NC}"
    echo -e "${GREEN}访问地址: http://localhost:${PORT}/mcp${NC}"
    echo ""
    echo "查看状态: pm2 status"
    echo "查看日志: pm2 logs cos-mcp-streamablehttp"
    echo "重启服务: pm2 restart cos-mcp-streamablehttp"
}

# Systemd 部署
deploy_systemd() {
    echo -e "${YELLOW}使用 Systemd 部署...${NC}"
    
    check_node
    
    # 获取当前用户和工作目录
    CURRENT_USER=$(whoami)
    WORK_DIR=$(pwd)
    NODE_PATH=$(which node)
    
    # 安装依赖
    echo "安装依赖..."
    npm ci --production
    
    # 构建项目
    echo "构建项目..."
    npm run build
    
    # 创建 systemd service 文件
    SERVICE_FILE="/etc/systemd/system/cos-mcp.service"
    
    echo "创建 systemd service 文件..."
    sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=COS MCP Server
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$WORK_DIR
Environment=NODE_ENV=production
EnvironmentFile=$WORK_DIR/.env
ExecStart=$NODE_PATH $WORK_DIR/dist/index.js --connectType=streamablehttp
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cos-mcp

[Install]
WantedBy=multi-user.target
EOF
    
    # 重载 systemd
    sudo systemctl daemon-reload
    
    # 启动服务
    sudo systemctl enable cos-mcp
    sudo systemctl start cos-mcp
    
    echo -e "${GREEN}✓ Systemd 部署完成!${NC}"
    echo -e "${GREEN}访问地址: http://localhost:${PORT}/mcp${NC}"
    echo ""
    echo "查看状态: sudo systemctl status cos-mcp"
    echo "查看日志: sudo journalctl -u cos-mcp -f"
    echo "重启服务: sudo systemctl restart cos-mcp"
}

# 主逻辑
case $DEPLOY_METHOD in
    docker)
        deploy_docker
        ;;
    docker-compose)
        deploy_docker_compose
        ;;
    pm2)
        deploy_pm2
        ;;
    systemd)
        deploy_systemd
        ;;
    *)
        echo -e "${RED}错误: 不支持的部署方法: $DEPLOY_METHOD${NC}"
        echo "支持的方法: docker | docker-compose | pm2 | systemd"
        exit 1
        ;;
esac

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
