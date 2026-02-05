/**
 * Push Service - 消息推送核心逻辑
 * * 基于 App 配置处理推送逻辑：
 * - single 模式：发送给第一个绑定的 OpenID
 * - subscribe 模式：发送给所有绑定的 OpenID
 * - normal 消息类型：发送客服消息
 * - template 消息类型：发送模板消息
 */

import { appService } from './app.service.js';
import { openidService } from './openid.service.js';
import { channelService } from './channel.service.js';
import { messageService } from './message.service.js';
import { wechatService } from './wechat.service.js';
import { generatePushId, now } from '../shared/utils.js';
import type { PushResult, PushMessageInput, DeliveryResult, Message } from '../types/index.js';
import { PushModes, MessageTypes } from '../types/index.js';

class PushService {
  /**
   * 通过 App Key 发送消息
   */
  async push(appKey: string, message: PushMessageInput): Promise<PushResult> {
    const pushId = generatePushId();
    const createdAt = now();

    // 1. 查找 App (优先走内存缓存)
    const app = await appService.getByKey(appKey);
    if (!app) {
      return {
        pushId,
        total: 0,
        success: 0,
        failed: 0,
        results: [],
      };
    }

    // 2. 并行获取 OpenID 列表 和 渠道配置 (关键优化点)
    // 减少一次完整的 KV 网络往返时间
    const [openIds, channel] = await Promise.all([
      openidService.listByApp(app.id),
      channelService.getById(app.channelId)
    ]);

    if (openIds.length === 0 || !channel) {
      return {
        pushId,
        total: 0,
        success: 0,
        failed: 0,
        results: [],
      };
    }

    // 根据推送模式确定目标 OpenID
    let targetOpenIds = openIds;
    if (app.pushMode === PushModes.SINGLE) {
      // 单发模式：只发送给第一个 OpenID
      targetOpenIds = [openIds[0]];
    }

    // 3. 并发发送消息到微信
    // 使用 Promise.all 替代串行 for...of 循环，大幅降低群发耗时
    const pushPromises = targetOpenIds.map(async (openIdRecord) => {
      try {
        let result: { success: boolean; msgId?: string; error?: string };
        
        if (app.messageType === MessageTypes.TEMPLATE && app.templateId) {
          // 发送模板消息
          const templateData = {
            first: { value: message.title || '' },
            keyword1: { value: message.desp || '' },
            remark: { value: '' },
          };
          result = await wechatService.sendTemplateMessage(
            channel,
            openIdRecord.openId,
            app.templateId,
            templateData
          );
        } else {
          // 发送客服消息
          const content = message.desp
            ? `${message.title}\n\n${message.desp}`
            : message.title;
          result = await wechatService.sendCustomMessage(
            channel,
            openIdRecord.openId,
            content
          );
        }

        return {
          openId: openIdRecord.openId,
          success: result.success,
          msgId: result.msgId,
          error: result.error,
        } as DeliveryResult;

      } catch (error) {
        return {
          openId: openIdRecord.openId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        } as DeliveryResult;
      }
    });

    const results = await Promise.all(pushPromises);
    
    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    // 4. 保存消息历史
    // messageService.saveMessage 内部已优化为并行写入
    const messageRecord: Message = {
      id: pushId,
      direction: 'outbound',
      type: 'push',
      channelId: channel.id,
      appId: app.id,
      title: message.title,
      desp: message.desp,
      results,
      createdAt,
    };
    await messageService.saveMessage(messageRecord);

    return {
      pushId,
      total: targetOpenIds.length,
      success: successCount,
      failed: failedCount,
      results,
    };
  }
}

export const pushService = new PushService();
