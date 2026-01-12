/**
 * Integration Tests
 * Feature: multi-tenant-refactor
 *
 * Tests complete flows:
 * - Initialization flow
 * - SendKey complete flow
 * - Topic complete flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

// Mock channel registry
vi.mock('../node-functions/shared/channels/registry.js', () => ({
  sendViaChannel: vi.fn().mockResolvedValue({
    success: true,
    externalId: 'mock_msg_id_123',
  }),
  getChannelAdapter: vi.fn().mockReturnValue({
    type: 'wechat-template',
    name: 'WeChat Template',
    description: 'Mock adapter',
  }),
}));

// Import services after mocking
const { authService } = await import('../node-functions/services/auth.js');
const { configService } = await import('../node-functions/services/config.js');
const { openidService } = await import('../node-functions/services/openid.js');
const { sendkeyService } = await import('../node-functions/services/sendkey.js');
const { topicService } = await import('../node-functions/services/topic.js');
const { pushService } = await import('../node-functions/services/push.js');
const { messageService } = await import('../node-functions/services/message.js');

describe('Integration Tests', () => {
  beforeEach(() => {
    mockConfigKV.clear();
    mockSendkeysKV.clear();
    mockTopicsKV.clear();
    mockOpenidsKV.clear();
    mockMessagesKV.clear();
  });

  /**
   * Initialization Flow Test
   */
  describe('Initialization Flow', () => {
    it('should complete initialization flow', async () => {
      // Step 1: Check not initialized
      let isInit = await authService.isInitialized();
      expect(isInit).toBe(false);

      // Step 2: Initialize
      const result = await authService.initialize({
        appId: 'wx_test_app',
        appSecret: 'wx_test_secret',
        templateId: 'tmpl_test',
      });

      expect(result.adminToken).toBeDefined();
      expect(result.adminToken.startsWith('AT_')).toBe(true);
      expect(result.config.wechat.appId).toBe('wx_test_app');

      // Step 3: Check initialized
      isInit = await authService.isInitialized();
      expect(isInit).toBe(true);

      // Step 4: Validate token
      const isValid = await authService.validateAdminToken(result.adminToken);
      expect(isValid).toBe(true);

      // Step 5: Get status
      const status = await authService.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.hasWeChatConfig).toBe(true);
    });

    it('should prevent double initialization', async () => {
      await authService.initialize();

      await expect(authService.initialize()).rejects.toThrow('already initialized');
    });
  });

  /**
   * SendKey Complete Flow Test
   */
  describe('SendKey Complete Flow', () => {
    beforeEach(async () => {
      // Initialize first
      await authService.initialize({
        appId: 'wx_test_app',
        appSecret: 'wx_test_secret',
        templateId: 'tmpl_test',
      });
    });

    it('should complete SendKey flow: create -> push -> query history', async () => {
      // Step 1: Create OpenID
      const openIdData = await openidService.create('oXXXX_test_user', 'Test User');
      expect(openIdData.id).toBeDefined();
      expect(openIdData.openId).toBe('oXXXX_test_user');

      // Step 2: Create SendKey
      const sendKeyData = await sendkeyService.create('My Server Monitor', openIdData.id);
      expect(sendKeyData.id).toBeDefined();
      expect(sendKeyData.key.startsWith('SCT')).toBe(true);
      expect(sendKeyData.openIdRef).toBe(openIdData.id);

      // Step 3: Push message
      const pushResult = await pushService.pushBySendKey(
        sendKeyData.key,
        'Server Alert',
        'CPU usage is high'
      );
      expect(pushResult.pushId).toBeDefined();
      expect(pushResult.success).toBe(true);

      // Step 4: Query message history
      const messages = await messageService.list({ type: 'single' });
      expect(messages.messages.length).toBe(1);
      expect(messages.messages[0].title).toBe('Server Alert');
      expect(messages.messages[0].type).toBe('single');

      // Step 5: Get message detail
      const message = await messageService.get(pushResult.pushId);
      expect(message).not.toBeNull();
      expect(message.results[0].success).toBe(true);
    });

    it('should handle SendKey update and delete', async () => {
      const openIdData = await openidService.create('oXXXX_update_test');
      const sendKeyData = await sendkeyService.create('Original Name', openIdData.id);

      // Update
      const updated = await sendkeyService.update(sendKeyData.id, { name: 'Updated Name' });
      expect(updated.name).toBe('Updated Name');

      // Delete
      const deleted = await sendkeyService.delete(sendKeyData.id);
      expect(deleted).toBe(true);

      // Verify deleted
      const found = await sendkeyService.get(sendKeyData.id);
      expect(found).toBeNull();
    });
  });

  /**
   * Topic Complete Flow Test
   */
  describe('Topic Complete Flow', () => {
    beforeEach(async () => {
      await authService.initialize({
        appId: 'wx_test_app',
        appSecret: 'wx_test_secret',
        templateId: 'tmpl_test',
      });
    });

    it('should complete Topic flow: create -> subscribe -> push -> query history', async () => {
      // Step 1: Create OpenIDs
      const user1 = await openidService.create('oXXXX_user1', 'User 1');
      const user2 = await openidService.create('oXXXX_user2', 'User 2');
      const user3 = await openidService.create('oXXXX_user3', 'User 3');

      // Step 2: Create Topic
      const topicData = await topicService.create('System Announcements');
      expect(topicData.id).toBeDefined();
      expect(topicData.key.startsWith('TPK')).toBe(true);

      // Step 3: Subscribe users
      await topicService.subscribe(topicData.id, user1.id);
      await topicService.subscribe(topicData.id, user2.id);
      await topicService.subscribe(topicData.id, user3.id);

      // Verify subscribers
      const subscribers = await topicService.getSubscribers(topicData.id);
      expect(subscribers.length).toBe(3);

      // Step 4: Push message
      const pushResult = await pushService.pushByTopicKey(
        topicData.key,
        'Maintenance Notice',
        'System will be down at 10pm'
      );
      expect(pushResult.pushId).toBeDefined();
      expect(pushResult.total).toBe(3);
      expect(pushResult.success).toBe(3);
      expect(pushResult.failed).toBe(0);

      // Step 5: Query message history
      const messages = await messageService.list({ type: 'topic' });
      expect(messages.messages.length).toBe(1);
      expect(messages.messages[0].title).toBe('Maintenance Notice');
      expect(messages.messages[0].type).toBe('topic');
      expect(messages.messages[0].results.length).toBe(3);
    });

    it('should handle unsubscribe', async () => {
      const user = await openidService.create('oXXXX_unsub_test');
      const topic = await topicService.create('Test Topic');

      await topicService.subscribe(topic.id, user.id);
      let subscribers = await topicService.getSubscribers(topic.id);
      expect(subscribers.length).toBe(1);

      await topicService.unsubscribe(topic.id, user.id);
      subscribers = await topicService.getSubscribers(topic.id);
      expect(subscribers.length).toBe(0);
    });

    it('should return NO_SUBSCRIBERS error for empty topic', async () => {
      const topic = await topicService.create('Empty Topic');

      const result = await pushService.pushByTopicKey(topic.key, 'Test');
      expect(result.error).toBeDefined();
      expect(result.total).toBe(0);
    });
  });

  /**
   * Config Management Test
   */
  describe('Config Management', () => {
    it('should update config without changing adminToken', async () => {
      const initResult = await authService.initialize();
      const originalToken = initResult.adminToken;

      // Update config
      const updated = await configService.updateConfig({
        adminToken: 'SHOULD_BE_IGNORED',
        rateLimit: { perMinute: 10 },
        retention: { days: 60 },
      });

      // adminToken should not change
      expect(updated.adminToken).toBe(originalToken);
      expect(updated.rateLimit.perMinute).toBe(10);
      expect(updated.retention.days).toBe(60);
    });

    it('should apply default values', async () => {
      await authService.initialize();

      const config = await configService.getConfig();
      expect(config.rateLimit.perMinute).toBe(5); // default
      expect(config.retention.days).toBe(30); // default
    });
  });

  /**
   * OpenID Reference Check Test
   */
  describe('OpenID Reference Check', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should detect OpenID references in SendKeys', async () => {
      const openId = await openidService.create('oXXXX_ref_test');
      await sendkeyService.create('Test Key', openId.id);

      const refs = await openidService.checkReferences(openId.id, {
        sendkeyService,
        topicService,
      });

      expect(refs.referenced).toBe(true);
      expect(refs.sendkeys.length).toBe(1);
    });

    it('should detect OpenID references in Topics', async () => {
      const openId = await openidService.create('oXXXX_topic_ref');
      const topic = await topicService.create('Test Topic');
      await topicService.subscribe(topic.id, openId.id);

      const refs = await openidService.checkReferences(openId.id, {
        sendkeyService,
        topicService,
      });

      expect(refs.referenced).toBe(true);
      expect(refs.topics.length).toBe(1);
    });
  });

  /**
   * Message Pagination Test
   */
  describe('Message Pagination', () => {
    beforeEach(async () => {
      await authService.initialize({
        appId: 'wx_test',
        appSecret: 'secret',
        templateId: 'tmpl',
      });
    });

    it('should paginate messages correctly', async () => {
      const openId = await openidService.create('oXXXX_pagination');
      const sendKey = await sendkeyService.create('Pagination Test', openId.id);

      // Create 5 messages
      for (let i = 0; i < 5; i++) {
        await pushService.pushBySendKey(sendKey.key, `Message ${i + 1}`);
      }

      // Get page 1 with pageSize 2
      const page1 = await messageService.list({ page: 1, pageSize: 2 });
      expect(page1.messages.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.messages[0].title).toBe('Message 5'); // newest first

      // Get page 2
      const page2 = await messageService.list({ page: 2, pageSize: 2 });
      expect(page2.messages.length).toBe(2);
      expect(page2.messages[0].title).toBe('Message 3');

      // Get page 3
      const page3 = await messageService.list({ page: 3, pageSize: 2 });
      expect(page3.messages.length).toBe(1);
      expect(page3.messages[0].title).toBe('Message 1');
    });
  });
});
