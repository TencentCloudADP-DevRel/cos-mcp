# COS-MCP VPS 部署指南

本指南提供多种方式将 COS-MCP 服务部署到 VPS 服务器。

## 前置准备

### 1. VPS 基本要求

- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **内存**: 至少 512MB (推荐 1GB+)
- **存储**: 至少 2GB 可用空间
- **网络**: 需要开放端口 3001 (或自定义端口)

### 2. 必需软件

根据部署方式选择:

- **Docker 方式**: Docker + Docker Compose
- **PM2 方式**: Node.js 18+ + npm + PM2
- **Systemd 方式**: Node.js 18+ + npm

### 3. 配置文件

创建 `.env` 文件 (从 `.env.example` 复制):

```bash
cp .env.example .env
```

编辑 `.env` 填入你的腾讯云配置:

```env
Region=ap-singapore
Bucket=your-bucket-name
SecretId=your-secret-id
SecretKey=your-secret-key
DatasetName=
```

---

## 部署方式

### 方式一: Docker 部署 (推荐) 🐳

**优势**: 隔离环境、易于管理、一键部署

#### 1. 安装 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 添加当前用户到 docker 组 (避免使用 sudo)
sudo usermod -aG docker $USER
# 注销后重新登录生效
```

#### 2. 部署服务

```bash
# 克隆项目到 VPS
git clone <your-repo-url> cos-mcp
cd cos-mcp

# 配置环境变量
cp .env.example .env
nano .env  # 编辑填入配置

# 给部署脚本执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh docker
```

#### 3. 管理命令

```bash
# 查看容器状态
docker ps

# 查看日志
docker logs -f cos-mcp-server

# 停止服务
docker stop cos-mcp-server

# 启动服务
docker start cos-mcp-server

# 重启服务
docker restart cos-mcp-server

# 删除容器
docker rm -f cos-mcp-server
```

---

### 方式二: Docker Compose 部署 🚀

**优势**: 更强大的配置管理、支持多服务编排

#### 1. 安装 Docker Compose

```bash
# Docker Compose V2 (推荐)
sudo apt-get update
sudo apt-get install docker-compose-plugin

# 验证安装
docker compose version
```

#### 2. 部署服务

```bash
cd cos-mcp

# 配置环境变量
cp .env.example .env
nano .env

# 一键部署
./deploy.sh docker-compose

# 或手动执行
docker compose up -d --build
```

#### 3. 管理命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 更新服务
docker compose up -d --build
```

---

### 方式三: PM2 部署 ⚡

**优势**: 轻量级、进程守护、支持集群模式

#### 1. 安装 Node.js

```bash
# 使用 NVM 安装 (推荐)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# 或使用 NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. 部署服务

```bash
cd cos-mcp

# 配置环境变量
cp .env.example .env
nano .env

# 执行部署
./deploy.sh pm2
```

#### 3. 管理命令

```bash
# 查看进程状态
pm2 status

# 查看日志
pm2 logs cos-mcp-streamablehttp

# 重启服务
pm2 restart cos-mcp-streamablehttp

# 停止服务
pm2 stop cos-mcp-streamablehttp

# 删除进程
pm2 delete cos-mcp-streamablehttp

# 查看监控
pm2 monit
```

---

### 方式四: Systemd 部署 🔧

**优势**: 系统原生、开机自启、适合生产环境

#### 1. 安装 Node.js

```bash
# 同 PM2 方式
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. 部署服务

```bash
cd cos-mcp

# 配置环境变量
cp .env.example .env
nano .env

# 执行部署 (需要 sudo 权限)
./deploy.sh systemd
```

#### 3. 管理命令

```bash
# 查看服务状态
sudo systemctl status cos-mcp

# 启动服务
sudo systemctl start cos-mcp

# 停止服务
sudo systemctl stop cos-mcp

# 重启服务
sudo systemctl restart cos-mcp

# 查看日志
sudo journalctl -u cos-mcp -f

# 禁用自启动
sudo systemctl disable cos-mcp
```

---

## 配置反向代理 (可选)

### 使用 Nginx

#### 1. 安装 Nginx

```bash
sudo apt-get update
sudo apt-get install nginx
```

