# StreamableHTTP 模式使用指南

## 快速开始

### 1. 启动服务

```bash
cd /Users/pro/Desktop/storage-mcp/cos-mcp
npm run start:http
```

服务将在 `http://localhost:3001/mcp` 启动

### 2. 配置 MCP 客户端

在你的 MCP 客户端配置文件中添加：

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

### 3. 测试连接

使用 MCP Inspector 测试：

```bash
npm run inspect
```

## 为什么选择 StreamableHTTP？

### 优势

1. **更稳定** - 避免了 SSE 的 stream 读取问题
2. **无状态** - 不需要维护 session 映射
3. **灵活** - 支持 GET (SSE) 和 POST (直接响应) 两种模式
4. **官方推荐** - MCP SDK 1.9.0+ 推荐的新协议

### 与 SSE 模式对比

| 特性 | StreamableHTTP | SSE |
|------|---------------|-----|
| 稳定性 | ✅ 高 | ⚠️ 中（需修复） |
| 状态管理 | ✅ 无状态 | ❌ 需要 session |
| 流式支持 | ✅ 支持 | ✅ 支持 |
| 直接响应 | ✅ 支持 | ❌ 不支持 |
| 配置复杂度 | ✅ 简单 | ⚠️ 中等 |

## 可用工具

所有 COS 和数据万象（CI）工具都可用：

### COS 基础功能
- `getCosConfig` - 获取配置信息
- `putObject` - 上传文件
- `putString` - 上传字符串
- `putBase64` - 上传 Base64 内容
- `putBuffer` - 上传 Buffer
- `putObjectSourceUrl` - 从 URL 下载并上传
- `getObject` - 下载文件
- `getObjectUrl` - 获取签名 URL
- `getBucket` - 列出文件

### CI 图片处理
- `imageInfo` - 获取图片信息
- `assessQuality` - 图片质量评估
- `aiSuperResolution` - 超分辨率
- `aiPicMatting` - 智能抠图
- `aiQrcode` - 二维码识别
- `waterMarkFont` - 文字水印

### CI 媒体处理
- `createMediaSmartCoverJob` - 智能封面
- `describeMediaJob` - 查询任务结果

### CI 文档处理
- `createDocToPdfJob` - 文档转 PDF
- `describeDocProcessJob` - 查询转换结果

## 测试上传

```bash
# 使用便捷脚本上传
node upload-file.js /path/to/file.txt

# 指定 COS 路径
node upload-file.js /path/to/file.txt remote/path/file.txt
```

## 故障排除

### 端口被占用

```bash
# 查找占用端口的进程
lsof -i :3001

# 杀掉进程
kill <PID>
```

### 服务无响应

```bash
# 查看日志
tail -f /tmp/cos-mcp-http.log

# 重启服务
pkill -f "node.*dist/index.js"
npm run start:http
```

### 超时问题

StreamableHTTP 模式不应该出现超时问题。如果出现：

1. 检查服务是否正在运行
2. 检查防火墙设置
3. 验证 .env 配置是否正确
4. 查看服务日志了解详细错误

## 环境变量

确保 `.env` 文件包含：

```env
Region=ap-singapore
Bucket=your-bucket-name
SecretId=your-secret-id
SecretKey=your-secret-key
DatasetName=  # 可选
```

## 进阶配置

### 修改端口

```bash
node dist/index.js --connectType=streamablehttp --port=3002
```

### 启用状态管理

编辑 `src/server.ts`，修改 `startWithStreamableHTTP`：

```typescript
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(), // 启用状态管理
});
```

### 自定义路径

修改路由：

```typescript
app.get('/custom-path', handleMcp);
app.post('/custom-path', handleMcp);
```

## 相关资源

- [MCP SDK 文档](https://github.com/modelcontextprotocol/sdk)
- [腾讯云 COS 文档](https://cloud.tencent.com/document/product/436)
- [项目 GitHub](https://github.com/your-repo/cos-mcp)

## 已知问题

- ✅ SSE 模式的 stream 读取问题已修复
- ✅ StreamableHTTP 模式稳定运行
- ✅ 大文件上传支持（最大 100MB）

## 更新日志

### v1.0.13+
- ✨ 新增 StreamableHTTP 协议支持
- 🐛 修复 SSE 模式的 stream 读取问题
- 📝 完善文档和使用指南
- 🔧 优化文件上传逻辑
