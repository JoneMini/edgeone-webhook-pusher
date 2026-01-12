/**
 * Message Service - Handles message history storage and retrieval
 * Feature: multi-tenant-refactor
 */

import { messagesKV } from './kv-client.js';
import { KVKeys } from '../shared/types.js';

/**
 * Message Service
 */
export const messageService = {
  /**
   * Save a message to history
   * @param {Object} message - Message data
   * @param {string} message.id - Push ID
   * @param {'single' | 'topic'} message.type - Message type
   * @param {string} message.keyId - SendKey ID or Topic ID
   * @param {string} message.title - Message title
   * @param {string} [message.content] - Message content
   * @param {Array} message.results - Delivery results
   * @param {string} message.createdAt - Creation timestamp
   * @returns {Promise<void>}
   */
  async save(message) {
    // Save message data
    const key = `${KVKeys.MESSAGE_PREFIX}${message.id}`;
    await messagesKV.put(key, message);

    // Update message list index (prepend to maintain reverse chronological order)
    const listKey = KVKeys.MESSAGE_LIST;
    const list = (await messagesKV.get(listKey)) || [];

    // Add new message ID to the beginning
    list.unshift({
      id: message.id,
      type: message.type,
      keyId: message.keyId,
      createdAt: message.createdAt,
    });

    // Trim list if too long (keep last 1000 entries)
    if (list.length > 1000) {
      list.length = 1000;
    }

    await messagesKV.put(listKey, list);
  },

  /**
   * Get a message by ID
   * @param {string} pushId - Push ID
   * @returns {Promise<Object | null>}
   */
  async get(pushId) {
    const key = `${KVKeys.MESSAGE_PREFIX}${pushId}`;
    return await messagesKV.get(key);
  },

  /**
   * List messages with pagination
   * @param {Object} [params] - Query parameters
   * @param {'single' | 'topic'} [params.type] - Filter by type
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.pageSize=20] - Items per page
   * @returns {Promise<{ messages: Array, total: number, page: number, pageSize: number }>}
   */
  async list(params = {}) {
    const { type, page = 1, pageSize = 20 } = params;

    // Get message list index
    const listKey = KVKeys.MESSAGE_LIST;
    let list = (await messagesKV.get(listKey)) || [];

    // Filter by type if specified
    if (type) {
      list = list.filter((item) => item.type === type);
    }

    const total = list.length;

    // Calculate pagination
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = list.slice(start, end);

    // Fetch full message data for the page
    const messages = [];
    for (const item of pageItems) {
      const message = await this.get(item.id);
      if (message) {
        messages.push(message);
      }
    }

    return {
      messages,
      total,
      page,
      pageSize,
    };
  },

  /**
   * Delete a message
   * @param {string} pushId - Push ID
   * @returns {Promise<boolean>}
   */
  async delete(pushId) {
    const key = `${KVKeys.MESSAGE_PREFIX}${pushId}`;
    const message = await messagesKV.get(key);

    if (!message) {
      return false;
    }

    // Delete message data
    await messagesKV.delete(key);

    // Remove from list index
    const listKey = KVKeys.MESSAGE_LIST;
    const list = (await messagesKV.get(listKey)) || [];
    const newList = list.filter((item) => item.id !== pushId);
    await messagesKV.put(listKey, newList);

    return true;
  },

  /**
   * Clean up old messages based on retention policy
   * @param {number} retentionDays - Number of days to retain messages
   * @returns {Promise<number>} - Number of messages deleted
   */
  async cleanup(retentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTime = cutoffDate.toISOString();

    // Get message list
    const listKey = KVKeys.MESSAGE_LIST;
    const list = (await messagesKV.get(listKey)) || [];

    // Find messages to delete
    const toDelete = list.filter((item) => item.createdAt < cutoffTime);
    const toKeep = list.filter((item) => item.createdAt >= cutoffTime);

    // Delete old messages
    for (const item of toDelete) {
      const key = `${KVKeys.MESSAGE_PREFIX}${item.id}`;
      await messagesKV.delete(key);
    }

    // Update list
    await messagesKV.put(listKey, toKeep);

    return toDelete.length;
  },
};
