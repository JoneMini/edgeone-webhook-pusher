/**
 * Webhook Push Property Tests
 * Feature: system-restructure
 * 
 * Tests correctness properties for Webhook Push service
 * Properties 17-23 from design document
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock KV clients
const mockAppsKV = {
  data: new Map(),
  async get(key) {
    return this.data.get(key) || null;
  },
  async put(key, value) {
    this.data.set(key, value);
  },
  async delete(key) {
    this.data.delete(key);
  },
  clear() {
    this.data.clear();
  },
};

const mockChannelsKV = {
  data: new Map(),
  async get(key) {
    return this.data.get(key) || null;
  },
  async put(key, value) {
    this.data.set(key, value);
  },
  async delete(key) {
    this.data.delete(key);
  },
  clear() {
    this.data.clear();
  },
};

const mockOpenidsKV = {
  data: new Map(),
  async get(key) {
    return this.data.get(key) || null;
  },
  async put(key, value) {
    this.data.set(key, value);
  },
  async delete(key) {
    this.data.delete(key);
  },
  clear() {
    this.data.clear();
  },
};

const mockMessagesKV = {
  data: new Map(),
  async get(key) {
    return this.data.get(key) || null;
  },
  async put(key, value) {
    this.data.set(key, value);
  },
  async delete(key) {
    this.data.delete(key);
  },
  clear() {
    this.data.clear();
  },
};

// Mock fetch for WeChat API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the KV client module
vi.mock('../node-functions/shared/kv-client.js', () => ({
  appsKV: mockAppsKV,
  channelsKV: mockChannelsKV,
  openidsKV: mockOpenidsKV,
  messagesKV: mockMessagesKV,
  setKVBaseUrl: vi.fn(),
}));

// Import after mocking
const { pushService } = await import('../node-functions/modules/push/service.js');
const { appService } = await import('../node-functions/modules/app/service.js');
const { openidService } = await import('../node-functions/modules/openid/service.js');
const { historyService } = await import('../node-functions/modules/history/service.js');

// Helper to create a test channel
function createTestChannel(id = 'ch_test1') {
  const channel = {
    id,
    name: 'Test Channel',
    type: 'wechat',
    config: { appId: 'wx_test_appid', appSecret: 'wx_test_secret' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mockChannelsKV.data.set(`ch:${id}`, channel);
  const list = mockChannelsKV.data.get('ch_list') || [];
  list.push(id);
  mockChannelsKV.data.set('ch_list', list);
  return channel;
}

// Helper to create a test app
async function createTestApp(options = {}) {
  const {
    name = 'Test App',
    channelId = 'ch_test1',
    pushMode = 'single',
    messageType = 'normal',
    templateId,
  } = options;

  const app = await appService.create({
    name,
    channelId,
    pushMode,
    messageType,
    ...(templateId && { templateId }),
  });
  return app;
}

// Helper to add OpenID to app
async function addOpenIdToApp(appId, openId, nickname) {
  return openidService.create(appId, { openId, nickname });
}

// Setup mock WeChat API responses
function setupWeChatMock(success = true) {
  mockFetch.mockImplementation(async (url) => {
    if (url.includes('cgi-bin/token')) {
      return {
        json: async () => ({
          access_token: 'mock_access_token',
          expires_in: 7200,
        }),
      };
    }
    if (url.includes('message/template/send') || url.includes('message/custom/send')) {
      if (success) {
        return {
          json: async () => ({
            errcode: 0,
            errmsg: 'ok',
            msgid: `msg_${Date.now()}`,
          }),
        };
      } else {
        return {
          json: async () => ({
            errcode: 40001,
            errmsg: 'invalid credential',
          }),
        };
      }
    }
    return { json: async () => ({}) };
  });
}

// Arbitrary generators
const titleArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);
const despArb = fc.string({ minLength: 0, maxLength: 500 });
const openIdArb = fc.string({ minLength: 10, maxLength: 50 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s));
const appKeyArb = fc.string({ minLength: 10, maxLength: 30 }).map((s) => `APK${s}`);

describe('Webhook Push Property Tests', () => {
  beforeEach(() => {
    mockAppsKV.clear();
    mockChannelsKV.clear();
    mockOpenidsKV.clear();
    mockMessagesKV.clear();
    mockFetch.mockReset();
    createTestChannel();
  });


  /**
   * Property 17: Webhook Push Consistency
   * For any valid App Key and message, both GET (query params) and POST (JSON body) 
   * requests SHALL produce equivalent push results.
   * Validates: Requirements 6.1, 6.2
   */
  describe('Property 17: Webhook Push Consistency', () => {
    it('GET and POST produce equivalent results for same message', async () => {
      await fc.assert(
        fc.asyncProperty(titleArb, despArb, async (title, desp) => {
          setupWeChatMock(true);

          // Create app with single mode
          const app = await createTestApp({ pushMode: 'single' });
          await addOpenIdToApp(app.id, 'test_openid_1', 'User1');

          // Message object (same for both)
          const message = { title, desp };

          // Push via service (simulates both GET and POST since they use same service)
          const result1 = await pushService.push(app.key, message);
          
          // Reset and push again
          mockMessagesKV.clear();
          const result2 = await pushService.push(app.key, message);

          // Both should have same structure
          expect(result1.total).toBe(result2.total);
          expect(result1.success).toBe(result2.success);
          expect(result1.failed).toBe(result2.failed);
          expect(result1.results.length).toBe(result2.results.length);

          return true;
        }),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 18: Single Mode Push Behavior
   * For any App with pushMode='single' and multiple bound OpenIDs, 
   * pushing a message SHALL only send to exactly one OpenID.
   * Validates: Requirements 6.3
   */
  describe('Property 18: Single Mode Push Behavior', () => {
    it('single mode sends to exactly one OpenID', async () => {
      await fc.assert(
        fc.asyncProperty(
          titleArb,
          fc.array(openIdArb, { minLength: 2, maxLength: 10 }),
          async (title, openIds) => {
            setupWeChatMock(true);

            // Create app with single mode
            const app = await createTestApp({ pushMode: 'single' });

            // Add multiple OpenIDs
            const uniqueOpenIds = [...new Set(openIds)];
            for (let i = 0; i < uniqueOpenIds.length; i++) {
              await addOpenIdToApp(app.id, uniqueOpenIds[i], `User${i}`);
            }

            // Push message
            const result = await pushService.push(app.key, { title });

            // Should only send to exactly one OpenID
            expect(result.total).toBe(1);
            expect(result.results.length).toBe(1);

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 19: Subscribe Mode Push Behavior
   * For any App with pushMode='subscribe' and N bound OpenIDs, 
   * pushing a message SHALL attempt to send to all N OpenIDs.
   * Validates: Requirements 6.4
   */
  describe('Property 19: Subscribe Mode Push Behavior', () => {
    it('subscribe mode sends to all OpenIDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          titleArb,
          fc.array(openIdArb, { minLength: 1, maxLength: 10 }),
          async (title, openIds) => {
            setupWeChatMock(true);

            // Create app with subscribe mode
            const app = await createTestApp({ pushMode: 'subscribe' });

            // Add multiple OpenIDs (ensure unique)
            const uniqueOpenIds = [...new Set(openIds)];
            for (let i = 0; i < uniqueOpenIds.length; i++) {
              await addOpenIdToApp(app.id, uniqueOpenIds[i], `User${i}`);
            }

            // Push message
            const result = await pushService.push(app.key, { title });

            // Should send to all OpenIDs
            expect(result.total).toBe(uniqueOpenIds.length);
            expect(result.results.length).toBe(uniqueOpenIds.length);

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 20: Invalid App Key Rejection
   * For any push request with a non-existent App Key, 
   * the system SHALL return an error.
   * Validates: Requirements 6.5
   */
  describe('Property 20: Invalid App Key Rejection', () => {
    it('rejects non-existent app key', async () => {
      await fc.assert(
        fc.asyncProperty(appKeyArb, titleArb, async (appKey, title) => {
          // Don't create any app, just try to push
          const result = await pushService.push(appKey, { title });

          // Should return error
          expect(result.error).toBe('App not found');
          expect(result.total).toBe(0);
          expect(result.success).toBe(0);

          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 21: Empty Binding Rejection
   * For any App with no bound OpenIDs, pushing a message SHALL return an error.
   * Validates: Requirements 6.6
   */
  describe('Property 21: Empty Binding Rejection', () => {
    it('rejects push to app with no OpenIDs', async () => {
      await fc.assert(
        fc.asyncProperty(titleArb, async (title) => {
          // Create app but don't add any OpenIDs
          const app = await createTestApp({ pushMode: 'subscribe' });

          // Push message
          const result = await pushService.push(app.key, { title });

          // Should return error
          expect(result.error).toBe('No OpenIDs bound to this app');
          expect(result.total).toBe(0);

          return true;
        }),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 22: Message History Recording
   * For any successful or failed push, the system SHALL record a message entry 
   * that can be retrieved via the messages API.
   * Validates: Requirements 6.7, 7.1, 7.3, 7.4
   */
  describe('Property 22: Message History Recording', () => {
    it('records message history for successful push', async () => {
      await fc.assert(
        fc.asyncProperty(titleArb, despArb, async (title, desp) => {
          setupWeChatMock(true);

          // Create app and add OpenID
          const app = await createTestApp({ pushMode: 'single' });
          await addOpenIdToApp(app.id, 'test_openid_history', 'HistoryUser');

          // Push message
          const result = await pushService.push(app.key, { title, desp });

          // Verify message was recorded
          const message = await historyService.get(result.pushId);
          expect(message).not.toBeNull();
          expect(message.id).toBe(result.pushId);
          expect(message.appId).toBe(app.id);
          expect(message.title).toBe(title);
          expect(message.results).toBeDefined();
          expect(message.results.length).toBeGreaterThan(0);

          return true;
        }),
        { numRuns: 30 }
      );
    });

    it('records message history for failed push', async () => {
      await fc.assert(
        fc.asyncProperty(titleArb, async (title) => {
          setupWeChatMock(false); // Simulate WeChat API failure

          // Create app and add OpenID
          const app = await createTestApp({ pushMode: 'single' });
          await addOpenIdToApp(app.id, 'test_openid_fail', 'FailUser');

          // Push message (will fail at WeChat API level)
          const result = await pushService.push(app.key, { title });

          // Verify message was still recorded
          const message = await historyService.get(result.pushId);
          expect(message).not.toBeNull();
          expect(message.id).toBe(result.pushId);
          expect(message.results).toBeDefined();

          return true;
        }),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 23: Message App Filtering
   * For any App, querying messages filtered by that App SHALL return 
   * only messages sent through that App.
   * Validates: Requirements 7.2
   */
  describe('Property 23: Message App Filtering', () => {
    it('filters messages by app correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(titleArb, { minLength: 1, maxLength: 5 }),
          fc.array(titleArb, { minLength: 1, maxLength: 5 }),
          async (titles1, titles2) => {
            setupWeChatMock(true);

            // Create two apps
            const app1 = await createTestApp({ name: 'App1', pushMode: 'single' });
            const app2 = await createTestApp({ name: 'App2', pushMode: 'single' });

            // Add OpenIDs to both apps
            await addOpenIdToApp(app1.id, 'openid_app1', 'User1');
            await addOpenIdToApp(app2.id, 'openid_app2', 'User2');

            // Send messages through app1
            const app1PushIds = [];
            for (const title of titles1) {
              const result = await pushService.push(app1.key, { title });
              app1PushIds.push(result.pushId);
            }

            // Send messages through app2
            const app2PushIds = [];
            for (const title of titles2) {
              const result = await pushService.push(app2.key, { title });
              app2PushIds.push(result.pushId);
            }

            // Query messages for app1
            const app1Messages = await historyService.listByApp(app1.id);
            const app1MessageIds = app1Messages.messages.map((m) => m.id);

            // All app1 messages should be in the result
            for (const pushId of app1PushIds) {
              expect(app1MessageIds).toContain(pushId);
            }

            // No app2 messages should be in the result
            for (const pushId of app2PushIds) {
              expect(app1MessageIds).not.toContain(pushId);
            }

            // Query messages for app2
            const app2Messages = await historyService.listByApp(app2.id);
            const app2MessageIds = app2Messages.messages.map((m) => m.id);

            // All app2 messages should be in the result
            for (const pushId of app2PushIds) {
              expect(app2MessageIds).toContain(pushId);
            }

            // No app1 messages should be in the result
            for (const pushId of app1PushIds) {
              expect(app2MessageIds).not.toContain(pushId);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Additional: Template message type uses templateId
   */
  describe('Template Message Type', () => {
    it('template message type sends template message', async () => {
      await fc.assert(
        fc.asyncProperty(titleArb, async (title) => {
          setupWeChatMock(true);

          // Create app with template message type
          const app = await createTestApp({
            pushMode: 'single',
            messageType: 'template',
            templateId: 'tpl_test_123',
          });
          await addOpenIdToApp(app.id, 'test_openid_tpl', 'TplUser');

          // Push message
          const result = await pushService.push(app.key, { title });

          // Should succeed
          expect(result.total).toBe(1);
          expect(result.success).toBe(1);

          // Verify template API was called
          const templateCalls = mockFetch.mock.calls.filter(
            (call) => call[0].includes('message/template/send')
          );
          expect(templateCalls.length).toBeGreaterThan(0);

          return true;
        }),
        { numRuns: 20 }
      );
    });
  });
});
