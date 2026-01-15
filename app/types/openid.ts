/**
 * OpenID 订阅者相关类型定义
 */

export interface OpenID {
  id: string;
  appId: string;
  openId: string;
  nickname?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpenIDInput {
  openId: string;
  nickname?: string;
  remark?: string;
}

export interface UpdateOpenIDInput {
  nickname?: string;
  remark?: string;
}
