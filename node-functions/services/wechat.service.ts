/**
 * WeChat Service
 * 
 * Handles WeChat API interactions including access token management
 * and user follow status checking.
 * 
 * All functions require a Channel parameter to support multi-channel scenarios.
 */

import { configKV } from '../shared/kv-client.js';
import type { Channel } from '../types/channel.js';

// Access token cache TTL (2 hours, token valid for ~2h)
const ACCESS_TOKEN_TTL = 7000; // slightly less than 2 hours

/**
 * Generate cache key for access token based on channel
 */
export function getAccessTokenCacheKey(channel: Channel): string {
  return `wechat_access_token:${channel.config.appId}`;
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
  subscribe: number;
  errcode?: number;
  errmsg?: string;
}

/**
 * Get WeChat access token (cached in KV)
 * @param channel - The channel containing WeChat credentials
 */
export async function getAccessToken(channel: Channel): Promise<string | null> {
  if (!channel) {
    throw new Error('Channel is required');
  }

  const { appId, appSecret } = channel.config;
  if (!appId || !appSecret) {
    console.error('WeChat config not found in channel');
    return null;
  }

  const cacheKey = getAccessTokenCacheKey(channel);

  // Try to get from cache
  const cached = await configKV.get<TokenCache>(cacheKey);
  if (cached?.accessToken && cached?.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  // Fetch new access token
  try {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    const res = await fetch(url);
    const data = (await res.json()) as WeChatResponse;

    if (data.errcode) {
      console.error('Failed to get access token:', data);
      return null;
    }

    if (!data.access_token || !data.expires_in) {
      return null;
    }

    const tokenData: TokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000, // 5 min buffer
    };

    // Cache in KV with channel-specific key
    await configKV.put(cacheKey, tokenData, ACCESS_TOKEN_TTL);

    return data.access_token;
  } catch (error) {
    console.error('Error fetching access token:', error);
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
export async function getUserInfo(channel: Channel, openId: string): Promise<{ openId: string; nickname?: string; subscribed: boolean } | null> {
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

    return {
      openId: data.openid,
      nickname: data.nickname || undefined,
      subscribed: data.subscribe === 1,
    };
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

export const wechatService = {
  getAccessToken,
  checkUserFollowStatus,
  getUserInfo,
};
