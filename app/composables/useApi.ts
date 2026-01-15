/**
 * API Composable
 * Feature: system-restructure
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
  channelCount: number;
  appCount: number;
  messageCount: number;
  recentMessages: {
    id: string;
    title: string;
    appId: string;
    success: boolean;
    createdAt: string;
  }[];
}

export interface AppConfig {
  createdAt: string;
  updatedAt: string;
}

// Channel types
export interface ChannelData {
  id: string;
  name: string;
  type: 'wechat';
  config: {
    appId: string;
    appSecret: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelInput {
  name: string;
  type: 'wechat';
  config: {
    appId: string;
    appSecret: string;
  };
}

export interface UpdateChannelInput {
  name?: string;
  config?: {
    appId?: string;
    appSecret?: string;
  };
}


// App types
export interface AppData {
  id: string;
  key: string;
  name: string;
  channelId: string;
  pushMode: 'single' | 'subscribe';
  messageType: 'normal' | 'template';
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppInput {
  name: string;
  channelId: string;
  pushMode: 'single' | 'subscribe';
  messageType: 'normal' | 'template';
  templateId?: string;
}

export interface UpdateAppInput {
  name?: string;
  templateId?: string;
}

// OpenID types
export interface OpenIdData {
  id: string;
  appId: string;
  openId: string;
  nickname?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpenIdInput {
  openId: string;
  nickname?: string;
  remark?: string;
}

export interface UpdateOpenIdInput {
  nickname?: string;
  remark?: string;
}

// Message types
export interface MessageData {
  id: string;
  appId: string;
  appName?: string;
  title: string;
  content?: string;
  pushMode: 'single' | 'subscribe';
  results: {
    openId: string;
    nickname?: string;
    success: boolean;
    error?: string;
    msgId?: string;
  }[];
  createdAt: string;
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

  // ============ Channel APIs ============

  async function getChannels(): Promise<ApiResponse<ChannelData[]>> {
    return request('GET', '/channels');
  }

  async function getChannel(id: string): Promise<ApiResponse<ChannelData>> {
    return request('GET', `/channels/${id}`);
  }

  async function createChannel(data: CreateChannelInput): Promise<ApiResponse<ChannelData>> {
    return request('POST', '/channels', data);
  }

  async function updateChannel(id: string, data: UpdateChannelInput): Promise<ApiResponse<ChannelData>> {
    return request('PUT', `/channels/${id}`, data);
  }

  async function deleteChannel(id: string): Promise<ApiResponse<void>> {
    return request('DELETE', `/channels/${id}`);
  }

  // ============ App APIs ============

  async function getApps(): Promise<ApiResponse<AppData[]>> {
    return request('GET', '/apps');
  }

  async function getApp(id: string): Promise<ApiResponse<AppData>> {
    return request('GET', `/apps/${id}`);
  }

  async function createApp(data: CreateAppInput): Promise<ApiResponse<AppData>> {
    return request('POST', '/apps', data);
  }

  async function updateApp(id: string, data: UpdateAppInput): Promise<ApiResponse<AppData>> {
    return request('PUT', `/apps/${id}`, data);
  }

  async function deleteApp(id: string): Promise<ApiResponse<void>> {
    return request('DELETE', `/apps/${id}`);
  }

  // ============ OpenID APIs (nested under apps) ============

  async function getAppOpenIds(appId: string): Promise<ApiResponse<OpenIdData[]>> {
    return request('GET', `/apps/${appId}/openids`);
  }

  async function getAppOpenId(appId: string, openIdId: string): Promise<ApiResponse<OpenIdData>> {
    return request('GET', `/apps/${appId}/openids/${openIdId}`);
  }

  async function createAppOpenId(appId: string, data: CreateOpenIdInput): Promise<ApiResponse<OpenIdData>> {
    return request('POST', `/apps/${appId}/openids`, data);
  }

  async function updateAppOpenId(appId: string, openIdId: string, data: UpdateOpenIdInput): Promise<ApiResponse<OpenIdData>> {
    return request('PUT', `/apps/${appId}/openids/${openIdId}`, data);
  }

  async function deleteAppOpenId(appId: string, openIdId: string): Promise<ApiResponse<void>> {
    return request('DELETE', `/apps/${appId}/openids/${openIdId}`);
  }

  // ============ Message APIs ============

  async function getMessages(params?: {
    page?: number;
    pageSize?: number;
    appId?: string;
  }): Promise<ApiResponse<MessageData[]> & { pagination?: { total: number; page: number; pageSize: number } }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.appId) query.set('appId', params.appId);
    const queryStr = query.toString();
    return request('GET', `/messages${queryStr ? `?${queryStr}` : ''}`);
  }

  async function getMessage(id: string): Promise<ApiResponse<MessageData>> {
    return request('GET', `/messages/${id}`);
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
    // Channels
    getChannels,
    getChannel,
    createChannel,
    updateChannel,
    deleteChannel,
    // Apps
    getApps,
    getApp,
    createApp,
    updateApp,
    deleteApp,
    // OpenIDs (nested under apps)
    getAppOpenIds,
    getAppOpenId,
    createAppOpenId,
    updateAppOpenId,
    deleteAppOpenId,
    // Messages
    getMessages,
    getMessage,
  };
}
