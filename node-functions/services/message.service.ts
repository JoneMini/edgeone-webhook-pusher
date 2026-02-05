/**
 * Message Service - 消息历史记录管理
 * * 支持按渠道、应用、用户、方向筛选消息历史
 */

import { messagesKV } from '../shared/kv-client.js';
import type { Message, MessageDirection } from '../types/index.js';
import { KVKeys } from '../types/index.js';

interface ListOptions {
  page?: number;
  pageSize?: number;
  channelId?: string;
  appId?: string;
  openId?: string;
  direction?: MessageDirection;
  startDate?: string;
  endDate?: string;
}

interface ListResult {
  messages: Message[];
  total: number;
  page: number;
  pageSize: number;
}

interface Stats {
  total: number;
  today: number;
  inbound: number;
  outbound: number;
  success: number;
  failed: number;
}

class MessageService {
  /**
   * 保存消息记录 (优化版：并行写入)
   */
  async saveMessage(message: Message): Promise<void> {
    // 1. 保存消息本体
    const savePromise = messagesKV.put(KVKeys.MESSAGE(message.id), message);

    // 定义更新列表的辅助函数
    const updateList = async (key: string, msgId: string, limit: number) => {
      const list = (await messagesKV.get<string[]>(key)) || [];
      list.unshift(msgId);
      if (list.length > limit) {
        list.length = limit;
      }
      await messagesKV.put(key, list);
    };

    // 2. 并行更新所有索引列表
    // 将原本串行的 4-5 次 KV 操作合并并发执行
    const updatePromises: Promise<void>[] = [
      savePromise,
      // 更新全局列表
      updateList(KVKeys.MESSAGE_LIST, message.id, 10000)
    ];

    // 更新渠道消息列表
    if (message.channelId) {
      updatePromises.push(updateList(`msg_channel:${message.channelId}`, message.id, 5000));
    }

    // 更新应用消息列表
    if (message.appId) {
      updatePromises.push(updateList(KVKeys.MESSAGE_APP(message.appId), message.id, 5000));
    }

    // 更新用户消息列表
    if (message.openId) {
      updatePromises.push(updateList(`msg_openid:${message.openId}`, message.id, 1000));
    }

    // 等待所有操作完成
    await Promise.all(updatePromises);
  }

  /**
   * 获取消息详情
   */
  async get(id: string): Promise<Message | null> {
    return messagesKV.get<Message>(KVKeys.MESSAGE(id));
  }

  /**
   * 分页查询消息历史
   */
  async list(options: ListOptions = {}): Promise<ListResult> {
    const { page = 1, pageSize = 20, channelId, appId, openId, direction, startDate, endDate } = options;

    // 根据筛选条件选择最优的索引列表
    let ids: string[];
    if (openId) {
      ids = (await messagesKV.get<string[]>(`msg_openid:${openId}`)) || [];
    } else if (appId) {
      ids = (await messagesKV.get<string[]>(KVKeys.MESSAGE_APP(appId))) || [];
    } else if (channelId) {
      ids = (await messagesKV.get<string[]>(`msg_channel:${channelId}`)) || [];
    } else {
      ids = (await messagesKV.get<string[]>(KVKeys.MESSAGE_LIST)) || [];
    }

    // 如果没有其他筛选条件，直接分页返回（最优情况）
    if (!direction && !startDate && !endDate && (!channelId || openId || appId) && (!appId || openId)) {
      const total = ids.length;
      const startIdx = (page - 1) * pageSize;
      const pageIds = ids.slice(startIdx, startIdx + pageSize);
      
      // 并行查询当前页的消息
      const messagePromises = pageIds.map(id => messagesKV.get<Message>(KVKeys.MESSAGE(id)));
      const messageResults = await Promise.all(messagePromises);
      
      const messages: Message[] = [];
      for (const data of messageResults) {
        if (data) {
          messages.push(data);
        }
      }
      
      return { messages, total, page, pageSize };
    }

    // 有额外筛选条件时，分批并行查询
    const batchSize = 50; // 并发度控制
    const allMessages: Message[] = [];
    
    // 分批处理防止并发过高
    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const batchPromises = batchIds.map(id => messagesKV.get<Message>(KVKeys.MESSAGE(id)));
      const batchResults = await Promise.all(batchPromises);
      
      for (const data of batchResults) {
        if (data) {
          allMessages.push(data);
        }
      }
    }

