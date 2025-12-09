# COS-MCP 服务优化说明

## 问题描述

原始的 cos-mcp 服务在 SSE 模式下存在"stream is not readable"错误，导致所有工具调用失败。

### 根本原因

Express 的 `json()` 中间件会消费请求体的 stream，而 `SSEServerTransport.handlePostMessage()` 方法会尝试再次读取 stream（通过 `getRawBody` 函数），导致错误。

## 解决方案

### 1. SSE 模式修复

在 `src/server.ts` 中修改 `startWithSSE` 函数：

```typescript
app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (transport) {
    // 关键：将已解析的 body 作为第三个参数传递
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});
```

这样 `handlePostMessage` 就会使用已解析的 `req.body`，而不是尝试再次读取 stream。

### 2. StreamableHTTP 模式支持（推荐）✨

新增了 StreamableHTTP 协议支持，这是 MCP SDK 推荐的传输协议，更稳定可靠：

```typescript
export function startWithStreamableHTTP(server: McpServer, port: number = 3001) {
  const app = express();
  
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  const handleMcp = async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // 无状态模式
    });
    
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };

  app.get('/mcp', handleMcp);
  app.post('/mcp', handleMcp);
  app.delete('/mcp', handleMcp);

  app.listen(port, () => {
    Logger.log(`StreamableHTTP 模式监听端口: ${port}`);
    Logger.log(`MCP 端点: http://localhost:${port}/mcp`);
  });
}
```

**优势：**
- 更稳定的连接管理
- 支持无状态模式
- 同时支持 SSE 流和直接 HTTP 响应
- 官方推荐的新协议

### 3. 文件上传优化

修改了 `src/services/cos/cos.service.ts` 中的 `uploadFile` 方法：

- 使用 `fs.readFileSync()` + `putObject()` 替代 `uploadFile()`
- 避免了 stream 相关问题
- 同时支持大小文件上传

### 4. 请求体大小限制优化 🆕

**问题**: 默认 Express 请求体限制为 100KB,导致上传 30MB 文件时报错异常。

**解决方案**: 在 `startWithSSE` 和 `startWithStreamableHTTP` 函数中增加请求体大小限制:

```typescript
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
```

**优化说明**:
- 支持最大 100MB 的请求体
- 同时适用于 JSON 和 URL 编码格式
- 如需更大限制可调整为 `'500mb'` 或其他值

**最佳实践**:
- 对于大文件(> 30MB),推荐使用 `putObject` 工具 + 本地文件路径上传
- Base64 编码会增加 33% 大小,不适合大文件
- `putObjectSourceUrl` 适合从远程 URL 下载后上传

### 3. 临时解决方案

如果 MCP 服务仍有问题，可以使用提供的 `upload-file.js` 脚本直接上传：

```bash
# 上传文件
node upload-file.js /path/to/local/file.txt

# 指定 COS 路径
node upload-file.js /path/to/local/file.txt remote/path/file.txt
```

## 已上传文件

### 1. HTML 文件
- 本地路径: `/Users/pro/CodeBuddy/hunyuan3d/hunuyan3d.html`
- COS 路径: `hunuyan3d.html`
- 访问地址: `https://adp-1358396436.cos.ap-singapore.myqcloud.com/hunuyan3d.html`

### 2. GLB 模型文件
- 本地路径: `/Users/pro/CodeBuddy/hunyuan3d/hunyuan3d-works/40591648-e586-4cca-b6e3-ea3295d21dbf_0.glb`
- COS 路径: `40591648-e586-4cca-b6e3-ea3295d21dbf_0.glb`
- 文件大小: 29.09 MB
- 访问地址: `https://adp-1358396436.cos.ap-singapore.myqcloud.com/40591648-e586-4cca-b6e3-ea3295d21dbf_0.glb`

## 测试验证

### 大文件上传测试

经过优化后,服务已成功支持大文件上传:

- ✅ 上传 30MB GLB 模型文件成功
- ✅ 请求体大小限制: 默认 100MB (可调整)
- ✅ 支持通过 MCP 协议上传大文件
- ✅ Base64/Buffer 编码传输正常工作

**测试文件**: GLB 模型文件 (29.09 MB) 成功上传到 COS

## 使用方法

### 启动服务

```bash
cd /Users/pro/Desktop/storage-mcp/cos-mcp

# 推荐：使用 StreamableHTTP 模式（更稳定）
npm run start:http

# 或使用 SSE 模式
npm run start:sse

# 或使用 stdio 模式（默认）
npm start
```

### MCP 客户端配置

**StreamableHTTP 模式配置（推荐）：**
```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "http://localhost:3001/mcp",
      "transport": "streamablehttp"
    }
  }
}
```

**SSE 模式配置：**
```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "http://localhost:3001/sse",
      "transport": "sse"
    }
  }
}
```

### 直接上传脚本

```bash
# 基本用法
node upload-file.js <本地文件路径> [COS目标路径]

# 示例
node upload-file.js /path/to/image.jpg
node upload-file.js /path/to/video.mp4 videos/my-video.mp4
```

## 注意事项

1. 签名 URL 有效期为 15 分钟
2. 大于 5MB 的文件会自动使用分片上传
3. 支持进度显示
4. 自动检测文件是否存在

## 配置文件

确保 `.env` 文件包含以下配置：

```env
Region=ap-singapore
Bucket=adp-1358396436
SecretId=你的SecretId
SecretKey=你的SecretKey
DatasetName=
```

## 技术细节

### 支持的传输协议

1. **StreamableHTTP**（推荐）✨
   - 端口: 3001
   - 端点: `http://localhost:3001/mcp`
   - 优势: 更稳定、支持无状态模式、官方推荐
   - 启动: `npm run start:http` 或 `node dist/index.js --connectType=streamablehttp`

