/**
 * API Composable
 * Feature: frontend-admin-ui
 * 
 * Unified API request handling with authentication,
 * error handling, and 401 redirect.
 */
import { useAuthStore } from '~/stores/auth';

const API_BASE = '/v1';

// Response types
interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

// Data types
export interface StatsData {
  sendKeyCount: number;
  topicCount: number;
  messageCount: number;
  recentMessages: {
    id: string;
    title: string;
    type: 'single' | 'topic';
    success: boolean;
    createdAt: string;
  }[];
}

export interface AppConfig {
  wechat: {
    appId: string;
    appSecret: string;
    templateId: string;
    msgToken?: string;
  };
  rateLimit: {
    perMinute: number;
  };
  retention: {
    days: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OpenIdData {
  id: string;
  openId: string;
  name?: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendKeyData {
  id: string;
  key: string;
  name: string;
  openIdRef?: string;
  openId?: OpenIdData;
  bindUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface TopicData {
  id: string;
  key: string;
  name: string;
  subscriberCount: number;
  subscriberRefs: string[];
  subscribers?: OpenIdData[];
  subscribeUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageData {
  id: string;
  type: 'single' | 'topic';
  keyId: string;
  keyName?: string;
  title: string;
  content?: string;
  results: {
    openId: string;
    openIdName?: string;
    success: boolean;
    error?: string;
    msgId?: string;
  }[];
  createdAt: string;
}

export interface ChannelTypeInfo {
  type: string;
  name: string;
  description: string;
  configSchema: Record<string, {
    type: 'string' | 'number' | 'boolean';
    label: string;
    required: boolean;
    sensitive?: boolean;
    description?: string;
  }>;
  requiredFields: string[];
}

export function useApi() {
  const auth = useAuthStore();
  const router = useRouter();

  /**
   * Generic request helper with auth and error handling
   */
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    requireAuth = true
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requireAuth) {
      Object.assign(headers, auth.getAuthHeader());
    }

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Handle 401 - redirect to login
      if (res.status === 401) {
        auth.logout();
        router.push('/login');
        return { code: 401, message: '未授权，请重新登录' };
      }

      const data = await res.json();
      return data;
    } catch (error) {
      return { 
        code: -1, 
        message: error instanceof Error ? error.message : '网络请求失败' 
      };
    }
  }

  // ============ Init APIs ============
  
  async function getInitStatus(): Promise<ApiResponse<{ initialized: boolean }>> {
    return request('GET', '/init/status', undefined, false);
  }

  async function doInit(): Promise<ApiResponse<{ adminToken: string }>> {
    return request('POST', '/init', undefined, false);
  }

  async function validateToken(token: string): Promise<ApiResponse<{ valid: boolean }>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
    
    try {
      const res = await fetch(`${API_BASE}/auth/validate`, {
        method: 'POST',
        headers,
      });
      return res.json();
    } catch {
      return { code: -1, message: '验证失败' };
    }
  }

  // ============ Stats APIs ============

  async function getStats(): Promise<ApiResponse<StatsData>> {
    return request('GET', '/stats');
  }

  // ============ Config APIs ============

  async function getConfig(): Promise<ApiResponse<AppConfig>> {
    return request('GET', '/config');
  }

  async function updateConfig(data: Partial<AppConfig>): Promise<ApiResponse<AppConfig>> {
    return request('PUT', '/config', data);
  }

  // ============ SendKey APIs ============

  async function getSendKeys(): Promise<ApiResponse<SendKeyData[]>> {
    return request('GET', '/sendkeys');
  }

  async function getSendKey(id: string): Promise<ApiResponse<SendKeyData>> {
    return request('GET', `/sendkeys/${id}`);
  }

  async function createSendKey(data: { name: string }): Promise<ApiResponse<SendKeyData>> {
    return request('POST', '/sendkeys', data);
  }

  async function updateSendKey(id: string, data: { name?: string; openIdRef?: string | null }): Promise<ApiResponse<SendKeyData>> {
    return request('PUT', `/sendkeys/${id}`, data);
  }

  async function deleteSendKey(id: string): Promise<ApiResponse<void>> {
    return request('DELETE', `/sendkeys/${id}`);
  }

  async function unbindSendKey(id: string): Promise<ApiResponse<SendKeyData>> {
    return request('POST', `/sendkeys/${id}/unbind`);
  }

  // ============ Topic APIs ============

  async function getTopics(): Promise<ApiResponse<TopicData[]>> {
    return request('GET', '/topics');
  }

  async function getTopic(id: string): Promise<ApiResponse<TopicData>> {
    return request('GET', `/topics/${id}`);
  }

  async function createTopic(data: { name: string }): Promise<ApiResponse<TopicData>> {
    return request('POST', '/topics', data);
  }

  async function updateTopic(id: string, data: { name?: string }): Promise<ApiResponse<TopicData>> {
    return request('PUT', `/topics/${id}`, data);
  }

  async function deleteTopic(id: string): Promise<ApiResponse<void>> {
    return request('DELETE', `/topics/${id}`);
  }

  async function unsubscribeTopic(topicId: string, openIdRef: string): Promise<ApiResponse<void>> {
    return request('DELETE', `/topics/${topicId}/subscribe/${openIdRef}`);
  }

  // ============ OpenID APIs ============

  async function getOpenIds(): Promise<ApiResponse<OpenIdData[]>> {
    return request('GET', '/openids');
  }

  async function deleteOpenId(id: string): Promise<ApiResponse<void>> {
    return request('DELETE', `/openids/${id}`);
  }

  // ============ Message APIs ============

  async function getMessages(params?: {
    page?: number;
    pageSize?: number;
    type?: 'single' | 'topic';
  }): Promise<ApiResponse<{ messages: MessageData[]; total: number }>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.type) query.set('type', params.type);
    const queryStr = query.toString();
    return request('GET', `/messages${queryStr ? `?${queryStr}` : ''}`);
  }

  async function getMessage(id: string): Promise<ApiResponse<MessageData>> {
    return request('GET', `/messages/${id}`);
  }

  // ============ Channel Type APIs ============

  async function getChannelTypes(): Promise<ApiResponse<ChannelTypeInfo[]>> {
    return request('GET', '/channels/types', undefined, false);
  }

  return {
    // Init
    getInitStatus,
    doInit,
    validateToken,
    // Stats
    getStats,
    // Config
    getConfig,
    updateConfig,
    // SendKeys
    getSendKeys,
    getSendKey,
    createSendKey,
    updateSendKey,
    deleteSendKey,
    unbindSendKey,
    // Topics
    getTopics,
    getTopic,
    createTopic,
    updateTopic,
    deleteTopic,
    unsubscribeTopic,
    // OpenIDs
    getOpenIds,
    deleteOpenId,
    // Messages
    getMessages,
    getMessage,
    // Channel Types
    getChannelTypes,
  };
}