    // 筛选逻辑保持不变
    let filtered = allMessages;

    // 按渠道筛选（如果不是通过渠道索引获取的）
    if (channelId && !openId && !appId) {
      // 已经通过渠道索引获取，无需再筛选
    } else if (channelId) {
      filtered = filtered.filter((m) => m.channelId === channelId);
    }

    // 按应用筛选（如果不是通过应用索引获取的）
    if (appId && openId) {
      filtered = filtered.filter((m) => m.appId === appId);
    }

    // 按方向筛选
    if (direction) {
      filtered = filtered.filter((m) => m.direction === direction);
    }

    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter((m) => new Date(m.createdAt) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      filtered = filtered.filter((m) => new Date(m.createdAt) <= end);
    }

    // 按时间倒序排序
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 分页
    const total = filtered.length;
    const startIdx = (page - 1) * pageSize;
    const messages = filtered.slice(startIdx, startIdx + pageSize);

    return { messages, total, page, pageSize };
  }

  /**
   * 按应用获取消息列表
   */
  async listByApp(appId: string, options: Omit<ListOptions, 'appId'> = {}): Promise<ListResult> {
    return this.list({ ...options, appId });
  }

  /**
   * 按渠道获取消息列表
   */
  async listByChannel(channelId: string, options: Omit<ListOptions, 'channelId'> = {}): Promise<ListResult> {
    return this.list({ ...options, channelId });
  }

  /**
   * 按用户获取消息列表
   */
  async listByOpenId(openId: string, options: Omit<ListOptions, 'openId'> = {}): Promise<ListResult> {
    return this.list({ ...options, openId });
  }

  /**
   * 删除消息记录
   */
  async delete(id: string): Promise<boolean> {
    const data = await this.get(id);
    if (!data) return false;

    await messagesKV.delete(KVKeys.MESSAGE(id));
    return true;
  }

  /**
   * 清理过期记录
   */
  async cleanup(retentionDays = 30): Promise<number> {
    const keys = await messagesKV.listAll(KVKeys.MESSAGE_PREFIX);
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let count = 0;

    for (const key of keys) {
      const data = await messagesKV.get<Message>(key);
      if (data && new Date(data.createdAt) < cutoff) {
        await messagesKV.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * 获取统计数据 (优化版：并发获取)
   */
  async getStats(): Promise<Stats> {
    const keys = await messagesKV.listAll(KVKeys.MESSAGE_PREFIX);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let total = 0;
    let todayCount = 0;
    let inbound = 0;
    let outbound = 0;
    let success = 0;
    let failed = 0;

    // 分批并发处理，每批 50 条并发，避免爆内存或超时
    const batchSize = 50;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batchKeys = keys.slice(i, i + batchSize);
      // 并发获取详情
      const batchPromises = batchKeys.map(key => messagesKV.get<Message>(key));
      const messages = await Promise.all(batchPromises);

      for (const data of messages) {
        if (!data) continue;
        
        total++;

        if (new Date(data.createdAt) >= today) {
          todayCount++;
        }

        if (data.direction === 'inbound') {
          inbound++;
        } else {
          outbound++;
        }

        if (data.results) {
          for (const r of data.results) {
            if (r.success) {
              success++;
            } else {
              failed++;
            }
          }
        }
      }
    }

    return { total, today: todayCount, inbound, outbound, success, failed };
  }
}

export const messageService = new MessageService();
