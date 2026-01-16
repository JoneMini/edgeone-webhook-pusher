/**
 * Channel 渠道相关类型定义
 */

export type ChannelType = 'wechat';

export interface WeChatConfig {
  appId: string;
  appSecret: string;
  msgToken?: string;  // 消息回调 Token
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  config: WeChatConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelInput {
  name: string;
  type?: ChannelType;
  config: WeChatConfig;
}

export interface UpdateChannelInput {
  name?: string;
  config?: Partial<WeChatConfig>;
}
