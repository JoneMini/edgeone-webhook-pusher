/**
 * WeChat Service
 * * Handles WeChat API interactions including access token management
 * and user follow status checking.
 * * All functions require a Channel parameter to support multi-channel scenarios.
 */

import { configKV } from '../shared/kv-client.js';
import type { Channel } from '../types/channel.js';

// Access token cache TTL (2 hours, token valid for ~2h)
const ACCESS_TOKEN_TTL = 7000; // slightly less than 2 hours

// Token status cache TTL (24 hours)
const TOKEN_STATUS_TTL = 86400;

// 默认头像 URL
const DEFAULT_AVATAR = '';

// 内存缓存：减少 KV 读取次数
const memoryTokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

/**
 * 微信 API 错误码映射
 */
export const WECHAT_ERROR_MESSAGES: Record<number, string> = {
  40001: 'AppSecret 错误或 Access Token 无效',
  40002: '无效的凭证类型',
  40003: 'OpenID 无效',
  40013: 'AppID 无效',
  40125: 'AppSecret 无效',
  41001: '缺少 Access Token',
  41002: '缺少 AppID',
  41003: '缺少 AppSecret',
  42001: 'Access Token 已过期',
  42002: 'Refresh Token 已过期',
  43001: '需要 GET 请求',
  43002: '需要 POST 请求',
  44001: '空白的多媒体文件',
  45015: '用户未关注公众号',
  48001: 'API 未授权，请检查公众号权限',
  50001: '用户未授权该 API',
  61023: 'Refresh Token 无效',
};

/**
 * Token 维护状态
 */
export interface TokenStatus {
  valid: boolean;
  lastRefreshAt: number;      // 最后刷新时间
  lastRefreshSuccess: boolean; // 最后刷新是否成功
  expiresAt?: number;         // Token 过期时间
  error?: string;             // 错误信息
  errorCode?: number;         // 错误码
}

/**
 * 获取微信错误码对应的中文错误信息
 */
export function getWeChatErrorMessage(errcode: number): string {
  return WECHAT_ERROR_MESSAGES[errcode] || `微信 API 错误: ${errcode}`;
}

/**
 * Generate cache key for access token based on channel
 */
export function getAccessTokenCacheKey(channel: Channel): string {
  return `wechat_access_token:${channel.config.appId}`;
}

/**
 * Generate cache key for token status based on channel
 */
