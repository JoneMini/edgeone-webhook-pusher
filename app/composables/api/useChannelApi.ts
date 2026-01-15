/**
 * 渠道 API
 */

import type { ApiResponse, Channel, CreateChannelInput, UpdateChannelInput } from '~/types';
import { useRequest } from './useRequest';

export function useChannelApi() {
  const { get, post, put, del } = useRequest();

  /**
   * 获取渠道列表
   */
  function getChannels(): Promise<ApiResponse<Channel[]>> {
    return get<Channel[]>('/channels');
  }

  /**
   * 获取渠道详情
   */
  function getChannel(id: string): Promise<ApiResponse<Channel>> {
    return get<Channel>(`/channels/${id}`);
  }

  /**
   * 创建渠道
   */
  function createChannel(data: CreateChannelInput): Promise<ApiResponse<Channel>> {
    return post<Channel>('/channels', data);
  }

  /**
   * 更新渠道
   */
  function updateChannel(id: string, data: UpdateChannelInput): Promise<ApiResponse<Channel>> {
    return put<Channel>(`/channels/${id}`, data);
  }

  /**
   * 删除渠道
   */
  function deleteChannel(id: string): Promise<ApiResponse<void>> {
    return del<void>(`/channels/${id}`);
  }

  return {
    getChannels,
    getChannel,
    createChannel,
    updateChannel,
    deleteChannel,
  };
}
