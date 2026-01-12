import { openidsKV } from './kv-client.js';
import { generateId, now } from '../shared/utils.js';
import { KVKeys } from '../shared/types.js';

/**
 * OpenIdService - Manages OpenID (WeChat user) records
 */
class OpenIdService {
  /**
   * Create a new OpenID record
   * @param {string} openId - WeChat OpenID
   * @param {string} [name] - Display name
   * @returns {Promise<import('../shared/types.js').OpenIdData>}
   */
  async create(openId, name) {
    // Check if OpenID already exists
    const existing = await this.findByOpenId(openId);
    if (existing) {
      throw new Error('OpenID already exists');
    }

    const id = `oid_${generateId()}`;
    const timestamp = now();

    const data = {
      id,
      openId,
      name: name || undefined,
      source: 'wechat',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Save data and index
    await openidsKV.put(KVKeys.OPENID(id), data);
    await openidsKV.put(KVKeys.OPENID_INDEX(openId), id);

    return data;
  }

  /**
   * Get all OpenID records
   * @returns {Promise<import('../shared/types.js').OpenIdData[]>}
   */
  async list() {
    const result = await openidsKV.listAll('oid:');
    const records = [];

    for (const key of result) {
      const data = await openidsKV.get(key);
      if (data) {
        records.push(data);
      }
    }

    return records;
  }

  /**
   * Get OpenID record by internal ID
   * @param {string} id - Internal ID (oid_xxx)
   * @returns {Promise<import('../shared/types.js').OpenIdData | null>}
   */
  async get(id) {
    return openidsKV.get(KVKeys.OPENID(id));
  }

  /**
   * Find OpenID record by OpenID value
   * @param {string} openId - WeChat OpenID
   * @returns {Promise<import('../shared/types.js').OpenIdData | null>}
   */
  async findByOpenId(openId) {
    const id = await openidsKV.get(KVKeys.OPENID_INDEX(openId));
    if (!id) return null;
    return this.get(id);
  }

  /**
   * Update OpenID record
   * @param {string} id - Internal ID
   * @param {{ name?: string }} updates
   * @returns {Promise<import('../shared/types.js').OpenIdData | null>}
   */
  async update(id, updates) {
    const data = await this.get(id);
    if (!data) return null;

    const updatedData = {
      ...data,
      name: updates.name !== undefined ? updates.name : data.name,
      updatedAt: now(),
    };

    await openidsKV.put(KVKeys.OPENID(id), updatedData);
    return updatedData;
  }

  /**
   * Delete OpenID record
   * Note: Caller should check if OpenID is referenced by SendKeys or Topics
   * @param {string} id - Internal ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const data = await this.get(id);
    if (!data) return false;

    // Delete data and index
    await openidsKV.delete(KVKeys.OPENID(id));
    await openidsKV.delete(KVKeys.OPENID_INDEX(data.openId));

    return true;
  }

  /**
   * Get multiple OpenID records by IDs
   * @param {string[]} ids - Array of internal IDs
   * @returns {Promise<import('../shared/types.js').OpenIdData[]>}
   */
  async getMany(ids) {
    const records = [];
    for (const id of ids) {
      const data = await this.get(id);
      if (data) {
        records.push(data);
      }
    }
    return records;
  }

  /**
   * Check if OpenID is referenced by any SendKey or Topic
   * @param {string} id - Internal ID
   * @param {Object} services - { sendkeyService, topicService }
   * @returns {Promise<{ referenced: boolean, sendkeys: string[], topics: string[] }>}
   */
  async checkReferences(id, services) {
    const { sendkeyService, topicService } = services;
    const sendkeys = [];
    const topics = [];

    // Check SendKeys
    if (sendkeyService) {
      const allSendkeys = await sendkeyService.list();
      for (const sk of allSendkeys) {
        if (sk.openIdRef === id) {
          sendkeys.push(sk.id);
        }
      }
    }

    // Check Topics
    if (topicService) {
      const allTopics = await topicService.list();
      for (const topic of allTopics) {
        if (topic.subscriberRefs?.includes(id)) {
          topics.push(topic.id);
        }
      }
    }

    return {
      referenced: sendkeys.length > 0 || topics.length > 0,
      sendkeys,
      topics,
    };
  }
}

export const openidService = new OpenIdService();
