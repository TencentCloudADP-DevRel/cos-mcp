# 客户端配置示例

## 概述

COS MCP Server 支持两种配置方式：
1. **客户端配置（推荐）**：通过 HTTP Headers 传递配置
2. **服务端配置**：通过 `.env` 文件或命令行参数配置

本文档重点介绍**客户端配置方式**。

---

## 为什么推荐客户端配置？

### 优势

✅ **安全性更高**
- 敏感凭证仅在客户端配置
- 服务端无需存储任何密钥信息
- 避免凭证泄露风险

✅ **多用户支持**
- 同一个 MCP 服务支持多个用户
- 每个用户使用自己的 COS 配置
- 无需为每个用户部署独立服务

✅ **灵活切换**
- 不同项目使用不同的 Bucket
- 快速切换测试/生产环境
- 无需重启服务

✅ **部署简单**
- VPS 上只需启动一次服务
- 无需配置复杂的环境变量
- 减少运维成本

---

## 配置方式对比

| 特性 | 客户端配置 (Headers) | 服务端配置 (.env) |
|------|---------------------|------------------|
| 安全性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 多用户支持 | ✅ | ❌ |
| 灵活性 | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| 部署复杂度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 适用场景 | VPS 共享、企业多项目 | 个人本地开发 |

---

## 客户端配置步骤

### 步骤 1: 启动 MCP 服务（服务端）

**方式一：使用 npm 全局安装**

```bash
# 安装
npm install -g cos-mcp@latest

# 启动服务（无需配置任何 COS 凭证）
cos-mcp --port=3005 --connectType=streamablehttp
```

**方式二：使用源码**

```bash
# 克隆项目
git clone https://github.com/Tencent/cos-mcp.git
cd cos-mcp

# 安装依赖
npm install

# 启动服务（无需 .env 文件）
npm run start:http
```

**方式三：使用 Docker（推荐生产环境）**

```bash
# 构建镜像
docker build -t cos-mcp .

# 运行容器
docker run -d -p 3005:3001 --name cos-mcp cos-mcp
```

### 步骤 2: 配置客户端 (Cursor)

在 Cursor 的 MCP 配置文件中添加：

**配置文件路径：**
- macOS: `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- Windows: `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
- Linux: `~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

**配置内容：**

```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "http://localhost:3005/mcp",
      "transport": "streamablehttp",
      "headers": {
        "cos-secret-id": "你的SecretId",
        "cos-secret-key": "你的SecretKey",
        "cos-region": "ap-guangzhou",
        "cos-bucket": "your-bucket-1234567890",
        "cos-dataset-name": "your-dataset"
      }
    }
  }
}
```

**如果是远程 VPS 服务：**

```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "https://your-domain.com/mcp",
      "transport": "streamablehttp",
      "headers": {
        "cos-secret-id": "你的SecretId",
        "cos-secret-key": "你的SecretKey",
        "cos-region": "ap-guangzhou",
        "cos-bucket": "your-bucket-1234567890"
      }
    }
  }
}
```

### 步骤 3: 重启 Cursor

配置完成后，重启 Cursor 使配置生效。

---

## 配置参数说明

### 必填参数

| Header 名称 | 参数说明 | 示例值 |
|------------|---------|--------|
| `cos-secret-id` | 腾讯云 SecretId | `AKIDxxxxx` |
| `cos-secret-key` | 腾讯云 SecretKey | `xxxxx` |
| `cos-region` | 存储桶地域 | `ap-guangzhou` |
| `cos-bucket` | 存储桶名称 | `mybucket-1234567890` |

### 可选参数

| Header 名称 | 参数说明 | 示例值 |
|------------|---------|--------|
| `cos-dataset-name` | 数据集名称（用于智能检索） | `my-dataset` |

### 获取配置参数

#### 1. 获取 SecretId 和 SecretKey

访问：[腾讯云密钥管理](https://console.cloud.tencent.com/cam/capi)

1. 点击"新建密钥"
2. 复制生成的 **SecretId** 和 **SecretKey**
3. ⚠️ 请妥善保管，切勿泄露

#### 2. 获取 Bucket 和 Region

访问：[存储桶列表](https://console.cloud.tencent.com/cos/bucket)

1. 选择或创建存储桶
2. 复制存储桶名称（例如：`mybucket-1234567890`）
3. 查看所属地域（例如：`ap-guangzhou`）

#### 3. 获取 DatasetName（可选）

访问：[数据集管理](https://console.cloud.tencent.com/cos/metaInsight/dataManage)

1. 创建数据集
2. 等待索引建立完成
3. 复制数据集名称

---

## VPS 部署完整示例

### 场景：在 VPS 上部署供团队使用

#### 服务端配置

```bash
# 1. 安装 Node.js (18.x+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 安装 COS MCP
sudo npm install -g cos-mcp@latest

