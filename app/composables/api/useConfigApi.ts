/**
 * 配置 API
 */

import type { ApiResponse, SystemConfig, ResetTokenResult } from '~/types';
import { useRequest } from './useRequest';

export function useConfigApi() {
  const { get, put, post } = useRequest();

  /**
   * 获取系统配置
   */
  function getConfig(): Promise<ApiResponse<SystemConfig>> {
    return get<SystemConfig>('/config');
  }

  /**
   * 更新系统配置
   */
  function updateConfig(data: Partial<SystemConfig>): Promise<ApiResponse<SystemConfig>> {
    return put<SystemConfig>('/config', data);
  }

  /**
   * 重置管理员令牌
   */
  function resetAdminToken(): Promise<ApiResponse<ResetTokenResult>> {
    return post<ResetTokenResult>('/config/reset-token');
  }

  return {
    getConfig,
    updateConfig,
    resetAdminToken,
  };
}
