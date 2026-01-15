/**
 * API Schema 定义（单一数据源）
 * 
 * 使用 TypeBox 同时定义：
 * 1. TypeScript 类型（通过 Static<typeof Schema> 推导）
 * 2. JSON Schema（用于 OpenAPI 文档生成）
 * 
 * 所有类型定义都在这里，确保类型和 schema 100% 一致
 */

import { Type, Static, TSchema } from '@sinclair/typebox';

// ============ 通用响应 ============

export const ApiResponseSchema = <T extends TSchema>(dataSchema: T) =>
  Type.Object({
    code: Type.Integer({ description: '错误码，0 表示成功' }),
    message: Type.Optional(Type.String({ description: '消息' })),
    data: dataSchema,
  });

export const ErrorResponseSchema = Type.Object({
  code: Type.Integer({ description: '错误码' }),
  message: Type.String({ description: '错误消息' }),
  data: Type.Null(),
});

export type ErrorResponse = Static<typeof ErrorResponseSchema>;

// ============ Channel 渠道 ============

export const ChannelTypeSchema = Type.Union([
  Type.Literal('wechat_mp'),
  Type.Literal('dingtalk'),
  Type.Literal('wecom'),
], { description: '渠道类型' });

export type ChannelType = Static<typeof ChannelTypeSchema>;

// 微信公众号配置
export const WeChatMPConfigSchema = Type.Object({
  appId: Type.String({ description: '微信公众号 AppID' }),
  appSecret: Type.String({ description: '微信公众号 AppSecret' }),
  token: Type.String({ description: '微信公众号 Token' }),
  encodingAESKey: Type.Optional(Type.String({ description: '消息加解密密钥' })),
});

export type WeChatMPConfig = Static<typeof WeChatMPConfigSchema>;

// 渠道实体
export const ChannelSchema = Type.Object({
  id: Type.String({ description: '渠道 ID' }),
  name: Type.String({ description: '渠道名称' }),
  type: ChannelTypeSchema,
  config: Type.Any({ description: '渠道配置（根据 type 不同结构不同）' }),
  createdAt: Type.String({ format: 'date-time', description: '创建时间' }),
  updatedAt: Type.String({ format: 'date-time', description: '更新时间' }),
});

export type Channel = Static<typeof ChannelSchema>;

// 创建渠道输入
export const CreateChannelInputSchema = Type.Object({
  name: Type.String({ description: '渠道名称' }),
  type: ChannelTypeSchema,
  config: Type.Any({ description: '渠道配置' }),
});

export type CreateChannelInput = Static<typeof CreateChannelInputSchema>;

// 更新渠道输入
export const UpdateChannelInputSchema = Type.Object({
  name: Type.Optional(Type.String({ description: '渠道名称' })),
  config: Type.Optional(Type.Any({ description: '渠道配置' })),
});

export type UpdateChannelInput = Static<typeof UpdateChannelInputSchema>;

// ============ App 应用 ============

export const AppSchema = Type.Object({
  id: Type.String({ description: '应用 ID' }),
  name: Type.String({ description: '应用名称' }),
  channelId: Type.String({ description: '关联渠道 ID' }),
  pushKey: Type.String({ description: '推送密钥' }),
  createdAt: Type.String({ format: 'date-time', description: '创建时间' }),
  updatedAt: Type.String({ format: 'date-time', description: '更新时间' }),
});

export type App = Static<typeof AppSchema>;

export const CreateAppInputSchema = Type.Object({
  name: Type.String({ description: '应用名称' }),
  channelId: Type.String({ description: '关联渠道 ID' }),
});

export type CreateAppInput = Static<typeof CreateAppInputSchema>;

export const UpdateAppInputSchema = Type.Object({
  name: Type.Optional(Type.String({ description: '应用名称' })),
});

export type UpdateAppInput = Static<typeof UpdateAppInputSchema>;

// ============ OpenID 订阅者 ============

export const OpenIDSchema = Type.Object({
  id: Type.String({ description: 'OpenID 记录 ID' }),
  appId: Type.String({ description: '应用 ID' }),
  openId: Type.String({ description: '用户 OpenID' }),
  nickname: Type.Optional(Type.String({ description: '用户昵称' })),
  subscribed: Type.Boolean({ description: '是否已关注' }),
  createdAt: Type.String({ format: 'date-time', description: '创建时间' }),
  updatedAt: Type.String({ format: 'date-time', description: '更新时间' }),
});

export type OpenID = Static<typeof OpenIDSchema>;

// ============ Message 消息 ============

export const MessageStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('sent'),
  Type.Literal('failed'),
], { description: '发送状态' });

export type MessageStatus = Static<typeof MessageStatusSchema>;

export const MessageSchema = Type.Object({
  id: Type.String({ description: '消息 ID' }),
  appId: Type.String({ description: '应用 ID' }),
  openId: Type.String({ description: '接收者 OpenID' }),
  content: Type.String({ description: '消息内容' }),
  status: MessageStatusSchema,
  createdAt: Type.String({ format: 'date-time', description: '创建时间' }),
});

export type Message = Static<typeof MessageSchema>;

export const SendMessageInputSchema = Type.Object({
  content: Type.String({ description: '消息内容' }),
  openIds: Type.Optional(Type.Array(Type.String(), { description: '指定接收者 OpenID 列表' })),
  sendToAll: Type.Optional(Type.Boolean({ description: '是否发送给所有订阅者', default: false })),
});

export type SendMessageInput = Static<typeof SendMessageInputSchema>;

// ============ System 系统 ============

export const HealthResponseSchema = Type.Object({
  status: Type.String({ description: '服务状态' }),
  timestamp: Type.String({ format: 'date-time', description: '时间戳' }),
  runtime: Type.String({ description: '运行时信息' }),
});

export type HealthResponse = Static<typeof HealthResponseSchema>;

export const InitStatusSchema = Type.Object({
  initialized: Type.Boolean({ description: '是否已初始化' }),
  hasAdminToken: Type.Boolean({ description: '是否已设置管理员 Token' }),
});

export type InitStatus = Static<typeof InitStatusSchema>;

export const InitInputSchema = Type.Object({
  adminToken: Type.String({ minLength: 8, description: '管理员 Token（至少 8 位）' }),
});

export type InitInput = Static<typeof InitInputSchema>;

// ============ 分页 ============

export const PaginationSchema = Type.Object({
  total: Type.Integer({ description: '总数' }),
  limit: Type.Integer({ description: '每页数量' }),
  offset: Type.Integer({ description: '偏移量' }),
});

export type Pagination = Static<typeof PaginationSchema>;

export const PaginatedResponseSchema = <T extends TSchema>(itemSchema: T) =>
  Type.Object({
    items: Type.Array(itemSchema),
    pagination: PaginationSchema,
  });
