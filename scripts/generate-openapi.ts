/**
 * 生成 OpenAPI 文档脚本
 * 
 * 运行: yarn generate:openapi
 * 输出: public/openapi.json
 * 
 * Schema 定义来自 node-functions/schemas/index.ts
 * 确保 OpenAPI 文档和 TypeScript 类型 100% 一致
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 直接导入所有 Schema
import {
  ChannelSchema,
  CreateChannelInputSchema,
  UpdateChannelInputSchema,
  AppSchema,
  CreateAppInputSchema,
  UpdateAppInputSchema,
  OpenIDSchema,
  MessageSchema,
  SendMessageInputSchema,
  HealthResponseSchema,
  InitStatusSchema,
  InitInputSchema,
  ErrorResponseSchema,
  ChannelTypeSchema,
  WeChatMPConfigSchema,
  MessageStatusSchema,
  PaginationSchema,
} from '../node-functions/schemas/index';

// API 响应包装器
const wrapResponse = (dataSchema: any, description: string) => ({
  type: 'object',
  properties: {
    code: { type: 'integer', description: '错误码，0 表示成功' },
    message: { type: 'string', description: '消息' },
    data: dataSchema,
  },
  required: ['code', 'data'],
  description,
});

// 列表响应包装器
const wrapListResponse = (itemSchema: any, description: string) => 
  wrapResponse({ type: 'array', items: itemSchema }, description);

// 生成 OpenAPI 文档
const openApiDoc = {
  openapi: '3.0.0',
  info: {
    title: 'WxPusher API',
    version: '1.0.0',
    description: 'Webhook 消息推送服务 API - 支持微信公众号、钉钉、企业微信等多渠道消息推送',
  },
  servers: [
    { url: '/v1', description: 'API v1' },
  ],
  tags: [
    { name: 'System', description: '系统接口' },
    { name: 'Channels', description: '渠道管理' },
    { name: 'Apps', description: '应用管理' },
    { name: 'OpenIDs', description: '订阅者管理' },
    { name: 'Messages', description: '消息管理' },
  ],
  paths: {
    // ============ System ============
    '/health': {
      get: {
        summary: '健康检查',
        tags: ['System'],
        responses: {
          '200': {
            description: '服务正常',
            content: { 'application/json': { schema: wrapResponse(HealthResponseSchema, '健康检查响应') } },
          },
        },
      },
    },
    '/init/status': {
      get: {
        summary: '获取初始化状态',
        tags: ['System'],
        responses: {
          '200': {
            description: '成功',
            content: { 'application/json': { schema: wrapResponse(InitStatusSchema, '初始化状态') } },
          },
        },
      },
    },
    '/init': {
      post: {
        summary: '初始化系统',
        tags: ['System'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: InitInputSchema } },
        },
        responses: {
          '200': {
            description: '初始化成功',
            content: { 'application/json': { schema: wrapResponse({ type: 'object', properties: { success: { type: 'boolean' } } }, '初始化结果') } },
          },
          '400': {
            description: '参数错误',
            content: { 'application/json': { schema: ErrorResponseSchema } },
          },
        },
      },
    },

    // ============ Channels ============
    '/channels': {
      get: {
        summary: '获取渠道列表',
        tags: ['Channels'],
        security: [{ AdminToken: [] }],
        responses: {
          '200': {
            description: '成功',
            content: { 'application/json': { schema: wrapListResponse(ChannelSchema, '渠道列表') } },
          },
        },
      },
      post: {
        summary: '创建渠道',
        tags: ['Channels'],
        security: [{ AdminToken: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: CreateChannelInputSchema } },
        },
        responses: {
          '201': {
            description: '创建成功',
            content: { 'application/json': { schema: wrapResponse(ChannelSchema, '创建的渠道') } },
          },
        },
      },
    },
    '/channels/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: '渠道 ID' },
      ],
      get: {
        summary: '获取渠道详情',
        tags: ['Channels'],
        security: [{ AdminToken: [] }],
        responses: {
          '200': {
            description: '成功',
            content: { 'application/json': { schema: wrapResponse(ChannelSchema, '渠道详情') } },
          },
          '404': {
            description: '渠道不存在',
            content: { 'application/json': { schema: ErrorResponseSchema } },
          },
        },
      },
      put: {
        summary: '更新渠道',
        tags: ['Channels'],
        security: [{ AdminToken: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: UpdateChannelInputSchema } },
        },
        responses: {
          '200': {
            description: '更新成功',
            content: { 'application/json': { schema: wrapResponse(ChannelSchema, '更新后的渠道') } },
          },
        },
      },
      delete: {
        summary: '删除渠道',
        tags: ['Channels'],
        security: [{ AdminToken: [] }],
        responses: {
          '200': { description: '删除成功' },
        },
      },
    },

    // ============ Apps ============
    '/apps': {
      get: {
        summary: '获取应用列表',
        tags: ['Apps'],
        security: [{ AdminToken: [] }],
        responses: {
          '200': {
            description: '成功',
            content: { 'application/json': { schema: wrapListResponse(AppSchema, '应用列表') } },
          },
        },
      },
      post: {
        summary: '创建应用',
        tags: ['Apps'],
        security: [{ AdminToken: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: CreateAppInputSchema } },
        },
        responses: {
          '201': {
            description: '创建成功',
            content: { 'application/json': { schema: wrapResponse(AppSchema, '创建的应用') } },
          },
        },
      },
    },
    '/apps/{appId}': {
      parameters: [
        { name: 'appId', in: 'path', required: true, schema: { type: 'string' }, description: '应用 ID' },
      ],
      get: {
        summary: '获取应用详情',
        tags: ['Apps'],
        security: [{ AdminToken: [] }],
        responses: {
          '200': {
            description: '成功',
            content: { 'application/json': { schema: wrapResponse(AppSchema, '应用详情') } },
          },
        },
      },
      put: {
        summary: '更新应用',
        tags: ['Apps'],
        security: [{ AdminToken: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: UpdateAppInputSchema } },
        },
        responses: {
          '200': {
            description: '更新成功',
            content: { 'application/json': { schema: wrapResponse(AppSchema, '更新后的应用') } },
          },
        },
      },
      delete: {
        summary: '删除应用',
        tags: ['Apps'],
        security: [{ AdminToken: [] }],
        responses: {
          '200': { description: '删除成功' },
        },
      },
    },
    '/apps/{appId}/qrcode': {
      parameters: [
        { name: 'appId', in: 'path', required: true, schema: { type: 'string' }, description: '应用 ID' },
      ],
      get: {
        summary: '获取应用订阅二维码',
        tags: ['Apps'],
        security: [{ AdminToken: [] }],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: wrapResponse({
                  type: 'object',
                  properties: {
                    qrcodeUrl: { type: 'string', description: '二维码图片 URL' },
                    expireAt: { type: 'string', format: 'date-time', description: '过期时间' },
                  },
                }, '二维码信息'),
              },
            },
          },
        },
      },
    },

    // ============ OpenIDs ============
    '/apps/{appId}/openids': {
      parameters: [
        { name: 'appId', in: 'path', required: true, schema: { type: 'string' }, description: '应用 ID' },
      ],
      get: {
        summary: '获取应用的订阅者列表',
        tags: ['OpenIDs'],
        security: [{ AdminToken: [] }],
        responses: {
          '200': {
            description: '成功',
            content: { 'application/json': { schema: wrapListResponse(OpenIDSchema, '订阅者列表') } },
          },
        },
      },
    },

    // ============ Messages ============
    '/messages': {
      get: {
        summary: '获取消息列表',
        tags: ['Messages'],
        security: [{ AdminToken: [] }],
        parameters: [
          { name: 'appId', in: 'query', schema: { type: 'string' }, description: '按应用 ID 筛选' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: '返回数量' },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 }, description: '偏移量' },
        ],
        responses: {
          '200': {
            description: '成功',
            content: { 'application/json': { schema: wrapListResponse(MessageSchema, '消息列表') } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      // 实体
      Channel: ChannelSchema,
      App: AppSchema,
      OpenID: OpenIDSchema,
      Message: MessageSchema,
      // 输入
      CreateChannelInput: CreateChannelInputSchema,
      UpdateChannelInput: UpdateChannelInputSchema,
      CreateAppInput: CreateAppInputSchema,
      UpdateAppInput: UpdateAppInputSchema,
      SendMessageInput: SendMessageInputSchema,
      InitInput: InitInputSchema,
      // 响应
      HealthResponse: HealthResponseSchema,
      InitStatus: InitStatusSchema,
      ErrorResponse: ErrorResponseSchema,
      // 枚举/子类型
      ChannelType: ChannelTypeSchema,
      WeChatMPConfig: WeChatMPConfigSchema,
      MessageStatus: MessageStatusSchema,
      Pagination: PaginationSchema,
    },
    securitySchemes: {
      AdminToken: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Admin-Token',
        description: '管理员认证 Token',
      },
    },
  },
};

// 输出到 public 目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, '../public/openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(openApiDoc, null, 2));
console.log(`✅ OpenAPI 文档已生成: ${outputPath}`);
