/**
 * Message 消息相关类型定义
 */

export interface DeliveryResult {
  openId: string;
  success: boolean;
  error?: string;
  msgId?: string;
}

export interface Message {
  id: string;
  appId: string;
  title: string;
  desp?: string;
  results: DeliveryResult[];
  createdAt: string;
}

export interface PushMessageInput {
  title: string;
  desp?: string;
}

export interface PushResult {
  pushId: string;
  total: number;
  success: number;
  failed: number;
  results?: DeliveryResult[];
}
