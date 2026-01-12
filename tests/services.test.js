import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { DefaultConfig, KVKeys } from '../node-functions/shared/types.js';

/**
 * Mock KV storage for testing
 */
function createMockKV() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.get(key) || null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    async list(prefix = '') {
      const keys = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          keys.push(key);
        }
      }
      return { keys, complete: true };
    },
    async listAll(prefix = '') {
      const result = await this.list(prefix);
      return result.keys;
    },
    clear() {
      store.clear();
    },
  };
}

// Mock KV clients
const mockConfigKV = createMockKV();
const mockSendkeysKV = createMockKV();
const mockTopicsKV = createMockKV();
const mockOpenidsKV = createMockKV();

vi.mock('../node-functions/services/kv-client.js', () => ({
  configKV: mockConfigKV,
  sendkeysKV: mockSendkeysKV,
  topicsKV: mockTopicsKV,
  openidsKV: mockOpenidsKV,
  messagesKV: createMockKV(),
}));

// Import services after mocking
const { configService } = await import('../node-functions/services/config.js');
const { openidService } = await import('../node-functions/services/openid.js');
const { sendkeyService } = await import('../node-functions/services/sendkey.js');
const { topicService } = await import('../node-functions/services/topic.js');

/**
 * Property-Based Tests for Services
 * Feature: multi-tenant-refactor
 */

// Custom arbitraries for valid names (alphanumeric, no special chars)
const validName = fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/);
const validOpenIdRef = fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/);

