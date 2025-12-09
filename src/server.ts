import express, { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamablehttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import COS from 'cos-nodejs-sdk-v5';
import { z } from 'zod';
import { ServerConfig, CosConfig } from './index.js';
import { CosService } from './services/cos/cos.service.js';
import { CIPicService } from './services/ci/pic.service.js';
import { CIMediaService } from './services/ci/media.service.js';
import { CIAIService } from './services/ci/ai.service.js';
import { CIMateInsightService } from './services/ci/mateInsight.service.js';
import { CIDocService } from './services/ci/doc.service.js';

/**
 * 扩展的请求上下文，包含 COS 配置
 */
interface ExtendedRequestContext {
  cosConfig?: Partial<CosConfig>;
}

export function maskSecret(secret: string): string {
  secret = String(secret);
  if (secret.length <= 4) return '****';
  return `${secret.substring(0, 4)}****${secret.slice(-4)}`;
}

/**
 * 从 HTTP Headers 中提取 COS 配置
 * 支持的 headers:
 * - cos-secret-id: SecretId
 * - cos-secret-key: SecretKey
 * - cos-region: Region
 * - cos-bucket: Bucket
 * - cos-dataset-name: DatasetName (可选)
 */
export function extractCosConfigFromHeaders(headers: any): Partial<CosConfig> | null {
  const config: Partial<CosConfig> = {};
  
  if (headers['cos-secret-id']) {
    config.SecretId = headers['cos-secret-id'];
  }
  if (headers['cos-secret-key']) {
    config.SecretKey = headers['cos-secret-key'];
  }
  if (headers['cos-region']) {
    config.Region = headers['cos-region'];
  }
  if (headers['cos-bucket']) {
    config.Bucket = headers['cos-bucket'];
  }
  if (headers['cos-dataset-name']) {
    config.DatasetName = headers['cos-dataset-name'];
  }
  
  // 如果有任何 COS 配置项，返回配置对象
  if (Object.keys(config).length > 0) {
    return config;
  }
  
  return null;
}

/**
 * 合并默认配置和 Headers 配置
 */
export function mergeCosConfig(defaultConfig: CosConfig, headerConfig: Partial<CosConfig> | null): CosConfig {
  if (!headerConfig) {
    return defaultConfig;
  }
  
  return {
    Region: headerConfig.Region || defaultConfig.Region,
    SecretId: headerConfig.SecretId || defaultConfig.SecretId,
    SecretKey: headerConfig.SecretKey || defaultConfig.SecretKey,
    Bucket: headerConfig.Bucket || defaultConfig.Bucket,
    DatasetName: headerConfig.DatasetName || defaultConfig.DatasetName,
  };
}

export const Logger = {
  log: (...args: any[]) => {
    console.log(...args);
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
};

const USER_AGENT = 'modelcontextprotocol/servers/cos';

/**
 * 创建 COS 服务实例（根据动态配置）
 */
export function createCosInstances(cosConfig: CosConfig) {
  const cos = new COS({
    SecretId: cosConfig.SecretId || '',
    SecretKey: cosConfig.SecretKey || '',
    UserAgent: USER_AGENT,
  });

  const bucket = cosConfig.Bucket;
  const region = cosConfig.Region;
  const datasetName = cosConfig.DatasetName;

  return {
    cos,
    COSInstance: new CosService(bucket, region, cos),
    CIPicInstance: new CIPicService(bucket, region, cos),
    CIMediaInstance: new CIMediaService(bucket, region, cos),
    CIAIInstance: new CIAIService(bucket, region, cos),
    CIMateInsightInstance: new CIMateInsightService(
      bucket,
      region,
      datasetName || '',
      cos,
    ),
    CIDocInstance: new CIDocService(bucket, region, cos),
  };
}

export function createCosMcpServer(config: ServerConfig) {
  // 创建默认的 COS 实例（从 .env 或命令行参数）
  const defaultInstances = createCosInstances(config.cosConfig);

  const server = new McpServer(
    {
      name: 'COS MCP Server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: { listChanged: true },
        // resources: { listChanged: true },
        // prompts: { listChanged: true },
        // logging: {},
      },
    },
  );

  /**
   * 获取当前请求的 COS 实例
   * 优先使用 request context 中的配置，否则使用默认配置
   */
  const getCosInstances = (requestContext?: ExtendedRequestContext) => {
    // 如果有请求上下文且包含自定义配置，创建新实例
    if (requestContext?.cosConfig) {
      const mergedConfig = mergeCosConfig(config.cosConfig, requestContext.cosConfig);
      return createCosInstances(mergedConfig);
    }
    // 否则使用默认实例
    return defaultInstances;
  };

  server.tool('getCosConfig', '获取COS配置, 腾讯云配置', {}, async (params, extra) => {
    const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
    const instances = getCosInstances(requestContext);
    const currentConfig = requestContext?.cosConfig 
      ? mergeCosConfig(config.cosConfig, requestContext.cosConfig)
      : config.cosConfig;
    
    const maskedConfig = {
      ...config,
      cosConfig: {
        ...currentConfig,
        SecretId: maskSecret(currentConfig.SecretId),
        SecretKey: maskSecret(currentConfig.SecretKey),
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(maskedConfig, null, 2),
        },
      ],
    };
  });

  server.tool(
    'putObject',
    '上传本地文件到存储桶',
    {
      filePath: z.string().describe('文件路径 (包含文件名)'),
      fileName: z.string().optional().describe('文件名 （存在存储桶里的名称）'),
      targetDir: z
        .string()
        .optional()
        .describe('目标目录 （存在存储桶的哪个目录）'),
    },
    async ({ fileName, filePath, targetDir }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { COSInstance } = getCosInstances(requestContext);
      const res = await COSInstance.uploadFile({
        fileName,
        filePath,
        targetDir,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );


  server.tool(
    'putString',
    '上传字符串内容到存储桶',
    {
      content: z.string().describe('要上传的字符串内容'),
      fileName: z.string().describe('文件名 (存在存储桶里的名称)'),
      targetDir: z
        .string()
        .optional()
        .describe('目标目录 (存在存储桶的哪个目录)'),
      contentType: z
        .string()
        .optional()
        .describe('内容类型，如 text/plain, application/json 等，默认为 text/plain'),
    },
    async ({ content, fileName, targetDir, contentType }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { COSInstance } = getCosInstances(requestContext);
      const res = await COSInstance.uploadString({
        content,
        fileName,
        targetDir,
        contentType,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  server.tool(
    'putBase64',
    '上传base64编码内容到存储桶',
    {
      base64Content: z.string().describe('base64编码的内容'),
      fileName: z.string().describe('文件名 (存在存储桶里的名称)'),
      targetDir: z
        .string()
        .optional()
        .describe('目标目录 (存在存储桶的哪个目录)'),
      contentType: z
        .string()
        .optional()
        .describe('内容类型，如 image/png (图片), application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document (文档) 等，如果base64带头部则默认自带的头部否则默认为 application/octet-stream'),
    },
    async ({ base64Content, fileName, targetDir, contentType }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { COSInstance } = getCosInstances(requestContext);
      const res = await COSInstance.uploadBase64({
        base64Content,
        fileName,
        targetDir,
        contentType,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  server.tool(
    'putBuffer',
    '上传buffer内容到存储桶',
    {
      content: z.string().describe('buffer内容字符串'),
      fileName: z.string().describe('文件名 (存在存储桶里的名称)'),
      targetDir: z
        .string()
        .optional()
        .describe('目标目录 (存在存储桶的哪个目录)'),
      contentType: z
        .string()
        .optional()
        .describe('内容类型，如 image/png, application/pdf 等，默认为 application/octet-stream'),
      encoding: z
        .enum(['hex', 'base64', 'utf8', 'ascii', 'binary'])
        .optional()
        .describe('字符串编码格式，默认为utf8。hex=十六进制，base64=Base64编码，utf8=UTF-8文本，ascii=ASCII文本，binary=二进制'),
    },
    async ({ content, fileName, targetDir, contentType, encoding }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { COSInstance } = getCosInstances(requestContext);
      const res = await COSInstance.uploadBuffer({
        content,
        fileName,
        targetDir,
        contentType,
        encoding,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  server.tool(
    'putObjectSourceUrl',
    '通过 url下载文件并将文件上传到存储桶',
    {
      sourceUrl: z.string().describe('可下载的文件 url'),
      fileName: z.string().optional().describe('文件名 （存在存储桶里的名称）'),
      targetDir: z
        .string()
        .optional()
        .describe('目标目录 （存在存储桶的哪个目录）'),
    },
    async ({ sourceUrl, fileName, targetDir}, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { COSInstance } = getCosInstances(requestContext);
      const res = await COSInstance.uploadFileSourceUrl({
        targetDir,
        fileName,
        sourceUrl,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );


  server.tool(
    'getObjectUrl',
    '获取存储桶内的文件的带签名的下载链接',
    {
      objectKey: z.string().describe('文件的路径'),
    },
    async ({ objectKey = '/' }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { COSInstance } = getCosInstances(requestContext);
      const res = await COSInstance.getObjectUrl(objectKey);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res.data, null, 2),
            },
          ],
          isError: !res.isSuccess,
        };
    },
  );

  
  server.tool(
    'getObject',
    '下载存储桶内的文件',
    {
      objectKey: z.string().describe('文件的路径'),
    },
    async ({ objectKey = '/' }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { COSInstance } = getCosInstances(requestContext);
      const res = await COSInstance.getObject(objectKey);
      if (!res.isSuccess) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res.data, null, 2),
            },
          ],
          isError: true
        };
      }
      return {
        content: [res.data] as any,
        isError: false,
      };
    },
  );
  server.tool(
    'getBucket',
    '查询存储桶内的文件列表',
    {
      Prefix: z.string().optional().describe('文件列表的路径前缀,默认根路径'),
    },
    async ({ Prefix = '' }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { COSInstance } = getCosInstances(requestContext);
      const res = await COSInstance.getBucket(Prefix);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  // --CI--

  server.tool(
    'imageInfo',
    '图片处理-获取图片信息',
    {
      objectKey: z.string().describe('图片在存储桶里的路径'),
    },
    async ({ objectKey }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIPicInstance } = getCosInstances(requestContext);
      const res = await CIPicInstance.imageInfo(objectKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  server.tool(
    'assessQuality',
    '图片处理-图片质量评估',
    {
      objectKey: z.string().describe('图片在存储桶里的路径'),
    },
    async ({ objectKey }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIAIInstance } = getCosInstances(requestContext);
      const res = await CIAIInstance.assessQuality(objectKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  server.tool(
    'aiSuperResolution',
    '图片处理-超分辨率',
    {
      objectKey: z.string().describe('图片在存储桶里的路径'),
    },
    async ({ objectKey }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIAIInstance } = getCosInstances(requestContext);
      const res = await CIAIInstance.aiSuperResolution(objectKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  server.tool(
    'aiPicMatting',
    '图片处理-抠图',
    {
      objectKey: z.string().describe('图片在存储桶里的路径'),
      width: z.string().optional().describe('宽度'),
      height: z.string().optional().describe('高度'),
    },
    async ({ objectKey, width = '5', height = '5' }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIAIInstance } = getCosInstances(requestContext);
      const res = await CIAIInstance.aiPicMatting(objectKey, width, height);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  server.tool(
    'aiQrcode',
    '图片处理-二维码识别-识别存储桶内二维码图片内容',
    {
      objectKey: z
        .string()
        .describe('COS对象键（完整路径）示例: images/qrcode.jpg'),
    },
    async ({ objectKey }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIAIInstance } = getCosInstances(requestContext);
      const res = await CIAIInstance.aiQrcode(objectKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  server.tool(
    'waterMarkFont',
    '生成带文字水印的图片',
    {
      objectKey: z
        .string()
        .describe('COS对象键（完整路径）示例: images/photo.jpg'),
      text: z.string().describe('水印文字内容（支持中文）').default('test'),
    },
    async ({ objectKey, text }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIPicInstance } = getCosInstances(requestContext);
      const res = await CIPicInstance.waterMarkFont({ objectKey, text });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  // --MEDIA--

  server.tool(
    'createMediaSmartCoverJob',
    '创建媒体智能封面任务',
    {
      objectKey: z.string().describe('对象在存储桶里的路径'),
    },
    async ({ objectKey }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIMediaInstance } = getCosInstances(requestContext);
      const res = await CIMediaInstance.createMediaSmartCoverJob(objectKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );
  server.tool(
    'describeMediaJob',
    '根据 jobid 查询指定的媒体智能封面任务结果',
    {
      jobId: z
        .string()
        .describe('要查询的任务ID，可通过提交智能封面任务的响应中获取。'),
    },
    async ({ jobId }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIMediaInstance } = getCosInstances(requestContext);
      const res = await CIMediaInstance.describeMediaJob(jobId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  // --METAINSIGHT--

  server.tool(
    'imageSearchPic',
    '根据输入的图片，从数据集中检索出与输入的图片内容相似的图片',
    {
      uri: z.string().describe('图片地址'),
    },
    async ({ uri }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIMateInsightInstance } = getCosInstances(requestContext);
      const res = await CIMateInsightInstance.imageSearchPic({ uri });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  server.tool(
    'imageSearchText',
    '根据输入的文本内容，从数据集中检索出与输入的文本内容相符的图片',
    {
      text: z.string().describe('检索的文本'),
    },
    async ({ text }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIMateInsightInstance } = getCosInstances(requestContext);
      const res = await CIMateInsightInstance.imageSearchText({ text });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  // --DOCMENT--
  server.tool(
    'createDocToPdfJob',
    '创建文档转 pdf 处理任务',
    {
      objectKey: z.string().describe('对象在存储桶里的路径'),
    },
    async ({ objectKey }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIDocInstance } = getCosInstances(requestContext);
      const res = await CIDocInstance.createDocToPdfJobs(objectKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );
  server.tool(
    'describeDocProcessJob',
    '根据 jobid 查询指定的文档转码任务结果',
    {
      jobId: z
        .string()
        .describe('要查询的任务ID，可通过提交文档任务的响应中获取。'),
    },
    async ({ jobId }, extra) => {
      const requestContext = (extra as any)?.requestContext as ExtendedRequestContext | undefined;
      const { CIDocInstance } = getCosInstances(requestContext);
      const res = await CIDocInstance.describeDocProcessJob(jobId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.data, null, 2),
          },
        ],
        isError: !res.isSuccess,
      };
    },
  );

  return server;
}

export function startWithSSE(server: McpServer, port: number = 3001) {
  const app = express();
  
  // 增加请求体大小限制 - 支持大文件上传 (最大 100MB)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));
  
  // to support multiple simultaneous connections we have a lookup object from
  // sessionId to transport
  const transports: { [sessionId: string]: SSEServerTransport } = {};

  app.get('/sse', async (req: Request, res: Response) => {
    // 从 headers 中提取 COS 配置
    const cosConfig = extractCosConfigFromHeaders(req.headers);
    
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    
    // 将配置注入到请求上下文（如果存在）
    if (cosConfig) {
      (transport as any).requestContext = { cosConfig };
    }
    
    res.on('close', () => {
      delete transports[transport.sessionId];
    });
    await server.connect(transport);
  });

  // 关键修复：将已解析的 body 作为第三个参数传递给 handlePostMessage
  // 这样 SSEServerTransport 就不会尝试再次读取 stream
  app.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    if (transport) {
      // 从 headers 中提取 COS 配置并注入
      const cosConfig = extractCosConfigFromHeaders(req.headers);
      if (cosConfig && !(transport as any).requestContext) {
        (transport as any).requestContext = { cosConfig };
      }
      
      // 传递已解析的 body（parsedBody 参数）
      await transport.handlePostMessage(req, res, req.body);
    } else {
      res.status(400).send('No transport found for sessionId');
    }
  });

  app.listen(port, () => {
    Logger.log = console.log;
    Logger.error = console.error;

    Logger.log(`SSE模式监听端口: ${port}`);
    Logger.log(`SSE: http://localhost:${port}/sse`);
    Logger.log(`消息: http://localhost:${port}/messages`);
    Logger.log(`支持通过 HTTP Headers 传递 COS 配置:`);
    Logger.log(`  - cos-secret-id`);
    Logger.log(`  - cos-secret-key`);
    Logger.log(`  - cos-region`);
    Logger.log(`  - cos-bucket`);
    Logger.log(`  - cos-dataset-name (可选)`);
  });
}

export function startWithStreamableHTTP(server: McpServer, port: number = 3001) {
  const app = express();
  
  // 增加请求体大小限制 - 支持大文件上传 (最大 100MB)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // StreamableHTTP 使用单一路径处理所有请求
  // 支持 GET（SSE流）和 POST（请求）
  const handleMcp = async (req: Request, res: Response) => {
    // 从 headers 中提取 COS 配置
    const cosConfig = extractCosConfigFromHeaders(req.headers);
    
    // 为每个请求创建新的 transport 实例（无状态模式）
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // 无状态模式
    });
    
    // 将配置注入到 transport 的请求上下文（如果存在）
    if (cosConfig) {
      (transport as any).requestContext = { cosConfig };
    }
    
    // 连接服务器
    await server.connect(transport);
    
    try {
      // 传递已解析的 body（对于 POST 请求）
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      Logger.error('处理 StreamableHTTP 请求时出错:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  };

  // 同时支持 GET 和 POST
  app.get('/mcp', handleMcp);
  app.post('/mcp', handleMcp);
  app.delete('/mcp', handleMcp);

  app.listen(port, () => {
    Logger.log = console.log;
    Logger.error = console.error;

    Logger.log(`StreamableHTTP 模式监听端口: ${port}`);
    Logger.log(`MCP 端点: http://localhost:${port}/mcp`);
    Logger.log(`支持通过 HTTP Headers 传递 COS 配置:`);
    Logger.log(`  - cos-secret-id`);
    Logger.log(`  - cos-secret-key`);
    Logger.log(`  - cos-region`);
    Logger.log(`  - cos-bucket`);
    Logger.log(`  - cos-dataset-name (可选)`);
  });
}
