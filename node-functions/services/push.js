/**
 * Push Service - Handles message pushing via SendKey and Topic
 * Feature: multi-tenant-refactor
 *
 * Supports multiple channels through the channel registry.
 * Currently implements WeChat template messages, extensible for future channels.
 */

import { sendkeyService } from './sendkey.js';
import { topicService } from './topic.js';
import { openidService } from './openid.js';
import { configService } from './config.js';
import { messageService } from './message.js';
import { sendViaChannel, getChannelAdapter } from '../shared/channels/registry.js';
import { generatePushId } from '../shared/utils.js';
import { ErrorCodes } from '../shared/types.js';

// Default channel type (can be extended to support multiple channels)
const DEFAULT_CHANNEL = 'wechat-template';

/**
 * Push Service
 */
export const pushService = {
  /**
   * Push message via SendKey (single recipient)
   * @param {string} sendKey - The SendKey value
   * @param {string} title - Message title
   * @param {string} [desp] - Message description/content
   * @returns {Promise<import('../shared/types.js').PushResult>}
   */
  async pushBySendKey(sendKey, title, desp) {
    const pushId = generatePushId();
    const createdAt = new Date().toISOString();

    // Find SendKey
    const sendKeyData = await sendkeyService.findByKey(sendKey);
    if (!sendKeyData) {
      return {
        pushId,
        success: false,
        error: ErrorCodes.KEY_NOT_FOUND,
      };
    }

    // Check rate limit
    const rateLimitOk = await sendkeyService.checkRateLimit(sendKeyData.id);
    if (!rateLimitOk) {
      return {
        pushId,
        success: false,
        error: ErrorCodes.RATE_LIMIT_EXCEEDED,
      };
    }

    // Get OpenID data
    const openIdData = await openidService.get(sendKeyData.openIdRef);
    if (!openIdData) {
      return {
        pushId,
        success: false,
        error: ErrorCodes.OPENID_NOT_FOUND,
      };
    }

    // Get channel credentials from config
    const credentials = await this.getChannelCredentials(openIdData.openId);
    if (!credentials) {
      return {
        pushId,
        success: false,
        error: ErrorCodes.INVALID_CONFIG,
      };
    }

    // Send message via channel
    const message = {
      id: pushId,
      title,
      content: desp,
      createdAt,
    };

    const result = await sendViaChannel(DEFAULT_CHANNEL, message, credentials);

    // Increment rate limit counter (regardless of success)
    await sendkeyService.incrementRateLimit(sendKeyData.id);

    // Save message history
    await messageService.save({
      id: pushId,
      type: 'single',
      keyId: sendKeyData.id,
      title,
      content: desp,
      results: [
        {
          openId: openIdData.openId,
          success: result.success,
          error: result.error,
          msgId: result.externalId,
        },
      ],
      createdAt,
    });

    return {
      pushId,
      success: result.success,
      error: result.error,
      msgId: result.externalId,
    };
  },

  /**
   * Push message via TopicKey (multiple recipients)
   * @param {string} topicKey - The TopicKey value
   * @param {string} title - Message title
   * @param {string} [desp] - Message description/content
   * @returns {Promise<import('../shared/types.js').TopicPushResult>}
   */
  async pushByTopicKey(topicKey, title, desp) {
    const pushId = generatePushId();
    const createdAt = new Date().toISOString();

    // Find Topic
    const topicData = await topicService.findByKey(topicKey);
    if (!topicData) {
      return {
        pushId,
        total: 0,
        success: 0,
        failed: 0,
        results: [],
        error: ErrorCodes.KEY_NOT_FOUND,
      };
    }

    // Check rate limit
    const rateLimitOk = await topicService.checkRateLimit(topicData.id);
    if (!rateLimitOk) {
      return {
        pushId,
        total: 0,
        success: 0,
        failed: 0,
        results: [],
        error: ErrorCodes.RATE_LIMIT_EXCEEDED,
      };
    }

    // Get subscribers
    const subscribers = await topicService.getSubscribers(topicData.id);
    if (subscribers.length === 0) {
      return {
        pushId,
        total: 0,
        success: 0,
        failed: 0,
        results: [],
        error: ErrorCodes.NO_SUBSCRIBERS,
      };
    }

    // Get base channel config
    const config = await configService.getConfig();
    if (!config?.wechat?.appId || !config?.wechat?.appSecret || !config?.wechat?.templateId) {
      return {
        pushId,
        total: subscribers.length,
        success: 0,
        failed: subscribers.length,
        results: subscribers.map((s) => ({
          openId: s.openId,
          success: false,
          error: 'Channel not configured',
        })),
      };
    }

    // Send to all subscribers (continue on partial failure)
    const message = {
      id: pushId,
      title,
      content: desp,
      createdAt,
    };

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // Process subscribers sequentially to avoid rate limiting
    for (const subscriber of subscribers) {
      const credentials = {
        appId: config.wechat.appId,
        appSecret: config.wechat.appSecret,
        templateId: config.wechat.templateId,
        openId: subscriber.openId,
      };

      const result = await sendViaChannel(DEFAULT_CHANNEL, message, credentials);

      results.push({
        openId: subscriber.openId,
        success: result.success,
        error: result.error,
        msgId: result.externalId,
      });

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    // Increment rate limit counter
    await topicService.incrementRateLimit(topicData.id);

    // Save message history
    await messageService.save({
      id: pushId,
      type: 'topic',
      keyId: topicData.id,
      title,
      content: desp,
      results,
      createdAt,
    });

    return {
      pushId,
      total: subscribers.length,
      success: successCount,
      failed: failedCount,
      results,
    };
  },

  /**
   * Get channel credentials for a specific OpenID
   * @param {string} openId - Target OpenID
   * @returns {Promise<Object|null>}
   */
  async getChannelCredentials(openId) {
    const config = await configService.getConfig();

    if (!config?.wechat?.appId || !config?.wechat?.appSecret || !config?.wechat?.templateId) {
      return null;
    }

    return {
      appId: config.wechat.appId,
      appSecret: config.wechat.appSecret,
      templateId: config.wechat.templateId,
      openId,
    };
  },

  /**
   * Get supported channels
   * @returns {Object[]}
   */
  getSupportedChannels() {
    const adapter = getChannelAdapter(DEFAULT_CHANNEL);
    if (!adapter) return [];

    return [
      {
        type: adapter.type,
        name: adapter.name,
        description: adapter.description,
      },
    ];
  },

  /**
   * Validate channel configuration
   * @returns {Promise<{ valid: boolean, error?: string }>}
   */
  async validateChannelConfig() {
    const config = await configService.getConfig();

    if (!config?.wechat?.appId || !config?.wechat?.appSecret || !config?.wechat?.templateId) {
      return { valid: false, error: 'WeChat configuration incomplete' };
    }

    const adapter = getChannelAdapter(DEFAULT_CHANNEL);
    if (!adapter?.validate) {
      return { valid: true };
    }

    return adapter.validate({
      appId: config.wechat.appId,
      appSecret: config.wechat.appSecret,
      templateId: config.wechat.templateId,
    });
  },
};
