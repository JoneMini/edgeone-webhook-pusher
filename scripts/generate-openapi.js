#!/usr/bin/env node
/**
 * OpenAPI Documentation Generator
 * Feature: system-restructure
 * 
 * Generates OpenAPI 3.0 specification from JSDoc comments in route files
 * using swagger-jsdoc library.
 */

import swaggerJsdoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Webhook Pusher API',
      version: '2.0.0',
      description: `
Webhook Pusher 是一个基于 EdgeOne 的消息推送服务，支持通过 Webhook 发送微信公众号消息。

## 架构概述

系统采用三层架构：
- **Channel（渠道）**: 消息发送通道配置，如微信公众号
- **App（应用）**: 业务应用，关联渠道并定义推送模式
- **OpenID**: 应用下绑定的微信用户

## 认证方式

管理 API 需要在请求头中携带 Admin Token：
\`\`\`
Authorization: Bearer <admin_token>
\`\`\`
或
\`\`\`
X-Admin-Token: <admin_token>
\`\`\`

## Webhook 调用

Webhook API 无需认证，通过 App Key 标识应用：
\`\`\`
GET /{appKey}.send?title=消息标题&desp=消息内容
POST /{appKey}.send
\`\`\`
      `,
      contact: {
        name: 'ixNieStudio',
        email: 'colin@ixnie.cn',
      },
      license: {
        name: 'GPL-3.0',
        url: 'https://www.gnu.org/licenses/gpl-3.0.html',
      },
    },
    servers: [
      {
        url: '/v1',
        description: 'API v1',
      },
    ],
    tags: [
      { name: 'Init', description: '系统初始化' },
      { name: 'Channels', description: '渠道管理' },
      { name: 'Apps', description: '应用管理' },
      { name: 'OpenIDs', description: 'OpenID 管理' },
      { name: 'Messages', description: '消息历史' },
      { name: 'Webhook', description: 'Webhook 推送' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Admin Token 认证',
        },
        AdminToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Admin-Token',
          description: 'Admin Token (alternative)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            code: { type: 'integer', description: '错误码' },
            message: { type: 'string', description: '错误信息' },
            data: { type: 'null' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 0 },
            message: { type: 'string', example: 'success' },
            data: { type: 'object' },
          },
        },
        Channel: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'ch_abc123' },
            name: { type: 'string', example: '我的公众号' },
            type: { type: 'string', enum: ['wechat'], example: 'wechat' },
            config: {
              type: 'object',
              properties: {
                appId: { type: 'string', example: 'wx1234567890' },
                appSecret: { type: 'string', example: '****' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateChannel: {
          type: 'object',
          required: ['name', 'type', 'config'],
          properties: {
            name: { type: 'string', example: '我的公众号' },
            type: { type: 'string', enum: ['wechat'], example: 'wechat' },
            config: {
              type: 'object',
              required: ['appId', 'appSecret'],
              properties: {
                appId: { type: 'string', example: 'wx1234567890' },
                appSecret: { type: 'string', example: 'your_app_secret' },
              },
            },
          },
        },
        App: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'app_xyz789' },
            key: { type: 'string', example: 'APK1234567890abcdef' },
            name: { type: 'string', example: '服务器监控' },
            channelId: { type: 'string', example: 'ch_abc123' },
            pushMode: { type: 'string', enum: ['single', 'subscribe'], example: 'single' },
            messageType: { type: 'string', enum: ['normal', 'template'], example: 'template' },
            templateId: { type: 'string', example: 'tpl_xxx' },
            openIdCount: { type: 'integer', example: 5 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateApp: {
          type: 'object',
          required: ['name', 'channelId', 'pushMode', 'messageType'],
          properties: {
            name: { type: 'string', example: '服务器监控' },
            channelId: { type: 'string', example: 'ch_abc123' },
            pushMode: { type: 'string', enum: ['single', 'subscribe'], example: 'single' },
            messageType: { type: 'string', enum: ['normal', 'template'], example: 'template' },
            templateId: { type: 'string', description: 'messageType=template 时必填' },
          },
        },
        OpenID: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'oid_def456' },
            appId: { type: 'string', example: 'app_xyz789' },
            openId: { type: 'string', example: 'oXXXX-xxxxxxxxxxxxx' },
            nickname: { type: 'string', example: '张三' },
            remark: { type: 'string', example: '管理员' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateOpenID: {
          type: 'object',
          required: ['openId'],
          properties: {
            openId: { type: 'string', example: 'oXXXX-xxxxxxxxxxxxx' },
            nickname: { type: 'string', example: '张三' },
            remark: { type: 'string', example: '管理员' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'msg_ghi789' },
            appId: { type: 'string', example: 'app_xyz789' },
            title: { type: 'string', example: '服务器告警' },
            content: { type: 'string', example: 'CPU 使用率超过 90%' },
            pushMode: { type: 'string', enum: ['single', 'subscribe'] },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  openId: { type: 'string' },
                  success: { type: 'boolean' },
                  msgId: { type: 'string' },
                  error: { type: 'string' },
                },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PushResult: {
          type: 'object',
          properties: {
            pushId: { type: 'string', example: 'msg_ghi789' },
            total: { type: 'integer', example: 3 },
            success: { type: 'integer', example: 2 },
            failed: { type: 'integer', example: 1 },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  openId: { type: 'string' },
                  success: { type: 'boolean' },
                  msgId: { type: 'string' },
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  // Scan route files for JSDoc comments
  apis: [
    path.join(rootDir, 'node-functions/routes/*.js'),
    path.join(rootDir, 'node-functions/send/*.js'),
  ],
};

// Generate spec
const spec = swaggerJsdoc(options);

// Write to file
const jsonOutputPath = path.join(rootDir, 'docs/openapi.json');
fs.writeFileSync(jsonOutputPath, JSON.stringify(spec, null, 2));

console.log(`OpenAPI spec generated: ${jsonOutputPath}`);
console.log(`Found ${Object.keys(spec.paths || {}).length} paths`);
