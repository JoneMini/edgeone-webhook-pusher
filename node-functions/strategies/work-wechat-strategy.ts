/**
 * WorkWeChatStrategy - 企业微信渠道策略
 * 
 * 实现企业微信的消息发送逻辑
 * 
 * 性能优化：
 * - 双层缓存：内存缓存 + KV 缓存，减少 KV 读取次数
 * - Token 复用：同一实例内 Token 复用
 */

import { BaseChannelStrategy } from './base-channel-strategy.js';
import type { Channel, WorkWeChatConfig } from '../types/channel.js';
import type { PushMessage, SendResult, ChannelCapability } from './types.js';
import { ChannelCapability as ChannelCapabilityEnum } from './types.js';
import { configKV } from '../shared/kv-client.js';

const ACCESS_TOKEN_TTL = 7000;
const MEMORY_CACHE_CLEANUP_INTERVAL = 60 * 60 * 1000;

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface WorkWeChatAPIResponse {
  errcode: number;
  errmsg: string;
  access_token?: string;
  expires_in?: number;
  msgid?: string;
  invaliduser?: string;
  invalidparty?: string;
  invalidtag?: string;
}

const memoryTokenCache = new Map<string, TokenCache>();
let lastCacheCleanup = Date.now();

function cleanupExpiredTokens(): void {
  const now = Date.now();
  if (now - lastCacheCleanup < MEMORY_CACHE_CLEANUP_INTERVAL) {
    return;
  }
  
  for (const [key, cache] of memoryTokenCache.entries()) {
    if (cache.expiresAt <= now) {
      memoryTokenCache.delete(key);
    }
  }
  lastCacheCleanup = now;
}

export class WorkWeChatStrategy extends BaseChannelStrategy {
  private config: WorkWeChatConfig;
  
  private static readonly MAX_MESSAGE_LENGTH = 2048;

  constructor(channel: Channel) {
    super(channel);
    this.config = channel.config as WorkWeChatConfig;
    this.validateConfig();
  }
  
  private validateConfig(): void {
    if (!this.config.corpId) {
      throw new Error('Missing required config: corpId');
    }
    if (!this.config.agentId) {
      throw new Error('Missing required config: agentId');
    }
    if (!this.config.corpSecret) {
      throw new Error('Missing required config: corpSecret');
    }
  }
  
  private escapeSpecialChars(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  private truncateMessage(text: string): string {
    if (text.length <= WorkWeChatStrategy.MAX_MESSAGE_LENGTH) {
      return text;
    }
    
    const truncated = text.substring(0, WorkWeChatStrategy.MAX_MESSAGE_LENGTH - 3);
    return `${truncated}...`;
  }
  
  private processMessageContent(text: string): string {
    const escaped = this.escapeSpecialChars(text);
    return this.truncateMessage(escaped);
  }

  getChannelCapability(): ChannelCapability {
    return ChannelCapabilityEnum.TOKEN_MANAGED;
  }

  /**
   * 获取企业微信 Access Token（双层缓存）
   * 
   * 缓存策略：
   * 1. 先查内存缓存（最快）
   * 2. 再查 KV 缓存（跨实例共享）
   * 3. 最后请求企业微信 API
   */
  protected async getAccessToken(): Promise<string> {
    cleanupExpiredTokens();
    const cacheKey = `work_wechat_token:${this.config.corpId}:${this.config.agentId}`;

    const memoryCached = memoryTokenCache.get(cacheKey);
    if (memoryCached && memoryCached.expiresAt > Date.now()) {
      return memoryCached.accessToken;
    }

    const kvCached = await configKV.get<TokenCache>(cacheKey);
    if (kvCached?.accessToken && kvCached.expiresAt > Date.now()) {
      memoryTokenCache.set(cacheKey, kvCached);
      return kvCached.accessToken;
    }

    const token = await this.fetchNewToken(cacheKey);
    return token;
  }

  /**
   * 从企业微信 API 获取新 Token
   */
  private async fetchNewToken(cacheKey: string): Promise<string> {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.config.corpId}&corpsecret=${this.config.corpSecret}`;
    const response = await fetch(url);
    const data = (await response.json()) as WorkWeChatAPIResponse;

    if (data.errcode !== 0) {
      throw new Error(`Failed to get access token: ${data.errmsg} (errcode: ${data.errcode})`);
    }

    if (!data.access_token || !data.expires_in) {
      throw new Error('Invalid access token response from WorkWeChat API');
    }

    const expiresAt = Date.now() + (data.expires_in - 300) * 1000;
    const tokenData: TokenCache = {
      accessToken: data.access_token,
      expiresAt,
    };

    memoryTokenCache.set(cacheKey, tokenData);
    await configKV.put(cacheKey, tokenData, ACCESS_TOKEN_TTL);

    return data.access_token;
  }

  /**
   * 构建企业微信消息体
   * 支持用户ID和部门ID两种目标类型
   * 支持文本消息和模板卡片消息格式
   */
  protected buildMessage(message: PushMessage, target: string): any {
    // 判断 target 是用户ID还是部门ID
    // 部门ID以 'dept_' 前缀标识
    const isUser = !target.startsWith('dept_');
    
    // 构建消息内容（应用特殊字符转义和长度限制）
    const content = message.desp
      ? `${message.title}\n\n${message.desp}`
      : message.title;
    const processedContent = this.processMessageContent(content);

    return {
      touser: isUser ? target : undefined,
      toparty: !isUser ? target.replace('dept_', '') : undefined,
      msgtype: 'text',
      agentid: this.config.agentId,
      text: {
        content: processedContent,
      },
    };
  }

  /**
   * 发送企业微信消息
   * 调用企业微信 API 发送消息，支持 Token 失效自动重试
   */
  protected async sendRequest(token: string, messageBody: any): Promise<SendResult> {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageBody),
    });

    const data = (await response.json()) as WorkWeChatAPIResponse;

    // Token 失效（40014: invalid access_token, 42001: access_token expired），重试一次
    if (data.errcode === 40014 || data.errcode === 42001) {
      const cacheKey = `work_wechat_token:${this.config.corpId}:${this.config.agentId}`;
      memoryTokenCache.delete(cacheKey);
      await configKV.delete(cacheKey);
      
      const newToken = await this.getAccessToken();
      const retryUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${newToken}`;
      const retryResponse = await fetch(retryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageBody),
      });
      
      const retryData = (await retryResponse.json()) as WorkWeChatAPIResponse;
      return this.parseResponse(retryData);
    }

    return this.parseResponse(data);
  }

  /**
   * 解析企业微信 API 响应
   * 企业微信的响应格式与微信类似，但字段略有不同
   */
  protected parseResponse(response: WorkWeChatAPIResponse): SendResult {
    return {
      success: response.errcode === 0,
      msgId: response.msgid,
      error: response.errmsg,
      errorCode: response.errcode,
    };
  }
}
