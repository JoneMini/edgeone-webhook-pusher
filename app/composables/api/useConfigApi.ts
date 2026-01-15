/**
 * 配置 API
 */

import type { ApiResponse, SystemConfig } from '~/types';
import { useRequest } from './useRequest';

export function useConfigApi() {
  const { get, put } = useRequest();

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

  return {
    getConfig,
    updateConfig,
  };
}