2. **SSE** (Server-Sent Events)
   - 端口: 3001
   - 端点: `http://localhost:3001/sse`
   - 已修复 stream 读取问题
   - 启动: `npm run start:sse` 或 `node dist/index.js --connectType=sse`

3. **stdio** (标准输入输出)
   - 用于命令行集成
   - 启动: `npm start` 或 `node dist/index.js --connectType=stdio`

### 版本信息

- MCP SDK 版本: `@modelcontextprotocol/sdk@1.24.3`
- COS SDK 版本: `cos-nodejs-sdk-v5@2.14.7`
- Node.js: v22.21.1
- 默认服务端口: 3001

---

## 5. 配置方式优化 - 支持客户端动态配置 🆕✨

### 问题背景

原先的配置方式存在以下局限性：
1. **服务端绑定配置**：必须在服务端通过 `.env` 文件或命令行参数配置 COS 凭证
2. **多用户场景困难**：多个用户共享同一个 MCP 服务时，无法使用各自的 COS 配置
3. **安全性问题**：敏感凭证需要在服务端配置和存储

### 解决方案：支持 HTTP Headers 传递配置

新增支持通过 **HTTP Headers** 动态传递 COS 配置，实现：
- ✅ **客户端配置**：每个客户端可使用自己的 COS 凭证
- ✅ **服务端无状态**：服务端无需存储任何敏感信息
- ✅ **多用户支持**：同一服务支持多个用户、多个项目
- ✅ **向后兼容**：保留原有的服务端配置方式

### 支持的 HTTP Headers

```
cos-secret-id      → SecretId（必填）
cos-secret-key     → SecretKey（必填）
cos-region         → Region（必填）
cos-bucket         → Bucket（必填）
cos-dataset-name   → DatasetName（可选）
```

### 客户端配置示例

**Cursor MCP 配置：**

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
        "cos-bucket": "your-bucket-1234567890",
        "cos-dataset-name": "your-dataset"
      }
    }
  }
}
```

### 配置优先级

```
客户端 Headers 配置 > 服务端命令行参数 > 服务端 .env 文件
```

### 技术实现

**1. 新增配置提取函数** (`src/server.ts`):

```typescript
export function extractCosConfigFromHeaders(headers: any): Partial<CosConfig> | null {
  const config: Partial<CosConfig> = {};
  
  if (headers['cos-secret-id']) config.SecretId = headers['cos-secret-id'];
  if (headers['cos-secret-key']) config.SecretKey = headers['cos-secret-key'];
  if (headers['cos-region']) config.Region = headers['cos-region'];
  if (headers['cos-bucket']) config.Bucket = headers['cos-bucket'];
  if (headers['cos-dataset-name']) config.DatasetName = headers['cos-dataset-name'];
  
  return Object.keys(config).length > 0 ? config : null;
}
```

**2. 动态创建 COS 实例**:

```typescript
export function createCosInstances(cosConfig: CosConfig) {
  const cos = new COS({
    SecretId: cosConfig.SecretId || '',
    SecretKey: cosConfig.SecretKey || '',
    UserAgent: USER_AGENT,
  });

  return {
    cos,
    COSInstance: new CosService(bucket, region, cos),
    CIPicInstance: new CIPicService(bucket, region, cos),
    // ... 其他服务实例
  };
}
```

**3. 工具函数支持请求上下文**:

```typescript
server.tool('putObject', '上传本地文件到存储桶', {...}, 
  async ({ fileName, filePath, targetDir }, extra) => {
    // 从请求上下文获取动态配置
    const { COSInstance } = getCosInstances(extra?.requestContext);
    const res = await COSInstance.uploadFile({ fileName, filePath, targetDir });
    return { content: [...], isError: !res.isSuccess };
  }
);
```

**4. StreamableHTTP 和 SSE 模式注入配置**:

```typescript
// StreamableHTTP 模式
const handleMcp = async (req: Request, res: Response) => {
  const cosConfig = extractCosConfigFromHeaders(req.headers);
  const transport = new StreamableHTTPServerTransport({...});
  
  if (cosConfig) {
    (transport as any).requestContext = { cosConfig };
  }
  
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
};
```

### 使用场景对比

| 场景 | 推荐方式 | 说明 |
|------|---------|------|
| 个人本地开发 | 服务端配置 (.env) | 简单快捷 |
| VPS 共享服务 | 客户端配置 (Headers) | 多用户安全 |
| 企业多项目 | 客户端配置 (Headers) | 灵活切换 |
| CI/CD 自动化 | 服务端配置 (命令行) | 脚本化部署 |

### 优势总结

1. **安全性提升**：敏感凭证仅在客户端配置，不经过服务端存储
2. **灵活性增强**：同一服务支持多用户、多项目、多环境
3. **部署简化**：VPS 上无需为每个用户配置 `.env` 文件
4. **向后兼容**：保留原有配置方式，平滑升级
5. **符合最佳实践**：配置与代码分离，遵循 12-Factor 原则

### 部署建议

**VPS 部署（推荐）：**

```bash
# 服务端启动（无需配置敏感信息）
cos-mcp --port=3005 --connectType=streamablehttp

# 客户端在 Cursor 配置中添加 headers
```

**本地开发：**

```bash
# 方式1：使用 .env 文件
npm run start:streamablehttp

# 方式2：使用命令行参数
cos-mcp --Region=xxx --Bucket=xxx --SecretId=xxx --SecretKey=xxx
```

### 测试验证

✅ 已测试场景：
- 客户端 Headers 配置生效
- 服务端默认配置降级
- 配置优先级正确
- 多并发请求隔离
- 所有工具函数支持动态配置
