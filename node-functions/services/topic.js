import { topicsKV } from './kv-client.js';
import { generateId, generateTopicKey, now, createRateLimitState, checkRateLimit } from '../shared/utils.js';
import { KVKeys } from '../shared/types.js';
import { configService } from './config.js';
import { openidService } from './openid.js';

/**
 * TopicService - Manages Topic records for group messaging
 */
class TopicService {
  /**
   * Create a new Topic
   * @param {string} name - Display name
   * @returns {Promise<import('../shared/types.js').TopicData>}
   */
  async create(name) {
    const id = `tp_${generateId()}`;
    const key = generateTopicKey();
    const timestamp = now();

    const data = {
      id,
      key,
      name,
      subscriberRefs: [],
      rateLimit: createRateLimitState(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Save data and index
    await topicsKV.put(KVKeys.TOPIC(id), data);
    await topicsKV.put(KVKeys.TOPIC_INDEX(key), id);

    return data;
  }

  /**
   * Get all Topic records
   * @returns {Promise<import('../shared/types.js').TopicData[]>}
   */
  async list() {
    const result = await topicsKV.listAll('tp:');
    const records = [];

    for (const kvKey of result) {
      const data = await topicsKV.get(kvKey);
      if (data) {
        records.push(data);
      }
    }

    return records;
  }

  /**
   * Get Topic record by internal ID
   * @param {string} id - Internal ID (tp_xxx)
   * @returns {Promise<import('../shared/types.js').TopicData | null>}
   */
  async get(id) {
    return topicsKV.get(KVKeys.TOPIC(id));
  }

  /**
   * Find Topic record by key value
   * @param {string} key - TopicKey value (TPKxxx)
   * @returns {Promise<import('../shared/types.js').TopicData | null>}
   */
  async findByKey(key) {
    const id = await topicsKV.get(KVKeys.TOPIC_INDEX(key));
    if (!id) return null;
    return this.get(id);
  }

  /**
   * Update Topic record
   * @param {string} id - Internal ID
   * @param {{ name?: string }} updates
   * @returns {Promise<import('../shared/types.js').TopicData | null>}
   */
  async update(id, updates) {
    const data = await this.get(id);
    if (!data) return null;

    const updatedData = {
      ...data,
      name: updates.name !== undefined ? updates.name : data.name,
      updatedAt: now(),
    };

    await topicsKV.put(KVKeys.TOPIC(id), updatedData);
    return updatedData;
  }

  /**
   * Delete Topic record
   * @param {string} id - Internal ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const data = await this.get(id);
    if (!data) return false;

    // Delete data and index
    await topicsKV.delete(KVKeys.TOPIC(id));
    await topicsKV.delete(KVKeys.TOPIC_INDEX(data.key));

    return true;
  }

  /**
   * Add subscriber to Topic
   * @param {string} id - Topic internal ID
   * @param {string} openIdRef - OpenID record ID to subscribe
   * @returns {Promise<boolean>}
   */
  async subscribe(id, openIdRef) {
    const data = await this.get(id);
    if (!data) return false;

    // Check if already subscribed
    if (data.subscriberRefs.includes(openIdRef)) {
      return true; // Already subscribed
    }

    const updatedData = {
      ...data,
      subscriberRefs: [...data.subscriberRefs, openIdRef],
      updatedAt: now(),
    };

    await topicsKV.put(KVKeys.TOPIC(id), updatedData);
    return true;
  }

  /**
   * Remove subscriber from Topic
   * @param {string} id - Topic internal ID
   * @param {string} openIdRef - OpenID record ID to unsubscribe
   * @returns {Promise<boolean>}
   */
  async unsubscribe(id, openIdRef) {
    const data = await this.get(id);
    if (!data) return false;

    // Check if subscribed
    if (!data.subscriberRefs.includes(openIdRef)) {
      return true; // Not subscribed
    }

    const updatedData = {
      ...data,
      subscriberRefs: data.subscriberRefs.filter((ref) => ref !== openIdRef),
      updatedAt: now(),
    };

    await topicsKV.put(KVKeys.TOPIC(id), updatedData);
    return true;
  }

  /**
   * Get subscribers of a Topic (returns OpenIdData)
   * @param {string} id - Topic internal ID
   * @returns {Promise<import('../shared/types.js').OpenIdData[]>}
   */
  async getSubscribers(id) {
    const data = await this.get(id);
    if (!data) return [];

    return openidService.getMany(data.subscriberRefs);
  }

  /**
   * Get subscriber count for a Topic
   * @param {string} id - Topic internal ID
   * @returns {Promise<number>}
   */
  async getSubscriberCount(id) {
    const data = await this.get(id);
    if (!data) return 0;
    return data.subscriberRefs.length;
  }

  /**
   * Check and update rate limit for a Topic
   * @param {string} id - Internal ID
   * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: string }>}
   */
  async checkAndUpdateRateLimit(id) {
    const data = await this.get(id);
    if (!data) {
      throw new Error('Topic not found');
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
      await topicsKV.put(KVKeys.TOPIC(id), updatedData);
    }

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: result.resetAt,
    };
  }

  /**
   * Remove OpenID reference from all Topics (used when deleting OpenID)
   * @param {string} openIdRef - OpenID record ID
   * @returns {Promise<number>} - Number of topics updated
   */
  async removeOpenIdFromAllTopics(openIdRef) {
    const topics = await this.list();
    let count = 0;

    for (const topic of topics) {
      if (topic.subscriberRefs.includes(openIdRef)) {
        await this.unsubscribe(topic.id, openIdRef);
        count++;
      }
    }

    return count;
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
    await topicsKV.put(KVKeys.TOPIC(id), updatedData);
  }

  /**
   * Mask TopicKey value for API response
   * @param {import('../shared/types.js').TopicData} data
   * @returns {Object}
   */
  maskTopicKey(data) {
    return {
      ...data,
      key: data.key ? `${data.key.slice(0, 7)}***${data.key.slice(-4)}` : undefined,
    };
  }
}

export const topicService = new TopicService();
