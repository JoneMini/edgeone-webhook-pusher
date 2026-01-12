/**
 * KV Client - Wrapper for Edge Functions KV API
 * Calls the Edge Functions to perform KV operations
 */

// Base URL for KV API (Edge Functions)
const KV_BASE_URL = process.env.KV_BASE_URL || '';

/**
 * Create a KV client for a specific namespace
 * @param {string} namespace - KV namespace (config, sendkeys, topics, openids, messages)
 * @returns {Object}
 */
function createKVClient(namespace) {
  const baseUrl = `${KV_BASE_URL}/api/kv/${namespace}`;

  return {
    /**
     * Get value by key
     * @param {string} key
     * @returns {Promise<any>}
     */
    async get(key) {
      const res = await fetch(`${baseUrl}?action=get&key=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'KV get failed');
      }
      return data.data;
    },

    /**
     * Put value by key
     * @param {string} key
     * @param {any} value
     * @param {number} [ttl] - Time to live in seconds
     * @returns {Promise<void>}
     */
    async put(key, value, ttl) {
      const res = await fetch(`${baseUrl}?action=put`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, ttl }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'KV put failed');
      }
    },

    /**
     * Delete value by key
     * @param {string} key
     * @returns {Promise<void>}
     */
    async delete(key) {
      const res = await fetch(`${baseUrl}?action=delete&key=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'KV delete failed');
      }
    },

    /**
     * List keys with prefix
     * @param {string} [prefix]
     * @param {number} [limit]
     * @param {string} [cursor]
     * @returns {Promise<{ keys: string[], complete: boolean, cursor?: string }>}
     */
    async list(prefix = '', limit = 256, cursor) {
      const params = new URLSearchParams({
        action: 'list',
        prefix,
        limit: String(limit),
      });
      if (cursor) {
        params.set('cursor', cursor);
      }
      const res = await fetch(`${baseUrl}?${params}`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'KV list failed');
      }
      return {
        keys: data.keys || [],
        complete: data.complete ?? true,
        cursor: data.cursor,
      };
    },

    /**
     * List all keys with prefix (handles pagination)
     * @param {string} [prefix]
     * @returns {Promise<string[]>}
     */
    async listAll(prefix = '') {
      const allKeys = [];
      let cursor;
      let complete = false;

      while (!complete) {
        const result = await this.list(prefix, 256, cursor);
        allKeys.push(...result.keys);
        complete = result.complete;
        cursor = result.cursor;
      }

      return allKeys;
    },
  };
}

// Export KV clients for each namespace
export const configKV = createKVClient('config');
export const sendkeysKV = createKVClient('sendkeys');
export const topicsKV = createKVClient('topics');
export const openidsKV = createKVClient('openids');
export const messagesKV = createKVClient('messages');
