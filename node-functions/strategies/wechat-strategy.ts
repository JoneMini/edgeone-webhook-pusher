/**
 * WeChatStrategy - 微信公众号渠道策略
 * 
 * 实现微信公众号的消息发送逻辑
 * 
 * 性能优化：
 * - 双层缓存：内存缓存 + KV 缓存，减少 KV 读取次数
 * - Token 复用：同一实例内 Token 复用
 */

import { BaseChannelStrategy } from './base-channel-strategy.js';
import type { Channel, WeChatConfig } from '../types/channel.js';
import type { PushMessage, SendResult, ChannelCapability } from './types.js';
import { ChannelCapability as ChannelCapabilityEnum } from './types.js';
import { configKV } from '../shared/kv-client.js';

const ACCESS_TOKEN_TTL = 7000;
const MEMORY_CACHE_CLEANUP_INTERVAL = 60 * 60 * 1000;
const WECHAT_API_TIMEOUT_MS = 10000;

function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = WECHAT_API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface WeChatAPIResponse {
  errcode?: number;
  errmsg?: string;
  access_token?: string;
  expires_in?: number;
  msgid?: number;
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

export class WeChatStrategy extends BaseChannelStrategy {
  private config: WeChatConfig;

  constructor(channel: Channel) {
    super(channel);
    this.config = channel.config as WeChatConfig;
  }

  getChannelCapability(): ChannelCapability {
    return ChannelCapabilityEnum.TOKEN_MANAGED;
  }

  /**
   * 获取微信 Access Token（双层缓存）
   * 
   * 缓存策略：
   * 1. 先查内存缓存（最快）
   * 2. 再查 KV 缓存（跨实例共享）
   * 3. 最后请求微信 API
   */
  protected async getAccessToken(): Promise<string> {
    cleanupExpiredTokens();
    const cacheKey = `wechat_token:${this.config.appId}`;

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
   * 从微信 API 获取新 Token
   */
  private async fetchNewToken(cacheKey: string): Promise<string> {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.config.appId}&secret=${this.config.appSecret}`;
    const response = await fetch(url);
    const data = (await response.json()) as WeChatAPIResponse;

    if (data.errcode) {
      throw new Error(`Failed to get access token: ${data.errmsg} (errcode: ${data.errcode})`);
    }

    if (!data.access_token || !data.expires_in) {
      throw new Error('Invalid access token response from WeChat API');
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
   * 构建微信消息体
   * 支持客服消息和模板消息两种格式
   */
  protected buildMessage(message: PushMessage, openId: string): any {
    if (message.templateId) {
      // 模板消息
      return {
        touser: openId,
        template_id: message.templateId,
        data: message.templateData || {
          first: { value: message.title },
          keyword1: { value: message.desp || '' },
          remark: { value: '' },
        },
      };
    } else {
      // 客服消息 - 在客服消息中也添加时间戳
      const timestamp = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      
      const content = message.desp
        ? `${message.title}\n\n${message.desp}\n\n⏰ ${timestamp}`
        : `${message.title}\n\n⏰ ${timestamp}`;
      return {
        touser: openId,
        msgtype: 'text',
        text: { content },
      };
    }
  }

  /**
   * 发送微信消息
   * 调用微信 API 发送消息，支持 Token 失效自动重试
   */
  protected async sendRequest(token: string, messageBody: any): Promise<SendResult> {
    const isTemplate = !!messageBody.template_id;
    const endpoint = isTemplate
      ? 'message/template/send'
      : 'message/custom/send';

    const url = `https://api.weixin.qq.com/cgi-bin/${endpoint}?access_token=${token}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageBody),
    });

    const data = (await response.json()) as WeChatAPIResponse;

    // Token 失效（40001: invalid credential, 42001: access_token expired），重试一次
    if (data.errcode === 40001 || data.errcode === 42001) {
      const cacheKey = `wechat_token:${this.config.appId}`;
      memoryTokenCache.delete(cacheKey);
      await configKV.delete(cacheKey);
      
      const newToken = await this.getAccessToken();
      const retryUrl = `https://api.weixin.qq.com/cgi-bin/${endpoint}?access_token=${newToken}`;
      const retryResponse = await fetch(retryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageBody),
      });
      
      return this.parseResponse(await retryResponse.json());
    }

    return this.parseResponse(data);
  }
}
