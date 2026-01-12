import { sendkeysKV } from './kv-client.js';
import { generateId, generateSendKey, now, createRateLimitState, checkRateLimit } from '../shared/utils.js';
import { KVKeys } from '../shared/types.js';
import { configService } from './config.js';

/**
 * SendKeyService - Manages SendKey records for single-target messaging
 */
class SendKeyService {
  /**
   * Create a new SendKey
   * @param {string} name - Display name
   * @param {string} openIdRef - Reference to OpenID record ID
   * @returns {Promise<import('../shared/types.js').SendKeyData>}
   */
  async create(name, openIdRef) {
    const id = `sk_${generateId()}`;
    const key = generateSendKey();
    const timestamp = now();

    const data = {
      id,
      key,
      name,
      openIdRef,
      rateLimit: createRateLimitState(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Save data and index
    await sendkeysKV.put(KVKeys.SENDKEY(id), data);
    await sendkeysKV.put(KVKeys.SENDKEY_INDEX(key), id);

    return data;
  }

  /**
   * Get all SendKey records
   * @returns {Promise<import('../shared/types.js').SendKeyData[]>}
   */
  async list() {
    const result = await sendkeysKV.listAll('sk:');
    const records = [];

    for (const kvKey of result) {
      const data = await sendkeysKV.get(kvKey);
      if (data) {
        records.push(data);
      }
    }

    return records;
  }

  /**
   * Get SendKey record by internal ID
   * @param {string} id - Internal ID (sk_xxx)
   * @returns {Promise<import('../shared/types.js').SendKeyData | null>}
   */
  async get(id) {
    return sendkeysKV.get(KVKeys.SENDKEY(id));
  }

  /**
   * Find SendKey record by key value
   * @param {string} key - SendKey value (SCTxxx)
   * @returns {Promise<import('../shared/types.js').SendKeyData | null>}
   */
  async findByKey(key) {
    const id = await sendkeysKV.get(KVKeys.SENDKEY_INDEX(key));
    if (!id) return null;
    return this.get(id);
  }

  /**
   * Update SendKey record
   * @param {string} id - Internal ID
   * @param {{ name?: string, openIdRef?: string }} updates
   * @returns {Promise<import('../shared/types.js').SendKeyData | null>}
   */
  async update(id, updates) {
    const data = await this.get(id);
    if (!data) return null;

    const updatedData = {
      ...data,
      name: updates.name !== undefined ? updates.name : data.name,
      openIdRef: updates.openIdRef !== undefined ? updates.openIdRef : data.openIdRef,
      updatedAt: now(),
    };

    await sendkeysKV.put(KVKeys.SENDKEY(id), updatedData);
    return updatedData;
  }

  /**
   * Delete SendKey record
   * @param {string} id - Internal ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const data = await this.get(id);
    if (!data) return false;

    // Delete data and index
    await sendkeysKV.delete(KVKeys.SENDKEY(id));
    await sendkeysKV.delete(KVKeys.SENDKEY_INDEX(data.key));

    return true;
  }

  /**
   * Check and update rate limit for a SendKey
   * @param {string} id - Internal ID
   * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: string }>}
   */
  async checkAndUpdateRateLimit(id) {
    const data = await this.get(id);
    if (!data) {
      throw new Error('SendKey not found');
    }

    const limit = await configService.getRateLimitPerMinute();
    const result = checkRateLimit(data.rateLimit, limit);

    if (result.allowed) {
      // Update rate limit state
      const updatedData = {
        ...data,
        rateLimit: {
          count: result.newCount,
          resetAt: result.resetAt,
        },
      };
      await sendkeysKV.put(KVKeys.SENDKEY(id), updatedData);
    }

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: result.resetAt,
    };
  }

  /**
   * Check if rate limit allows sending (without incrementing)
   * @param {string} id - Internal ID
   * @returns {Promise<boolean>}
   */
  async checkRateLimit(id) {
    const data = await this.get(id);
    if (!data) return false;

    const limit = await configService.getRateLimitPerMinute();
    const result = checkRateLimit(data.rateLimit, limit);
    return result.allowed;
  }

  /**
   * Increment rate limit counter after successful send
   * @param {string} id - Internal ID
   * @returns {Promise<void>}
   */
  async incrementRateLimit(id) {
    const data = await this.get(id);
    if (!data) return;

    const limit = await configService.getRateLimitPerMinute();
    const result = checkRateLimit(data.rateLimit, limit);

    const updatedData = {
      ...data,
      rateLimit: {
        count: result.newCount,
        resetAt: result.resetAt,
      },
    };
    await sendkeysKV.put(KVKeys.SENDKEY(id), updatedData);
  }

  /**
   * Mask SendKey value for API response
   * @param {import('../shared/types.js').SendKeyData} data
   * @returns {Object}
   */
  maskSendKey(data) {
    return {
      ...data,
      key: data.key ? `${data.key.slice(0, 7)}***${data.key.slice(-4)}` : undefined,
    };
  }
}

export const sendkeyService = new SendKeyService();
