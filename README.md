中文 | [English](README.en.md)

# 腾讯云 COS MCP Server 🚀🚀🚀
 ![](https://badge.mcpx.dev?type=server 'MCP Server') [![npm Version](https://img.shields.io/npm/v/cos-mcp)](https://www.npmjs.com/package/cos-mcp) [![license](http://img.shields.io/badge/license-BSD3-brightgreen.svg?style=flat)](License.txt)

<p align="center">
  <img alt="logo" src="https://raw.githubusercontent.com/Tencent/cos-mcp/master/src/img/logo.png"/>
</p>

基于 MCP 协议的腾讯云 COS MCP Server，无需编码即可让大模型快速接入腾讯云存储 (COS) 和数据万象 (CI) 能力。

---

## ✨ 核心功能

### 云端存储能力
- ⬆️ 文件上传到云端
- ⬇️ 文件从云端下载
- 📋 获取云端文件列表

### 云端处理能力
- 🖼️ 获取图片信息
- 🔍 图片超分辨率
- ✂️ 图片裁剪
- 📲 二维码识别
- 🏆 图片质量评估
- 🅰️ 文字水印
- 🎬 元数据/自然语言检索 (MateInsight)
- 📄 文档转 PDF
- 🎥 视频封面

---

## 💡 典型应用场景

- 使用其他 MCP 能力获取的文本/图片/视频/音频等数据，可直接上传到 COS 云端存储。
- 本地数据快速通过大模型转存到 COS 云端存储/备份。
- 通过大模型实现自动化：将网页里的视频/图片/音频/文本等数据批量转存到 COS 云端存储。
- 自动化将视频/图片/音频/文本等数据在云端处理，并转存到 COS 云端存储。

---

## 🌟 功能示例

1. 上传文件到 COS  
   ![eg1](https://raw.githubusercontent.com/Tencent/cos-mcp/master/src/img/eg1.png)
2. 图片质量评估  
   ![eg3](https://raw.githubusercontent.com/Tencent/cos-mcp/master/src/img/eg3.png)
3. 自然语言检索图片  
   ![eg2](https://raw.githubusercontent.com/Tencent/cos-mcp/master/src/img/eg2.png)
4. 视频截帧  
   ![eg15](https://raw.githubusercontent.com/Tencent/cos-mcp/master/src/img/eg15.png)

---

# 🔧 安装使用

## 参数说明

为了保护您的数据私密性，请准备以下参数：

### 1. **SecretId / SecretKey**
- **说明**: 腾讯云 COS 的密钥，用于身份认证，请妥善保管，切勿泄露。
- **获取方式**: 
  1. 访问 [腾讯云密钥管理](https://console.cloud.tencent.com/cam/capi)。
  2. 新建密钥并复制生成的 **SecretId** 和 **SecretKey**。

### 2. **Bucket**
- **示例**: `mybucket-123456`
- **说明**: 存储桶名称，用于存放数据，相当于您的个人存储空间。
- **获取方式**: 
  1. 访问 [存储桶列表](https://console.cloud.tencent.com/cos/bucket)。
  2. 复制存储桶名称。如果没有存储桶，可点击"创建存储桶"，一般选择默认配置即可快速完成创建。

### 3. **Region**
- **示例**: `ap-beijing`
- **说明**: 存储桶所在的地域。
- **获取方式**: 
  1. 在 [存储桶列表](https://console.cloud.tencent.com/cos/bucket) 中找到存储桶。
  2. 在存储桶名称一行查看所属地域并复制，例如：`ap-beijing`。

### 4. **DatasetName**
- **说明**: 非必填参数，数据智能检索操作需要此参数。
- **获取方式**: 
  1. 访问 [数据集管理](https://console.cloud.tencent.com/cos/metaInsight/dataManage)。
  2. 创建数据集并等待索引建立完成后，复制数据集名称。

### 5. **connectType**
- **说明**: 非必填参数，指定连接方式，可选值为 `stdio`（本地）、`sse`（远程）或 `streamablehttp`（远程，推荐）。
- **默认值**: `stdio`

### 6. **port**
- **说明**: 非必填参数，当连接方式为 `sse` 或 `streamablehttp` 时，可自由设置端口。
- **默认值**: `3001`

---

## 配置方式

COS MCP Server 支持两种配置方式：

### 方式一：客户端配置（推荐）⭐

通过 MCP 客户端的 `headers` 传递配置，**无需在服务端配置敏感信息**，更安全灵活。

**适用场景**：
- 多用户共享同一个 MCP 服务
- 不同项目使用不同的 COS 配置
- 不想在服务端暴露敏感凭证

**配置示例（Cursor）**：

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

**支持的 Headers**：
- `cos-secret-id`: SecretId（必填）
- `cos-secret-key`: SecretKey（必填）
- `cos-region`: Region（必填）
- `cos-bucket`: Bucket（必填）
- `cos-dataset-name`: DatasetName（可选，仅数据智能检索时需要）

### 方式二：服务端配置

通过命令行参数或 `.env` 文件在服务端配置，适合个人使用或本地开发。

**适用场景**：
- 个人使用
- 本地开发调试
- 固定的 COS 配置

---

## 从 npx 启动

在大模型内使用时（例如: cursor），需要在 `mcp.json` 中配置：

### 使用服务端配置（命令行参数）

```json
{
  "mcpServers": {
    "cos-mcp": {
      "command": "npx",
      "args": [
        "cos-mcp",
        "--Region=yourRegion",
        "--Bucket=yourBucket",
        "--SecretId=yourSecretId",
        "--SecretKey=yourSecretKey",
        "--DatasetName=yourDatasetname"
      ]
    }
  }
}
```

也可以通过 JSON 配置：

```json
{
  "mcpServers": {
    "cos-mcp": {
      "command": "npx",
      "args": [
        "cos-mcp",
        "--cos-config='{\"Region\":\"yourRegion\",\"Bucket\":\"yourBucket\",\"SecretId\":\"yourSecretId\",\"SecretKey\":\"yourSecretKey\",\"DatasetName\":\"yourDatasetname\"}'"
      ]
    }
  }
}
```

### 使用客户端配置（Headers，推荐）

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

---

## 使用 npm 安装

```bash
# 安装
npm install -g cos-mcp@latest

# 方式一：使用服务端配置启动
cos-mcp --Region=yourRegion --Bucket=yourBucket --SecretId=yourSecretId --SecretKey=yourSecretKey --DatasetName=yourDatasetname --port=3001 --connectType=streamablehttp

# 方式二：使用客户端配置启动（服务端不配置敏感信息）
cos-mcp --port=3001 --connectType=streamablehttp
```

在大模型内使用时（例如: cursor），需要在 `mcp.json` 中配置：

```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "http://localhost:3001/mcp",
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

---

## 使用源码安装

### 步骤 1: 克隆项目代码

```bash
git clone https://github.com/Tencent/cos-mcp.git
cd cos-mcp
```

### 步骤 2: 安装依赖

```bash
npm install
```

### 步骤 3: 启动服务

#### 3.1 配置本地环境变量（可选）

如果想使用服务端配置，创建 `.env` 文件：

```env
Region='yourRegion'
Bucket='yourBucket'
SecretId='yourSecretId'
SecretKey='yourSecretKey'
DatasetName="yourDatasetName"
```

如果使用客户端配置（Headers），则无需配置 `.env` 文件。

#### 3.2 本地 StreamableHTTP 模式启动（推荐）

```bash
npm run start:streamablehttp
```

#### 3.3 本地 SSE 模式启动

```bash
npm run start:sse
```

#### 3.4 本地构建后使用 STDIO 模式

```bash
npm run build
```

构建产物位于 `dist/index.js`。

---

### 步骤 4: 在大模型内使用

#### StreamableHTTP 模式配置（推荐）

```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "http://localhost:3001/mcp",
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

#### SSE 模式配置

```json
{
  "mcpServers": {
    "cos-mcp": {
      "url": "http://localhost:3001/sse",
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

#### STDIO 模式配置

```json
{
  "mcpServers": {
    "cos-mcp": {
      "command": "node",
      "args": [
        "${your work space}/dist/index.js",
        "--Region=yourRegion",
        "--Bucket=yourBucket",
        "--SecretId=yourSecretId",
        "--SecretKey=yourSecretKey"
      ]
    }
  }
}
```

完成以上步骤后，即可通过源码运行 COS MCP Server。

---

## ⚠️ 注意事项

1. **推荐使用客户端配置（Headers）方式**：更安全，支持多用户、多项目场景。
2. 如果安装了旧版本的包，可以将上述内容内 `cos-mcp` 改为 `cos-mcp@latest` 安装最新版包。
3. 如果全局安装后直接使用 `cos-mcp` 不行，可能是全局变量有问题，可以使用拆分变量或 `npx` 的方式启动：
   ```bash
   npm install -g cos-mcp@latest
   cos-mcp --cos-config=xxx --port=3001 --connectType=streamablehttp
   ```
   上述命令效果等同于：
   ```bash
   npx cos-mcp@latest --cos-config=xxx --port=3001 --connectType=streamablehttp
   ```
4. 如果出现解析问题，可能是终端对双引号敏感，可以将配置参数改为以下格式再尝试：
   ```bash
   --cos-config='{\"Region\":\"yourRegion\",\"Bucket\":\"BucketName-APPID\",\"SecretId\":\"yourSecretId\",\"SecretKey\":\"yourSecretKey\",\"DatasetName\":\"datasetName\"}' --port=3001 --connectType=streamablehttp
   ```
5. **配置优先级**：客户端 Headers 配置 > 服务端命令行参数 > 服务端 .env 文件

