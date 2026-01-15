/**
 * App Property Tests
 * Feature: system-restructure
 * 
 * Tests correctness properties for App service
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

// Mock the KV client module
vi.mock('../node-functions/shared/kv-client.js', () => ({
  appsKV: mockAppsKV,
  channelsKV: mockChannelsKV,
  openidsKV: mockOpenidsKV,
}));

// Import after mocking
const { appService } = await import('../node-functions/modules/app/service.js');

// Helper to create a test channel
async function createTestChannel() {
  const channelId = `ch_test${Date.now()}${Math.random().toString(36).slice(2)}`;
  const channel = {
    id: channelId,
    name: 'Test Channel',
    type: 'wechat',
    config: { appId: 'wx123', appSecret: 'secret123' },
  };
  mockChannelsKV.data.set(`ch:${channelId}`, channel);
  return channelId;
}

// Arbitrary generators for app data
const appNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);
const pushModeArb = fc.constantFrom('single', 'subscribe');
const messageTypeArb = fc.constantFrom('normal', 'template');
const templateIdArb = fc.string({ minLength: 5, maxLength: 50 });

describe('App Property Tests', () => {
  let testChannelId;

  beforeEach(async () => {
    mockAppsKV.clear();
    mockChannelsKV.clear();
    mockOpenidsKV.clear();
    testChannelId = await createTestChannel();
  });

  /**
   * Property 8: App CRUD Round-Trip
   * For any valid App data, creating an App then querying it SHALL return equivalent data;
   * updating it SHALL reflect the new values; deleting it SHALL make it unfindable.
   * Validates: Requirements 4.4, 4.5, 4.6, 4.7
   */
  it('Property 8: App CRUD Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(appNameArb, pushModeArb, appNameArb, async (name, pushMode, newName) => {
        const input = {
          name,
          channelId: testChannelId,
          pushMode,
          messageType: 'normal',
        };

        // Create
        const created = await appService.create(input);
        expect(created.id).toBeDefined();
        expect(created.key).toBeDefined();
        expect(created.name).toBe(name.trim());
        expect(created.channelId).toBe(testChannelId);
        expect(created.pushMode).toBe(pushMode);

        // Read
        const fetched = await appService.getById(created.id);
        expect(fetched).not.toBeNull();
        expect(fetched.id).toBe(created.id);
        expect(fetched.name).toBe(created.name);

        // Read by key
        const fetchedByKey = await appService.getByKey(created.key);
        expect(fetchedByKey).not.toBeNull();
        expect(fetchedByKey.id).toBe(created.id);

        // Update
        const updated = await appService.update(created.id, { name: newName });
        expect(updated.name).toBe(newName.trim());

        // Verify update persisted
        const fetchedAfterUpdate = await appService.getById(created.id);
        expect(fetchedAfterUpdate.name).toBe(newName.trim());

        // Delete
        await appService.delete(created.id);

        // Verify deleted
        const fetchedAfterDelete = await appService.getById(created.id);
        expect(fetchedAfterDelete).toBeNull();

        // Verify key index also deleted
        const fetchedByKeyAfterDelete = await appService.getByKey(created.key);
        expect(fetchedByKeyAfterDelete).toBeNull();

        return true;
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 9: App Key Uniqueness
   * For any sequence of App creations, all generated App Keys SHALL be unique.
   * Validates: Requirements 4.3
   */
  it('Property 9: App Key Uniqueness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(appNameArb, { minLength: 2, maxLength: 20 }),
        async (names) => {
          const keys = [];
          for (const name of names) {
            const app = await appService.create({
              name,
              channelId: testChannelId,
              pushMode: 'single',
              messageType: 'normal',
            });
            keys.push(app.key);
          }

          const uniqueKeys = new Set(keys);
          expect(uniqueKeys.size).toBe(keys.length);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10: App Required Fields
   * For any App creation request missing name, channelId, or pushMode, the system SHALL return a validation error.
   * Validates: Requirements 4.1
   */
  it('Property 10: App Required Fields - missing name', async () => {
    await fc.assert(
      fc.asyncProperty(pushModeArb, async (pushMode) => {
        const input = {
          name: '',
          channelId: testChannelId,
          pushMode,
          messageType: 'normal',
        };

        await expect(appService.create(input)).rejects.toThrow('name is required');
        return true;
      }),
      { numRuns: 20 }
    );
  });

  it('Property 10: App Required Fields - missing channelId', async () => {
    await fc.assert(
      fc.asyncProperty(appNameArb, pushModeArb, async (name, pushMode) => {
        const input = {
          name,
          pushMode,
          messageType: 'normal',
        };

        await expect(appService.create(input)).rejects.toThrow('channelId is required');
        return true;
      }),
      { numRuns: 20 }
    );
  });

  it('Property 10: App Required Fields - missing pushMode', async () => {
    await fc.assert(
      fc.asyncProperty(appNameArb, async (name) => {
        const input = {
          name,
          channelId: testChannelId,
          messageType: 'normal',
        };

        await expect(appService.create(input)).rejects.toThrow('pushMode is required');
        return true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 11: App Template ID Requirement
   * For any App creation with messageType='template' but missing templateId, the system SHALL return a validation error.
   * Validates: Requirements 4.2
   */
  it('Property 11: App Template ID Requirement', async () => {
    await fc.assert(
      fc.asyncProperty(appNameArb, pushModeArb, async (name, pushMode) => {
        const input = {
          name,
          channelId: testChannelId,
          pushMode,
          messageType: 'template',
          // templateId is missing
        };

        await expect(appService.create(input)).rejects.toThrow('templateId is required');
        return true;
      }),
      { numRuns: 20 }
    );
  });

  it('Property 11: App Template ID Requirement - with templateId succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(appNameArb, pushModeArb, templateIdArb, async (name, pushMode, templateId) => {
        const input = {
          name,
          channelId: testChannelId,
          pushMode,
          messageType: 'template',
          templateId,
        };

        const app = await appService.create(input);
        expect(app.templateId).toBe(templateId);
        return true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 12: App Channel Reference Validation
   * For any App creation with a non-existent channelId, the system SHALL return a validation error.
   * Validates: Requirements 4.9
   */
  it('Property 12: App Channel Reference Validation', async () => {
    await fc.assert(
      fc.asyncProperty(appNameArb, pushModeArb, async (name, pushMode) => {
        const input = {
          name,
          channelId: 'ch_nonexistent',
          pushMode,
          messageType: 'normal',
        };

        await expect(appService.create(input)).rejects.toThrow('Channel not found');
        return true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 13: App Cascade Delete
   * For any App deletion, all OpenIDs bound to that App SHALL also be deleted.
   * Validates: Requirements 4.8
   */
  it('Property 13: App Cascade Delete', async () => {
    await fc.assert(
      fc.asyncProperty(
        appNameArb,
        fc.array(fc.string({ minLength: 10, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
        async (name, openIds) => {
          // Create app
          const app = await appService.create({
            name,
            channelId: testChannelId,
            pushMode: 'subscribe',
            messageType: 'normal',
          });

          // Simulate adding OpenIDs to the app
          const openIdRecordIds = [];
          for (let i = 0; i < openIds.length; i++) {
            const oidId = `oid_test${i}`;
            openIdRecordIds.push(oidId);
            mockOpenidsKV.data.set(`oid:${oidId}`, {
              id: oidId,
              appId: app.id,
              openId: openIds[i],
            });
            mockOpenidsKV.data.set(`oid_idx:${app.id}:${openIds[i]}`, oidId);
          }
          mockOpenidsKV.data.set(`oid_app:${app.id}`, openIdRecordIds);

          // Verify OpenIDs exist
          const openIdList = mockOpenidsKV.data.get(`oid_app:${app.id}`);
          expect(openIdList.length).toBe(openIds.length);

          // Delete app
          await appService.delete(app.id);

          // Verify app deleted
          const deletedApp = await appService.getById(app.id);
          expect(deletedApp).toBeNull();

          // Verify OpenIDs deleted
          const deletedOpenIdList = mockOpenidsKV.data.get(`oid_app:${app.id}`);
          expect(deletedOpenIdList).toBeUndefined();

          for (const oidId of openIdRecordIds) {
            const deletedOid = mockOpenidsKV.data.get(`oid:${oidId}`);
            expect(deletedOid).toBeUndefined();
          }

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Additional: App list contains all created apps
   */
  it('App list contains all created apps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(appNameArb, { minLength: 1, maxLength: 10 }),
        async (names) => {
          const createdIds = [];
          for (const name of names) {
            const app = await appService.create({
              name,
              channelId: testChannelId,
              pushMode: 'single',
              messageType: 'normal',
            });
            createdIds.push(app.id);
          }

          const list = await appService.list();
          const listIds = list.map((a) => a.id);

          for (const id of createdIds) {
            expect(listIds).toContain(id);
          }

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});