describe('Service Layer Properties', () => {
  beforeEach(() => {
    mockConfigKV.clear();
    mockSendkeysKV.clear();
    mockTopicsKV.clear();
    mockOpenidsKV.clear();
  });

  /**
   * Property 17: Config Default Values
   * For any App_Config retrieval where optional fields are missing,
   * the response SHALL include default values.
   * Validates: Requirements 2.2
   */
  describe('Property 17: Config Default Values', () => {
    it('should apply default values for missing optional fields', async () => {
      // Save minimal config
      const minimalConfig = {
        adminToken: 'AT_test123456789012345678901234',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await mockConfigKV.put(KVKeys.CONFIG, minimalConfig);

      const config = await configService.getConfig();

      expect(config.rateLimit.perMinute).toBe(DefaultConfig.rateLimit.perMinute);
      expect(config.retention.days).toBe(DefaultConfig.retention.days);
    });

    it('should preserve existing values when present', async () => {
      const fullConfig = {
        adminToken: 'AT_test123456789012345678901234',
        rateLimit: { perMinute: 10 },
        retention: { days: 60 },
        wechat: { appId: 'wx123', appSecret: 'secret', templateId: 'tmpl' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await mockConfigKV.put(KVKeys.CONFIG, fullConfig);

      const config = await configService.getConfig();

      expect(config.rateLimit.perMinute).toBe(10);
      expect(config.retention.days).toBe(60);
    });
  });

  /**
   * Property 6: Key CRUD Round-Trip
   * For any SendKey or Topic, after creation, listing SHALL include the created item;
   * after update, retrieval SHALL return updated values;
   * after deletion, lookup SHALL return null.
   * Validates: Requirements 4.2, 4.3, 4.4, 5.2, 5.3
   */
  describe('Property 6: Key CRUD Round-Trip', () => {
    describe('SendKey CRUD', () => {
      it('should include created SendKey in list', async () => {
        await fc.assert(
          fc.asyncProperty(validName, validOpenIdRef, async (name, openIdRef) => {
            mockSendkeysKV.clear();

            const created = await sendkeyService.create(name, openIdRef);
            const list = await sendkeyService.list();

            const found = list.find((sk) => sk.id === created.id);
            return found !== undefined && found.name === name && found.openIdRef === openIdRef;
          }),
          { numRuns: 20 }
        );
      });

      it('should return updated values after update', async () => {
        await fc.assert(
          fc.asyncProperty(validName, validOpenIdRef, validName, async (name, openIdRef, newName) => {
            mockSendkeysKV.clear();

            const created = await sendkeyService.create(name, openIdRef);
            await sendkeyService.update(created.id, { name: newName });
            const retrieved = await sendkeyService.get(created.id);

            return retrieved !== null && retrieved.name === newName;
          }),
          { numRuns: 20 }
        );
      });

      it('should return null after deletion', async () => {
        await fc.assert(
          fc.asyncProperty(validName, async (name) => {
            mockSendkeysKV.clear();

            const created = await sendkeyService.create(name, 'oid_test');
            await sendkeyService.delete(created.id);
            const retrieved = await sendkeyService.get(created.id);

            return retrieved === null;
          }),
          { numRuns: 20 }
        );
      });
    });

    describe('Topic CRUD', () => {
      it('should include created Topic in list', async () => {
        await fc.assert(
          fc.asyncProperty(validName, async (name) => {
            mockTopicsKV.clear();

            const created = await topicService.create(name);
            const list = await topicService.list();

            const found = list.find((t) => t.id === created.id);
            return found !== undefined && found.name === name;
          }),
          { numRuns: 20 }
        );
      });

      it('should return updated values after update', async () => {
        await fc.assert(
          fc.asyncProperty(validName, validName, async (name, newName) => {
            mockTopicsKV.clear();

            const created = await topicService.create(name);
            await topicService.update(created.id, { name: newName });
            const retrieved = await topicService.get(created.id);

            return retrieved !== null && retrieved.name === newName;
          }),
          { numRuns: 20 }
        );
      });

      it('should return null after deletion', async () => {
        await fc.assert(
          fc.asyncProperty(validName, async (name) => {
            mockTopicsKV.clear();

            const created = await topicService.create(name);
            await topicService.delete(created.id);
            const retrieved = await topicService.get(created.id);

            return retrieved === null;
          }),
          { numRuns: 20 }
        );
      });
    });
  });

  /**
   * Property 8: Subscription State Consistency
   * For any Topic, after an OpenID subscribes, the subscriber list SHALL contain that OpenID;
   * after unsubscribe, the subscriber list SHALL NOT contain that OpenID.
   * Validates: Requirements 5.4, 5.5
   */
  describe('Property 8: Subscription State Consistency', () => {
    it('should contain OpenID after subscribe', async () => {
      await fc.assert(
        fc.asyncProperty(validName, validOpenIdRef, async (topicName, openIdRef) => {
          mockTopicsKV.clear();

          const topic = await topicService.create(topicName);
          await topicService.subscribe(topic.id, openIdRef);
          const updated = await topicService.get(topic.id);

          return updated !== null && updated.subscriberRefs.includes(openIdRef);
        }),
        { numRuns: 20 }
      );
    });

    it('should not contain OpenID after unsubscribe', async () => {
      await fc.assert(
        fc.asyncProperty(validName, validOpenIdRef, async (topicName, openIdRef) => {
          mockTopicsKV.clear();

          const topic = await topicService.create(topicName);
          await topicService.subscribe(topic.id, openIdRef);
          await topicService.unsubscribe(topic.id, openIdRef);
          const updated = await topicService.get(topic.id);

          return updated !== null && !updated.subscriberRefs.includes(openIdRef);
        }),
        { numRuns: 20 }
      );
    });

    it('should handle multiple subscribe/unsubscribe operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          validName,
          fc.array(validOpenIdRef, { minLength: 1, maxLength: 10 }),
          async (topicName, openIdRefs) => {
            mockTopicsKV.clear();

            const topic = await topicService.create(topicName);
            const uniqueRefs = [...new Set(openIdRefs)];

            // Subscribe all
            for (const ref of uniqueRefs) {
              await topicService.subscribe(topic.id, ref);
            }

            let updated = await topicService.get(topic.id);
            if (!updated) return false;
            const allSubscribed = uniqueRefs.every((ref) => updated.subscriberRefs.includes(ref));

            // Unsubscribe all
            for (const ref of uniqueRefs) {
              await topicService.unsubscribe(topic.id, ref);
            }

            updated = await topicService.get(topic.id);
            if (!updated) return false;
            const allUnsubscribed = uniqueRefs.every((ref) => !updated.subscriberRefs.includes(ref));

            return allSubscribed && allUnsubscribed;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 16: KV Index Lookup
   * For any stored SendKey or Topic, lookup by key value using the index
   * SHALL return the same data as lookup by internal ID.
   * Validates: Requirements 10.2, 10.3
   */
  describe('Property 16: KV Index Lookup', () => {
    it('should return same SendKey data via ID and key lookup', async () => {
      await fc.assert(
        fc.asyncProperty(validName, async (name) => {
          mockSendkeysKV.clear();

          const created = await sendkeyService.create(name, 'oid_test');
          const byId = await sendkeyService.get(created.id);
          const byKey = await sendkeyService.findByKey(created.key);

          return (
            byId !== null &&
            byKey !== null &&
            byId.id === byKey.id &&
            byId.key === byKey.key &&
            byId.name === byKey.name
          );
        }),
        { numRuns: 20 }
      );
    });

    it('should return same Topic data via ID and key lookup', async () => {
      await fc.assert(
        fc.asyncProperty(validName, async (name) => {
          mockTopicsKV.clear();

          const created = await topicService.create(name);
          const byId = await topicService.get(created.id);
          const byKey = await topicService.findByKey(created.key);

          return (
            byId !== null &&
            byKey !== null &&
            byId.id === byKey.id &&
            byId.key === byKey.key &&
            byId.name === byKey.name
          );
        }),
        { numRuns: 20 }
      );
    });

    it('should return null for non-existent keys', async () => {
      mockSendkeysKV.clear();
      mockTopicsKV.clear();

      const sendkeyResult = await sendkeyService.findByKey('SCTnonexistent123456789012345');
      const topicResult = await topicService.findByKey('TPKnonexistent123456789012345');

      expect(sendkeyResult).toBeNull();
      expect(topicResult).toBeNull();
    });
  });

  /**
   * OpenID Service Tests
   */
  describe('OpenID Service', () => {
    it('should create and retrieve OpenID', async () => {
      mockOpenidsKV.clear();

      const openId = 'oXXXX_test_user';
      const name = 'Test User';

      const created = await openidService.create(openId, name);
      expect(created.openId).toBe(openId);
      expect(created.name).toBe(name);

      const retrieved = await openidService.get(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved.openId).toBe(openId);
    });

    it('should find OpenID by value', async () => {
      mockOpenidsKV.clear();

      const openId = 'oXXXX_find_test';
      const created = await openidService.create(openId);

      const found = await openidService.findByOpenId(openId);
      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
    });

    it('should prevent duplicate OpenID creation', async () => {
      mockOpenidsKV.clear();

      const openId = 'oXXXX_duplicate';
      await openidService.create(openId);

      await expect(openidService.create(openId)).rejects.toThrow('OpenID already exists');
    });
  });
});