#### 2. 配置虚拟主机

```bash
sudo nano /etc/nginx/sites-available/cos-mcp
```

添加以下配置:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    # MCP 服务
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 支持大文件上传
        client_max_body_size 100M;
        
        # SSE 支持
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
```

#### 3. 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/cos-mcp /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

#### 4. 配置 HTTPS (推荐)

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 自动配置 SSL
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 防火墙配置

### Ubuntu (UFW)

```bash
# 开放端口
sudo ufw allow 3001/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### CentOS (firewalld)

```bash
# 开放端口
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp

# 重载配置
sudo firewall-cmd --reload

# 查看状态
sudo firewall-cmd --list-all
```

---

## 健康检查

### 添加健康检查端点

在 `src/server.ts` 中添加:

```typescript
// 在 startWithStreamableHTTP 或 startWithSSE 函数中
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### 测试健康检查

```bash
curl http://localhost:3001/health
```

---

## 监控和日志

### 1. 查看系统资源

```bash
# CPU 和内存使用
top
htop

# Docker 容器资源
docker stats cos-mcp-server
```

### 2. 日志轮转

#### Docker

```yaml
# docker-compose.yml 中已配置
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

#### PM2

```bash
# PM2 自动管理日志文件
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

#### Systemd

```bash
# Journalctl 自动管理
sudo journalctl --vacuum-size=100M
sudo journalctl --vacuum-time=7d
```

---

## 性能优化

### 1. Node.js 配置

```bash
# 增加内存限制
NODE_OPTIONS="--max-old-space-size=2048" node dist/index.js
```

### 2. Nginx 优化

```nginx
# 连接优化
keepalive_timeout 65;
client_body_timeout 300s;
client_header_timeout 300s;

# 缓存配置
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=mcp_cache:10m;
proxy_cache mcp_cache;
```

### 3. 系统优化

```bash
# 增加文件句柄限制
echo "* soft nofile 65535" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65535" | sudo tee -a /etc/security/limits.conf
```

---

## 故障排查

### 1. 检查端口占用

```bash
sudo netstat -tulpn | grep 3001
sudo lsof -i :3001
```

### 2. 检查服务状态

```bash
# Docker
docker ps -a
docker logs cos-mcp-server

# PM2
pm2 status
pm2 logs cos-mcp-streamablehttp --lines 100

# Systemd
sudo systemctl status cos-mcp
sudo journalctl -u cos-mcp -n 100
```

### 3. 常见问题

#### 端口被占用

```bash
# 查找占用进程
sudo lsof -i :3001
# 杀死进程
sudo kill -9 <PID>
```

#### 内存不足

```bash
# 查看内存使用
free -h
# 清理缓存
sudo sync && echo 3 | sudo tee /proc/sys/vm/drop_caches
```

#### 权限问题

```bash
# 修复文件权限
sudo chown -R $USER:$USER /path/to/cos-mcp
chmod +x deploy.sh
```

---

## 更新部署

### Docker

```bash
cd cos-mcp
git pull
docker-compose down
docker-compose up -d --build
```

### PM2

```bash
cd cos-mcp
git pull
npm ci --production
npm run build
pm2 restart cos-mcp-streamablehttp
```

### Systemd

```bash
cd cos-mcp
git pull
npm ci --production
npm run build
sudo systemctl restart cos-mcp
```

---

## 安全建议

1. **使用 HTTPS**: 通过 Nginx + Let's Encrypt 配置 SSL
2. **限制访问**: 使用防火墙限制 IP 访问
3. **环境变量**: 不要将 `.env` 文件提交到 Git
4. **定期更新**: 保持依赖包最新版本
5. **备份配置**: 定期备份 `.env` 和数据

---

## 客户端配置

部署完成后,在客户端配置 MCP 服务器:

```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "https://your-domain.com/mcp",
      "transport": "streamablehttp"
    }
  }
}
```

或使用 IP 地址:

```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "http://your-vps-ip:3001/mcp",
      "transport": "streamablehttp"
    }
  }
}
```

---

## 支持

如遇问题,请查看:
- 项目 Issues
- MCP-FIX-NOTES.md
- 服务日志文件
