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
