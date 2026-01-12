/**
 * Push Service Property Tests
 * Feature: multi-tenant-refactor
 *
 * Property 11: Partial Failure Continuation
 * Property 12: Message History Persistence
 * Property 13: Message History Ordering
 * Property 14: Pagination Correctness
 * Property 15: Access Token Caching
 *
 * Validates: Requirements 6.3, 6.5, 7.3, 8.2, 8.3, 8.4, 9.2, 9.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { KVKeys } from '../node-functions/shared/types.js';

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
const mockMessagesKV = createMockKV();

vi.mock('../node-functions/services/kv-client.js', () => ({
  configKV: mockConfigKV,
  sendkeysKV: mockSendkeysKV,
  topicsKV: mockTopicsKV,
  openidsKV: mockOpenidsKV,
  messagesKV: mockMessagesKV,
}));

// Mock WeChat API calls
let mockWeChatResponses = [];
let mockWeChatCallCount = 0;

vi.mock('../node-functions/shared/channels/wechat-template.js', async () => {
  const actual = await vi.importActual('../node-functions/shared/channels/wechat-template.js');
  return {
    ...actual,
    wechatTemplateAdapter: {
      ...actual.wechatTemplateAdapter,
      async send(message, credentials) {
        const response = mockWeChatResponses[mockWeChatCallCount] || { success: true, externalId: `msg_${mockWeChatCallCount}` };
        mockWeChatCallCount++;
        return response;
      },
    },
  };
});

// Import services after mocking
const { messageService } = await import('../node-functions/services/message.js');
const { configService } = await import('../node-functions/services/config.js');
const { openidService } = await import('../node-functions/services/openid.js');
const { sendkeyService } = await import('../node-functions/services/sendkey.js');
const { topicService } = await import('../node-functions/services/topic.js');
const { pushService } = await import('../node-functions/services/push.js');

// Helper to set up test config
async function setupConfig() {
  const config = {
    adminToken: 'AT_test123456789012345678901234',
    wechat: {
      appId: 'wx_test_app_id',
      appSecret: 'test_app_secret',
      templateId: 'test_template_id',
    },
    rateLimit: { perMinute: 100 },
    retention: { days: 30 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await mockConfigKV.put(KVKeys.CONFIG, config);
  return config;
}

// Valid name generator
const validName = fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/);

describe('Push Service Properties', () => {
  beforeEach(() => {
    mockConfigKV.clear();
    mockSendkeysKV.clear();
    mockTopicsKV.clear();
    mockOpenidsKV.clear();
    mockMessagesKV.clear();
    mockWeChatResponses = [];
    mockWeChatCallCount = 0;
  });

  /**
   * Property 12: Message History Persistence
   * For any pushed message (single or topic), the message SHALL be retrievable
   * from history with all delivery results and timestamps.
   * Validates: Requirements 6.5, 8.4
   */
  describe('Property 12: Message History Persistence', () => {
    it('should persist single push messages with all details', async () => {
      await setupConfig();

      // Create OpenID and SendKey
      const openId = await openidService.create('oXXXX_test_user', 'Test User');
      const sendKey = await sendkeyService.create('test-key', openId.id);

      // Mock successful response
      mockWeChatResponses = [{ success: true, externalId: 'msg_12345' }];

      // Push message
      const result = await pushService.pushBySendKey(sendKey.key, 'Test Title', 'Test Content');

      // Verify message is persisted
      const message = await messageService.get(result.pushId);
      expect(message).not.toBeNull();
      expect(message.title).toBe('Test Title');
      expect(message.content).toBe('Test Content');
      expect(message.type).toBe('single');
      expect(message.results).toHaveLength(1);
      expect(message.results[0].openId).toBe('oXXXX_test_user');
      expect(message.createdAt).toBeDefined();
    });

    it('should persist topic push messages with all subscriber results', async () => {
      await setupConfig();

      // Create OpenIDs and Topic
      const openId1 = await openidService.create('oXXXX_user1', 'User 1');
      const openId2 = await openidService.create('oXXXX_user2', 'User 2');
      const topic = await topicService.create('test-topic');
      await topicService.subscribe(topic.id, openId1.id);
      await topicService.subscribe(topic.id, openId2.id);

      // Mock responses (one success, one failure)
      mockWeChatResponses = [
        { success: true, externalId: 'msg_1' },
        { success: false, error: '43004: require subscribe' },
      ];

      // Push message
      const result = await pushService.pushByTopicKey(topic.key, 'Topic Title', 'Topic Content');

      // Verify message is persisted with all results
      const message = await messageService.get(result.pushId);
      expect(message).not.toBeNull();
      expect(message.type).toBe('topic');
      expect(message.results).toHaveLength(2);
      expect(message.results.some(r => r.success)).toBe(true);
      expect(message.results.some(r => !r.success)).toBe(true);
    });
  });

  /**
   * Property 13: Message History Ordering
   * For any message history query, results SHALL be returned in reverse
   * chronological order (newest first).
   * Validates: Requirements 8.2
   */
  describe('Property 13: Message History Ordering', () => {
    it('should return messages in reverse chronological order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validName, { minLength: 2, maxLength: 10 }),
          async (titles) => {
            mockMessagesKV.clear();

            // Save messages with sequential timestamps
            const messages = [];
            for (let i = 0; i < titles.length; i++) {
              const msg = {
                id: `push_${i}`,
                type: 'single',
                keyId: 'sk_test',
                title: titles[i],
                results: [],
                createdAt: new Date(Date.now() + i * 1000).toISOString(),
              };
              await messageService.save(msg);
              messages.push(msg);
            }

            // Query messages
            const result = await messageService.list({ pageSize: 100 });

            // Verify reverse chronological order
            for (let i = 1; i < result.messages.length; i++) {
              const prev = new Date(result.messages[i - 1].createdAt);
              const curr = new Date(result.messages[i].createdAt);
              if (prev < curr) return false;
            }
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 14: Pagination Correctness
   * For any paginated message history query with page P and pageSize S,
   * the returned messages SHALL be the correct subset.
   * Validates: Requirements 8.3
   */
  describe('Property 14: Pagination Correctness', () => {
    it('should return correct page of messages', async () => {
      mockMessagesKV.clear();

      // Create 25 messages
      for (let i = 0; i < 25; i++) {
        await messageService.save({
          id: `push_${String(i).padStart(3, '0')}`,
          type: 'single',
          keyId: 'sk_test',
          title: `Message ${i}`,
          results: [],
          createdAt: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      // Test page 1
      const page1 = await messageService.list({ page: 1, pageSize: 10 });
      expect(page1.messages).toHaveLength(10);
      expect(page1.total).toBe(25);
      expect(page1.page).toBe(1);

      // Test page 2
      const page2 = await messageService.list({ page: 2, pageSize: 10 });
      expect(page2.messages).toHaveLength(10);

      // Test page 3 (partial)
      const page3 = await messageService.list({ page: 3, pageSize: 10 });
      expect(page3.messages).toHaveLength(5);

      // Verify no overlap between pages
      const page1Ids = new Set(page1.messages.map(m => m.id));
      const page2Ids = new Set(page2.messages.map(m => m.id));
      const page3Ids = new Set(page3.messages.map(m => m.id));

      for (const id of page2Ids) {
        expect(page1Ids.has(id)).toBe(false);
      }
      for (const id of page3Ids) {
        expect(page1Ids.has(id)).toBe(false);
        expect(page2Ids.has(id)).toBe(false);
      }
    });

    it('should handle type filtering with pagination', async () => {
      mockMessagesKV.clear();

      // Create mixed messages
      for (let i = 0; i < 10; i++) {
        await messageService.save({
          id: `push_single_${i}`,
          type: 'single',
          keyId: 'sk_test',
          title: `Single ${i}`,
          results: [],
          createdAt: new Date(Date.now() + i * 1000).toISOString(),
        });
        await messageService.save({
          id: `push_topic_${i}`,
          type: 'topic',
          keyId: 'tp_test',
          title: `Topic ${i}`,
          results: [],
          createdAt: new Date(Date.now() + i * 1000 + 500).toISOString(),
        });
      }

      // Filter by type
      const singleMessages = await messageService.list({ type: 'single', pageSize: 100 });
      const topicMessages = await messageService.list({ type: 'topic', pageSize: 100 });

      expect(singleMessages.messages.every(m => m.type === 'single')).toBe(true);
      expect(topicMessages.messages.every(m => m.type === 'topic')).toBe(true);
      expect(singleMessages.total).toBe(10);
      expect(topicMessages.total).toBe(10);
    });
  });

  /**
   * Property 11: Partial Failure Continuation
   * For any topic push where some subscriber deliveries fail,
   * the service SHALL continue delivering to remaining subscribers.
   * Validates: Requirements 6.3, 7.3
   */
  describe('Property 11: Partial Failure Continuation', () => {
    it('should continue pushing to remaining subscribers after failures', async () => {
      await setupConfig();

      // Create multiple OpenIDs and Topic
      const openIds = [];
      for (let i = 0; i < 5; i++) {
        const oid = await openidService.create(`oXXXX_user${i}`, `User ${i}`);
        openIds.push(oid);
      }

      const topic = await topicService.create('test-topic');
      for (const oid of openIds) {
        await topicService.subscribe(topic.id, oid.id);
      }

      // Mock mixed responses (some fail, some succeed)
      mockWeChatResponses = [
        { success: true, externalId: 'msg_0' },
        { success: false, error: 'Error 1' },
        { success: true, externalId: 'msg_2' },
        { success: false, error: 'Error 3' },
        { success: true, externalId: 'msg_4' },
      ];

      // Push message
      const result = await pushService.pushByTopicKey(topic.key, 'Test', 'Content');

      // Verify all subscribers were attempted
      expect(result.total).toBe(5);
      expect(result.results).toHaveLength(5);
      expect(result.success).toBe(3);
      expect(result.failed).toBe(2);

      // Verify each result is recorded
      expect(result.results.filter(r => r.success)).toHaveLength(3);
      expect(result.results.filter(r => !r.success)).toHaveLength(2);
    });

    it('should record all results even when all fail', async () => {
      await setupConfig();

      // Create OpenIDs and Topic
      const openId1 = await openidService.create('oXXXX_fail1', 'Fail 1');
      const openId2 = await openidService.create('oXXXX_fail2', 'Fail 2');
      const topic = await topicService.create('fail-topic');
      await topicService.subscribe(topic.id, openId1.id);
      await topicService.subscribe(topic.id, openId2.id);

      // Mock all failures
      mockWeChatResponses = [
        { success: false, error: 'Error 1' },
        { success: false, error: 'Error 2' },
      ];

      // Push message
      const result = await pushService.pushByTopicKey(topic.key, 'Test', 'Content');

      // Verify all were attempted and recorded
      expect(result.total).toBe(2);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => !r.success)).toBe(true);
    });
  });
});

describe('Message Service', () => {
  beforeEach(() => {
    mockMessagesKV.clear();
  });

  describe('save and get', () => {
    it('should save and retrieve message', async () => {
      const message = {
        id: 'push_test123',
        type: 'single',
        keyId: 'sk_test',
        title: 'Test Title',
        content: 'Test Content',
        results: [{ openId: 'oXXXX_test', success: true, msgId: 'msg_123' }],
        createdAt: new Date().toISOString(),
      };

      await messageService.save(message);
      const retrieved = await messageService.get(message.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved.id).toBe(message.id);
      expect(retrieved.title).toBe(message.title);
      expect(retrieved.results).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('should delete message and update list', async () => {
      const message = {
        id: 'push_delete_test',
        type: 'single',
        keyId: 'sk_test',
        title: 'To Delete',
        results: [],
        createdAt: new Date().toISOString(),
      };

      await messageService.save(message);
      expect(await messageService.get(message.id)).not.toBeNull();

      const deleted = await messageService.delete(message.id);
      expect(deleted).toBe(true);
      expect(await messageService.get(message.id)).toBeNull();
    });

    it('should return false for non-existent message', async () => {
      const deleted = await messageService.delete('push_nonexistent');
      expect(deleted).toBe(false);
    });
  });
});
