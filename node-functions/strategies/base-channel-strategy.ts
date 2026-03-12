/**
 * BaseChannelStrategy - 所有渠道策略的抽象基类
 * 
 * 使用模板方法模式定义统一的发送流程：
 * 1. validateParams - 参数校验
 * 2. getAccessToken - 获取访问令牌（抽象方法）
 * 3. buildMessage - 构建消息体（抽象方法）
 * 4. sendRequest - 发送请求（抽象方法）
 * 5. parseResponse - 解析响应
 * 
 * 性能优化：
 * - 并行发送：多目标时并发推送，提升吞吐量
 * - Token 复用：Token 型渠道只获取一次 Token
 */

import type { Channel } from '../types/channel.js';
import type { PushMessage, PushResult, SendResult, DeliveryResult, ChannelCapability } from './types.js';
import { generatePushId } from '../shared/utils.js';

const MAX_CONCURRENT_SENDS = 10;

export abstract class BaseChannelStrategy {
  protected channel: Channel;

  constructor(channel: Channel) {
    this.channel = channel;
  }

  /**
   * 获取渠道能力类型（抽象方法，子类必须实现）
   */
  abstract getChannelCapability(): ChannelCapability;

  /**
   * 模板方法：发送消息的完整流程
   * 定义了所有渠道必须遵循的发送流程顺序
   * 
   * 性能优化：并行发送多目标消息
   */
  async send(message: PushMessage, targets: string[]): Promise<PushResult> {
    this.validateParams(message);

    if (targets.length === 0) {
      return {
        pushId: generatePushId(),
        total: 0,
        success: 0,
        failed: 0,
        results: [],
      };
    }

    const token = await this.getAccessToken();

    const results = await this.sendWithConcurrency(
      targets,
      (target) => this.sendToTarget(token, message, target),
      MAX_CONCURRENT_SENDS
    );

    let successCount = 0;
    let failedCount = 0;
    for (const result of results) {
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    return {
      pushId: generatePushId(),
      total: targets.length,
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  /**
   * 发送消息到单个目标
   */
  private async sendToTarget(
    token: string,
    message: PushMessage,
    target: string
  ): Promise<DeliveryResult> {
    try {
      const messageBody = this.buildMessage(message, target);
      const result = await this.sendRequest(token, messageBody);
      return {
        openId: target,
        ...result,
      };
    } catch (error) {
      return {
        openId: target,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 并发控制发送
   * 使用正确的并发池模式，限制最大并发数
   */
  private async sendWithConcurrency<T>(
    items: string[],
    processor: (item: string) => Promise<T>,
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing = new Set<Promise<void>>();

    for (const item of items) {
      const promise = processor(item).then((result) => {
        results.push(result);
      }).finally(() => {
        executing.delete(promise);
      });

      executing.add(promise);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * 参数校验（可被子类重写）
   */
  protected validateParams(message: PushMessage): void {
    if (!message.title) {
      throw new Error('Message title is required');
    }
  }

  /**
   * 获取访问令牌（抽象方法，子类必须实现）
   * Token 管理型渠道需要实现 token 获取和缓存逻辑
   * Webhook 型渠道返回空字符串
   */
  protected abstract getAccessToken(): Promise<string>;

  /**
   * 构建消息体（抽象方法，子类必须实现）
   * 根据渠道特定的消息格式构建消息体
   */
  protected abstract buildMessage(message: PushMessage, target: string): any;

  /**
   * 发送请求（抽象方法，子类必须实现）
   * 调用渠道特定的 API 发送消息
   */
  protected abstract sendRequest(token: string, messageBody: any): Promise<SendResult>;

  /**
   * 解析响应（可被子类重写）
   * 默认实现适用于微信类 API 的响应格式
   */
  protected parseResponse(response: any): SendResult {
    return {
      success: response.errcode === 0,
      msgId: response.msgid?.toString(),
      error: response.errmsg,
      errorCode: response.errcode,
    };
  }
}