# 3. 使用 PM2 启动服务
sudo npm install -g pm2
pm2 start cos-mcp --name cos-mcp -- --port=3005 --connectType=streamablehttp
pm2 save
pm2 startup
```

#### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /mcp {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # 转发 COS 配置 headers
        proxy_pass_request_headers on;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### 配置 SSL（可选但推荐）

```bash
# 使用 Let's Encrypt 免费证书
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### 团队成员客户端配置

```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "https://your-domain.com/mcp",
      "transport": "streamablehttp",
      "headers": {
        "cos-secret-id": "成员自己的SecretId",
        "cos-secret-key": "成员自己的SecretKey",
        "cos-region": "ap-guangzhou",
        "cos-bucket": "成员自己的Bucket"
      }
    }
  }
}
```

---

## 多项目配置示例

### 场景：同时使用多个 COS 配置

```json
{
  "mcpServers": {
    "cos-mcp-project-a": {
      "url": "https://your-domain.com/mcp",
      "transport": "streamablehttp",
      "headers": {
        "cos-secret-id": "项目A的SecretId",
        "cos-secret-key": "项目A的SecretKey",
        "cos-region": "ap-guangzhou",
        "cos-bucket": "project-a-bucket-1234567890"
      }
    },
    "cos-mcp-project-b": {
      "url": "https://your-domain.com/mcp",
      "transport": "streamablehttp",
      "headers": {
        "cos-secret-id": "项目B的SecretId",
        "cos-secret-key": "项目B的SecretKey",
        "cos-region": "ap-beijing",
        "cos-bucket": "project-b-bucket-0987654321"
      }
    }
  }
}
```

这样可以在 Cursor 中同时使用两个不同的 COS 配置。

---

## 配置优先级

```
客户端 Headers 配置 > 服务端命令行参数 > 服务端 .env 文件
```

**示例：**

1. 如果客户端 headers 中配置了 `cos-region`，则使用 headers 中的值
2. 如果 headers 中没有，则使用服务端启动时的命令行参数
3. 如果命令行参数也没有，则使用服务端的 `.env` 文件
4. 如果都没有，则报错提示配置缺失

---

## 常见问题

### Q1: 客户端配置不生效怎么办？

**排查步骤：**

1. 确认服务端已启动且可访问
2. 检查 headers 名称是否正确（必须是 `cos-` 前缀）
3. 检查 URL 是否正确（必须包含 `/mcp` 路径）
4. 重启 Cursor 使配置生效
5. 查看服务端日志确认是否收到请求

### Q2: 如何验证配置是否正确？

在 Cursor 中执行：

```
使用 getCosConfig 工具查看当前配置
```

返回结果应该显示你配置的 COS 信息（SecretId/SecretKey 会被脱敏显示）。

### Q3: 可以同时使用服务端配置和客户端配置吗？

可以！客户端配置会覆盖服务端配置。

例如：
- 服务端配置了默认的 Bucket
- 客户端可以通过 headers 指定自己的 Bucket
- 最终使用客户端指定的 Bucket

### Q4: 如何保护配置文件中的敏感信息？

建议：

1. **不要将配置文件提交到 Git**
2. **使用环境变量**（如果 Cursor 支持）
3. **定期轮换密钥**
4. **使用子账号密钥**而非主账号密钥
5. **为密钥设置最小权限**（仅 COS 相关权限）

### Q5: 支持其他 MCP 客户端吗？

支持！只要客户端支持：
- StreamableHTTP 或 SSE 传输协议
- 自定义 HTTP Headers

理论上都可以使用客户端配置方式。

---

## 最佳实践建议

### 1. 使用子账号密钥

不要使用主账号的 SecretId/SecretKey，而是：

1. 在 [腾讯云访问管理](https://console.cloud.tencent.com/cam) 创建子账号
2. 为子账号分配最小权限（仅 COS 操作权限）
3. 使用子账号密钥配置

### 2. 定期轮换密钥

建议每 3-6 个月更换一次 SecretKey。

### 3. 使用 HTTPS

生产环境务必配置 SSL 证书，使用 HTTPS 传输。

### 4. 监控和日志

- 启用 COS 访问日志
- 监控异常流量
- 定期审查访问记录

### 5. 网络隔离

如果可能，使用 VPN 或内网访问 MCP 服务。

---

## 技术支持

如有问题，请通过以下方式反馈：

- GitHub Issues: https://github.com/Tencent/cos-mcp/issues
- 文档：https://github.com/Tencent/cos-mcp

---

**更新时间**: 2025-12-09
