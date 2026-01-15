/**
 * Channel Property Tests
 * Feature: system-restructure
 * 
 * Tests correctness properties for Channel service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock KV clients
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

// Mock the KV client module
vi.mock('../node-functions/shared/kv-client.js', () => ({
  channelsKV: mockChannelsKV,
  appsKV: mockAppsKV,
}));

// Import after mocking
const { channelService } = await import('../node-functions/modules/channel/service.js');

// Arbitrary generators for channel data
const channelNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);
const appIdArb = fc.string({ minLength: 10, maxLength: 50 });
const appSecretArb = fc.string({ minLength: 10, maxLength: 100 });

const channelInputArb = fc.record({
  name: channelNameArb,
  type: fc.constant('wechat'),
  config: fc.record({
    appId: appIdArb,
    appSecret: appSecretArb,
  }),
});

describe('Channel Property Tests', () => {
  beforeEach(() => {
    mockChannelsKV.clear();
    mockAppsKV.clear();
  });

  /**
   * Property 4: Channel CRUD Round-Trip
   * For any valid Channel data, creating a Channel then querying it SHALL return equivalent data;
   * updating it SHALL reflect the new values; deleting it SHALL make it unfindable.
   * Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.6
   */
  it('Property 4: Channel CRUD Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(channelInputArb, channelNameArb, async (input, newName) => {
        // Create
        const created = await channelService.create(input);
        expect(created.id).toBeDefined();
        expect(created.name).toBe(input.name.trim());
        expect(created.config.appId).toBe(input.config.appId);
        expect(created.config.appSecret).toBe(input.config.appSecret);

        // Read
        const fetched = await channelService.getById(created.id);
        expect(fetched).not.toBeNull();
        expect(fetched.id).toBe(created.id);
        expect(fetched.name).toBe(created.name);
        expect(fetched.config.appId).toBe(created.config.appId);

        // Update
        const updated = await channelService.update(created.id, { name: newName });
        expect(updated.name).toBe(newName.trim());

        // Verify update persisted
        const fetchedAfterUpdate = await channelService.getById(created.id);
        expect(fetchedAfterUpdate.name).toBe(newName.trim());

        // Delete
        await channelService.delete(created.id);

        // Verify deleted
        const fetchedAfterDelete = await channelService.getById(created.id);
        expect(fetchedAfterDelete).toBeNull();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Channel ID Uniqueness
   * For any sequence of Channel creations, all generated IDs SHALL be unique.
   * Validates: Requirements 3.8
   */
  it('Property 5: Channel ID Uniqueness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(channelInputArb, { minLength: 2, maxLength: 20 }),
        async (inputs) => {
          const ids = [];
          for (const input of inputs) {
            const channel = await channelService.create(input);
            ids.push(channel.id);
          }

          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6: Channel Deletion Constraint
   * For any Channel that is referenced by at least one App, deletion SHALL fail with an error.
   * Validates: Requirements 3.7
   */
  it('Property 6: Channel Deletion Constraint', async () => {
    await fc.assert(
      fc.asyncProperty(channelInputArb, async (input) => {
        // Create a channel
        const channel = await channelService.create(input);

        // Simulate an app referencing this channel
        const appId = 'app_test123';
        mockAppsKV.data.set('app_list', [appId]);
        mockAppsKV.data.set(`app:${appId}`, {
          id: appId,
          channelId: channel.id,
          name: 'Test App',
        });

        // Attempt to delete should fail
        await expect(channelService.delete(channel.id)).rejects.toThrow('referenced');

        // Channel should still exist
        const stillExists = await channelService.getById(channel.id);
        expect(stillExists).not.toBeNull();

        // Clean up mock app
        mockAppsKV.clear();

        // Now deletion should succeed
        await channelService.delete(channel.id);
        const deleted = await channelService.getById(channel.id);
        expect(deleted).toBeNull();

        return true;
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7: Channel Required Fields
   * For any Channel creation request missing appId or appSecret, the system SHALL return a validation error.
   * Validates: Requirements 3.2
   */
  it('Property 7: Channel Required Fields - missing appId', async () => {
    await fc.assert(
      fc.asyncProperty(channelNameArb, appSecretArb, async (name, appSecret) => {
        const input = {
          name,
          type: 'wechat',
          config: {
            appSecret,
            // appId is missing
          },
        };

        await expect(channelService.create(input)).rejects.toThrow('appId is required');
        return true;
      }),
      { numRuns: 50 }
    );
  });

  it('Property 7: Channel Required Fields - missing appSecret', async () => {
    await fc.assert(
      fc.asyncProperty(channelNameArb, appIdArb, async (name, appId) => {
        const input = {
          name,
          type: 'wechat',
          config: {
            appId,
            // appSecret is missing
          },
        };

        await expect(channelService.create(input)).rejects.toThrow('appSecret is required');
        return true;
      }),
      { numRuns: 50 }
    );
  });

  it('Property 7: Channel Required Fields - missing name', async () => {
    await fc.assert(
      fc.asyncProperty(appIdArb, appSecretArb, async (appId, appSecret) => {
        const input = {
          name: '',
          type: 'wechat',
          config: { appId, appSecret },
        };

        await expect(channelService.create(input)).rejects.toThrow('name is required');
        return true;
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Additional: Channel list contains created channels
   */
  it('Channel list contains all created channels', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(channelInputArb, { minLength: 1, maxLength: 10 }),
        async (inputs) => {
          const createdIds = [];
          for (const input of inputs) {
            const channel = await channelService.create(input);
            createdIds.push(channel.id);
          }

          const list = await channelService.list();
          const listIds = list.map((ch) => ch.id);

          for (const id of createdIds) {
            expect(listIds).toContain(id);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
