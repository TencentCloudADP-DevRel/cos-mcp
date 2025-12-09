# COS-MCP 升级说明

## 版本：v1.0.14

### 🎯 重大更新：支持客户端动态配置

---

## 📋 更新内容

### 1. 新增客户端配置方式（Headers）

通过 HTTP Headers 传递 COS 配置，实现客户端动态配置，无需在服务端存储敏感信息。

**支持的 Headers：**
- `cos-secret-id` - SecretId（必填）
- `cos-secret-key` - SecretKey（必填）
- `cos-region` - Region（必填）
- `cos-bucket` - Bucket（必填）
- `cos-dataset-name` - DatasetName（可选）

### 2. 架构改进

- ✅ 新增 `ExtendedRequestContext` 接口定义请求上下文
- ✅ 新增 `extractCosConfigFromHeaders()` 函数提取 Headers 配置
- ✅ 新增 `mergeCosConfig()` 函数合并配置
- ✅ 新增 `createCosInstances()` 函数动态创建实例
- ✅ 重构所有工具函数支持请求上下文

### 3. 向后兼容

- ✅ 保留原有的服务端配置方式（.env 文件 + 命令行参数）
- ✅ 配置优先级：客户端 Headers > 命令行参数 > .env 文件
- ✅ 旧版配置方式完全兼容，无需修改

---

## 🚀 使用方式

### 方式一：客户端配置（推荐）⭐

**服务端启动（无需配置敏感信息）：**

```bash
# 全局安装
npm install -g cos-mcp@latest

# 启动服务
cos-mcp --port=3005 --connectType=streamablehttp
```

**客户端配置（Cursor）：**

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
        "cos-bucket": "your-bucket-1234567890"
      }
    }
  }
}
```

### 方式二：服务端配置（传统方式）

**启动服务：**

```bash
cos-mcp \
  --Region=ap-guangzhou \
  --Bucket=your-bucket-1234567890 \
  --SecretId=你的SecretId \
  --SecretKey=你的SecretKey \
  --port=3005 \
  --connectType=streamablehttp
```

**客户端配置（Cursor）：**

```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "http://localhost:3005/mcp",
      "transport": "streamablehttp"
    }
  }
}
```

---

## 💡 使用场景

### 场景 1：个人本地开发

**推荐：服务端配置**

```bash
# 创建 .env 文件
cat > .env << EOF
Region=ap-guangzhou
Bucket=my-bucket-1234567890
SecretId=你的SecretId
SecretKey=你的SecretKey
EOF

# 启动服务
npm run start:http
```

### 场景 2：VPS 多用户共享

**推荐：客户端配置**

**服务端（只启动一次）：**
```bash
pm2 start cos-mcp --name cos-mcp -- --port=3005 --connectType=streamablehttp
```

**用户 A 配置：**
```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "https://mcp.example.com/mcp",
      "transport": "streamablehttp",
      "headers": {
        "cos-secret-id": "用户A的SecretId",
        "cos-secret-key": "用户A的SecretKey",
        "cos-region": "ap-guangzhou",
        "cos-bucket": "user-a-bucket-123"
      }
    }
  }
}
```

**用户 B 配置：**
```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "https://mcp.example.com/mcp",
      "transport": "streamablehttp",
      "headers": {
        "cos-secret-id": "用户B的SecretId",
        "cos-secret-key": "用户B的SecretKey",
        "cos-region": "ap-beijing",
        "cos-bucket": "user-b-bucket-456"
      }
    }
  }
}
```

### 场景 3：多项目切换

**同时配置多个 MCP 连接：**

```json
{
  "mcpServers": {
    "cos-mcp-project-a": {
      "url": "https://mcp.example.com/mcp",
      "transport": "streamablehttp",
      "headers": {
        "cos-secret-id": "项目A的SecretId",
        "cos-secret-key": "项目A的SecretKey",
        "cos-region": "ap-guangzhou",
        "cos-bucket": "project-a-bucket"
      }
    },
    "cos-mcp-project-b": {
      "url": "https://mcp.example.com/mcp",
      "transport": "streamablehttp",
      "headers": {
        "cos-secret-id": "项目B的SecretId",
        "cos-secret-key": "项目B的SecretKey",
        "cos-region": "ap-beijing",
        "cos-bucket": "project-b-bucket"
      }
    }
  }
}
```

---

## 🔧 技术细节

### 类型安全改进

新增 `ExtendedRequestContext` 接口：

```typescript
interface ExtendedRequestContext {
  cosConfig?: Partial<CosConfig>;
}
```

所有工具函数使用类型断言访问请求上下文：

```typescript
async ({ objectKey }, extra) => {
  const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
  const { COSInstance } = getCosInstances(requestContext);
  // ...
}
```

### 配置提取流程

```
HTTP Request
    ↓
extractCosConfigFromHeaders(headers)
    ↓
mergeCosConfig(defaultConfig, headerConfig)
    ↓
createCosInstances(mergedConfig)
    ↓
Tool Execution
```

### 配置优先级

```
1. 客户端 Headers 配置
   ↓ (如果没有)
2. 服务端命令行参数
   ↓ (如果没有)
3. 服务端 .env 文件
   ↓ (如果都没有)
报错提示配置缺失
```

---

## ⚠️ 升级注意事项

### 1. TypeScript 版本要求

建议使用 TypeScript 5.0+，确保类型断言正常工作。

### 2. 旧版兼容性

本次更新完全向后兼容，旧版配置方式无需修改。

### 3. 安全建议

使用客户端配置时：
- ✅ 不要将配置文件提交到 Git
- ✅ 使用子账号密钥而非主账号
- ✅ 为密钥设置最小权限
- ✅ 定期轮换密钥（建议 3-6 个月）
- ✅ 生产环境使用 HTTPS

### 4. VPS 部署建议

- 使用 PM2 管理进程
- 配置 Nginx 反向代理
- 启用 SSL 证书（Let's Encrypt）
- 定期检查访问日志
- 设置防火墙规则

---

## 📝 文档更新

- ✅ `README.md` - 新增客户端配置说明
- ✅ `CLIENT-CONFIG-EXAMPLE.md` - 详细配置示例和最佳实践
- ✅ `MCP-FIX-NOTES.md` - 技术实现细节
- ✅ `UPGRADE-NOTES.md` - 本升级说明（当前文档）

---

## 🐛 问题反馈

如遇到问题，请提供以下信息：

1. COS-MCP 版本
2. Node.js 版本
3. 使用的配置方式（客户端/服务端）
4. 完整错误日志
5. 配置文件（脱敏后）

**GitHub Issues**: https://github.com/Tencent/cos-mcp/issues

---

## 🎉 致谢

感谢所有使用和贡献 COS-MCP 的开发者！

---

**更新日期**: 2025-12-09  
**版本**: v1.0.14