export function getTokenStatusCacheKey(channelId: string): string {
  return `wechat_token_status:${channelId}`;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface WeChatResponse {
  errcode?: number;
  errmsg?: string;
  access_token?: string;
  expires_in?: number;
}

interface WeChatUserInfo {
  openid: string;
  nickname?: string;
  headimgurl?: string;
  subscribe: number;
  errcode?: number;
  errmsg?: string;
}

/**
 * 更新 Token 维护状态
 */
async function updateTokenStatus(channelId: string, status: TokenStatus): Promise<void> {
  const cacheKey = getTokenStatusCacheKey(channelId);
  await configKV.put(cacheKey, status, TOKEN_STATUS_TTL);
}

/**
 * 获取 Token 维护状态
 */
export async function getTokenStatus(channelId: string): Promise<TokenStatus | null> {
  const cacheKey = getTokenStatusCacheKey(channelId);
  return configKV.get<TokenStatus>(cacheKey);
}

/**
 * Get WeChat access token (cached in KV and Memory)
 * @param channel - The channel containing WeChat credentials
 * @param forceRefresh - Force refresh token even if cached
 */
export async function getAccessToken(channel: Channel, forceRefresh = false): Promise<string | null> {
  if (!channel) {
    throw new Error('Channel is required');
  }

  const { appId, appSecret } = channel.config;
  if (!appId || !appSecret) {
    console.error('WeChat config not found in channel');
    return null;
  }

  const cacheKey = getAccessTokenCacheKey(channel);

  // 1. Try Memory Cache first (fastest)
  if (!forceRefresh) {
    const memCached = memoryTokenCache.get(cacheKey);
    if (memCached && memCached.expiresAt > Date.now()) {
      return memCached.accessToken;
    }
  }

  // 2. Try KV Cache
  if (!forceRefresh) {
    const cached = await configKV.get<TokenCache>(cacheKey);
    if (cached?.accessToken && cached?.expiresAt > Date.now()) {
      // Update memory cache
      memoryTokenCache.set(cacheKey, {
        accessToken: cached.accessToken,
        expiresAt: cached.expiresAt
      });
      return cached.accessToken;
    }
  }

  // 3. Fetch new access token from WeChat
  try {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    const res = await fetch(url);
    const data = (await res.json()) as WeChatResponse;

    if (data.errcode) {
      console.error('Failed to get access token:', data);
      await updateTokenStatus(channel.id, {
        valid: false,
        lastRefreshAt: Date.now(),
        lastRefreshSuccess: false,
        error: getWeChatErrorMessage(data.errcode),
        errorCode: data.errcode,
      });
      return null;
    }

    if (!data.access_token || !data.expires_in) {
      await updateTokenStatus(channel.id, {
        valid: false,
        lastRefreshAt: Date.now(),
        lastRefreshSuccess: false,
        error: '获取 Access Token 失败',
      });
      return null;
    }

    const expiresAt = Date.now() + (data.expires_in - 300) * 1000; // 5 min buffer
    const tokenData: TokenCache = {
      accessToken: data.access_token,
      expiresAt,
    };

    // Update Memory Cache
    memoryTokenCache.set(cacheKey, tokenData);

    // Update KV Cache
    await configKV.put(cacheKey, tokenData, ACCESS_TOKEN_TTL);

    // Update Status
    await updateTokenStatus(channel.id, {
      valid: true,
      lastRefreshAt: Date.now(),
      lastRefreshSuccess: true,
      expiresAt,
    });

    return data.access_token;
  } catch (error) {
    console.error('Error fetching access token:', error);
    await updateTokenStatus(channel.id, {
      valid: false,
      lastRefreshAt: Date.now(),
      lastRefreshSuccess: false,
      error: '网络请求失败',
    });
    return null;
  }
}

/**
 * Check if user has followed the official account
 * @param channel - The channel containing WeChat credentials
 * @param openId - The user's OpenID
 */
export async function checkUserFollowStatus(channel: Channel, openId: string): Promise<{ subscribed: boolean; nickname?: string }> {
  if (!channel) {
    throw new Error('Channel is required');
  }

  const accessToken = await getAccessToken(channel);
  if (!accessToken) {
    return { subscribed: false };
  }

  try {
    const url = `https://api.weixin.qq.com/cgi-bin/user/info?access_token=${accessToken}&openid=${openId}&lang=zh_CN`;
    const res = await fetch(url);
    const data = (await res.json()) as WeChatUserInfo;

    if (data.errcode) {
      console.error('Failed to get user info:', data);
      return { subscribed: false };
    }

    return {
      subscribed: data.subscribe === 1,
      nickname: data.nickname || undefined,
    };
  } catch (error) {
    console.error('Error checking follow status:', error);
    return { subscribed: false };
  }
}

/**
 * Get user info from WeChat
 * @param channel - The channel containing WeChat credentials
 * @param openId - The user's OpenID
 */
export async function getUserInfo(channel: Channel, openId: string): Promise<{ openId: string; nickname?: string; avatar?: string; subscribed: boolean } | null> {
  if (!channel) {
    throw new Error('Channel is required');
  }

  const accessToken = await getAccessToken(channel);
  if (!accessToken) {
    return null;
  }

  try {
    const url = `https://api.weixin.qq.com/cgi-bin/user/info?access_token=${accessToken}&openid=${openId}&lang=zh_CN`;
    const res = await fetch(url);
    const data = (await res.json()) as WeChatUserInfo;

    if (data.errcode) {
      console.error('Failed to get user info:', data);
      return null;
    }

    const nickname = data.nickname && data.nickname.trim() ? data.nickname : undefined;
    const avatar = data.headimgurl && data.headimgurl.trim() ? data.headimgurl : DEFAULT_AVATAR || undefined;

    return {
      openId: data.openid,
      nickname,
      avatar,
      subscribed: data.subscribe === 1,
    };
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

/**
 * 验证渠道配置是否有效
 * @param channel - The channel containing WeChat credentials
 * @returns 验证结果
 */
export async function verifyChannelConfig(channel: Channel): Promise<{ valid: boolean; expiresIn?: number; error?: string; errorCode?: number }> {
  // 复用 getAccessToken 逻辑（强制刷新）来验证
  try {
    const token = await getAccessToken(channel, true);
    if (token) {
       // 获取缓存的过期时间
       const cacheKey = getAccessTokenCacheKey(channel);
       const memCached = memoryTokenCache.get(cacheKey);
       const expiresIn = memCached ? Math.floor((memCached.expiresAt - Date.now()) / 1000) : 7000;
       return { valid: true, expiresIn };
    }
    
    // 如果 token 为 null，说明验证失败，尝试获取最后一次的错误状态
    const status = await getTokenStatus(channel.id);
    return { 
      valid: false, 
      error: status?.error || '验证失败', 
      errorCode: status?.errorCode 
    };
  } catch (error) {
    return { valid: false, error: '验证异常' };
  }
}

/**
 * 创建带参数的临时二维码（仅认证服务号可用）
 */
export async function createQRCode(
  channel: Channel,
  sceneStr: string,
  expireSeconds = 300
): Promise<{ ticket: string; url: string; expireSeconds: number } | null> {
  if (!channel) {
    throw new Error('Channel is required');
  }

  const accessToken = await getAccessToken(channel);
  if (!accessToken) {
    return null;
  }

  try {
    const url = `https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${accessToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expire_seconds: expireSeconds,
        action_name: 'QR_STR_SCENE',
        action_info: {
          scene: {
            scene_str: sceneStr,
          },
        },
      }),
    });

    const data = (await res.json()) as {
      ticket?: string;
      expire_seconds?: number;
      url?: string;
      errcode?: number;
      errmsg?: string;
    };

    if (data.errcode) {
      console.error('Failed to create QR code:', data);
      return null;
    }

    if (!data.ticket || !data.url) {
      return null;
    }

    return {
      ticket: data.ticket,
      url: data.url,
      expireSeconds: data.expire_seconds || expireSeconds,
    };
  } catch (error) {
    console.error('Error creating QR code:', error);
    return null;
  }
}

export function getQRCodeImageUrl(ticket: string): string {
  return `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(ticket)}`;
}

export async function sendCustomMessage(
  channel: Channel,
  openId: string,
  content: string
): Promise<{ success: boolean; msgId?: string; error?: string }> {
  const accessToken = await getAccessToken(channel);
  if (!accessToken) {
    return { success: false, error: 'Failed to get access token' };
  }

  const result = await doSendCustomMessage(accessToken, openId, content);
  
  if (!result.success && (result.errorCode === 40001 || result.errorCode === 42001)) {
    // 强制刷新 Token
    const newToken = await getAccessToken(channel, true);
    if (newToken) {
      return doSendCustomMessage(newToken, openId, content);
    }
  }
  
  return result;
}

async function doSendCustomMessage(
  accessToken: string,
  openId: string,
  content: string
): Promise<{ success: boolean; msgId?: string; error?: string; errorCode?: number }> {
  try {
    const url = `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`;

    const body = {
      touser: openId,
      msgtype: 'text',
      text: { content },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as { errcode?: number; errmsg?: string; msgid?: number };

    if (data.errcode === 0) {
      return { success: true, msgId: String(data.msgid || '') };
    } else {
      return { 
        success: false, 
        error: `WeChat API error: ${data.errcode} - ${data.errmsg}`,
        errorCode: data.errcode,
      };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendTemplateMessage(
  channel: Channel,
  openId: string,
  templateId: string,
  data: Record<string, { value: string; color?: string }>
): Promise<{ success: boolean; msgId?: string; error?: string }> {
  const accessToken = await getAccessToken(channel);
  if (!accessToken) {
    return { success: false, error: 'Failed to get access token' };
  }

  const result = await doSendTemplateMessage(accessToken, openId, templateId, data);
  
  if (!result.success && (result.errorCode === 40001 || result.errorCode === 42001)) {
    const newToken = await getAccessToken(channel, true);
    if (newToken) {
      return doSendTemplateMessage(newToken, openId, templateId, data);
    }
  }
  
  return result;
}

async function doSendTemplateMessage(
  accessToken: string,
  openId: string,
  templateId: string,
  data: Record<string, { value: string; color?: string }>
): Promise<{ success: boolean; msgId?: string; error?: string; errorCode?: number }> {
  try {
    const url = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`;

    const body = {
      touser: openId,
      template_id: templateId,
      data,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseData = (await res.json()) as { errcode?: number; errmsg?: string; msgid?: number };

    if (responseData.errcode === 0) {
      return { success: true, msgId: String(responseData.msgid) };
    } else {
      return { 
        success: false, 
        error: `WeChat API error: ${responseData.errcode} - ${responseData.errmsg}`,
        errorCode: responseData.errcode,
      };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export const wechatService = {
  getAccessToken,
  checkUserFollowStatus,
  getUserInfo,
  verifyChannelConfig,
  getWeChatErrorMessage,
  getTokenStatus,
  createQRCode,
  getQRCodeImageUrl,
  sendCustomMessage,
  sendTemplateMessage,
};
