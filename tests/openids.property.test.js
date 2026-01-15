/**
 * OpenID Property Tests
 * Feature: system-restructure
 * 
 * Tests correctness properties for OpenID service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock KV clients
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
  openidsKV: mockOpenidsKV,
  appsKV: mockAppsKV,
}));

// Import after mocking
const { openidService } = await import('../node-functions/modules/openid/service.js');

// Helper to create a test app
async function createTestApp() {
  const appId = `app_test${Date.now()}${Math.random().toString(36).slice(2)}`;
  const app = {
    id: appId,
    key: `APK_test${Date.now()}`,
    name: 'Test App',
    channelId: 'ch_test',
    pushMode: 'single',
    messageType: 'normal',
  };
  mockAppsKV.data.set(`app:${appId}`, app);
  return appId;
}

// Arbitrary generators for OpenID data
const openIdArb = fc.string({ minLength: 10, maxLength: 50 }).filter((s) => s.trim().length > 0);
const nicknameArb = fc.string({ minLength: 1, maxLength: 50 });
const remarkArb = fc.string({ minLength: 1, maxLength: 200 });

describe('OpenID Property Tests', () => {
  let testAppId;

  beforeEach(async () => {
    mockOpenidsKV.clear();
    mockAppsKV.clear();
    testAppId = await createTestApp();
  });

  /**
   * Property 14: OpenID CRUD Round-Trip
   * For any valid OpenID data within an App, creating an OpenID then querying it SHALL return equivalent data;
   * updating it SHALL reflect the new values; deleting it SHALL make it unfindable.
   * Validates: Requirements 5.1, 5.3, 5.4, 5.5, 5.6
   */
  it('Property 14: OpenID CRUD Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(openIdArb, nicknameArb, remarkArb, nicknameArb, async (openId, nickname, remark, newNickname) => {
        const input = { openId, nickname, remark };

        // Create
        const created = await openidService.create(testAppId, input);
        expect(created.id).toBeDefined();
        expect(created.appId).toBe(testAppId);
        expect(created.openId).toBe(openId.trim());
        expect(created.nickname).toBe(nickname.trim());
        expect(created.remark).toBe(remark.trim());

        // Read
        const fetched = await openidService.getById(created.id);
        expect(fetched).not.toBeNull();
        expect(fetched.id).toBe(created.id);
        expect(fetched.openId).toBe(created.openId);

        // Update
        const updated = await openidService.update(created.id, { nickname: newNickname });
        expect(updated.nickname).toBe(newNickname.trim());

        // Verify update persisted
        const fetchedAfterUpdate = await openidService.getById(created.id);
        expect(fetchedAfterUpdate.nickname).toBe(newNickname.trim());

        // Delete
        await openidService.delete(created.id);

        // Verify deleted
        const fetchedAfterDelete = await openidService.getById(created.id);
        expect(fetchedAfterDelete).toBeNull();

        return true;
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 15: OpenID Required Fields
   * For any OpenID creation request missing the openId value, the system SHALL return a validation error.
   * Validates: Requirements 5.2
   */
  it('Property 15: OpenID Required Fields - missing openId', async () => {
    await fc.assert(
      fc.asyncProperty(nicknameArb, async (nickname) => {
        const input = {
          openId: '',
          nickname,
        };

        await expect(openidService.create(testAppId, input)).rejects.toThrow('openId is required');
        return true;
      }),
      { numRuns: 20 }
    );
  });

  it('Property 15: OpenID Required Fields - whitespace only openId', async () => {
    const whitespaceStrings = ['   ', '\t\t', '\n\n', '  \t\n  '];
    
    for (const whitespace of whitespaceStrings) {
      const input = {
        openId: whitespace,
      };

      await expect(openidService.create(testAppId, input)).rejects.toThrow('openId is required');
    }
  });

  /**
   * Property 16: OpenID Uniqueness Within App
   * For any App, attempting to add the same openId value twice SHALL fail with an error on the second attempt.
   * Validates: Requirements 5.7
   */
  it('Property 16: OpenID Uniqueness Within App', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate alphanumeric strings to avoid trim edge cases
        fc.string({ minLength: 5, maxLength: 30 }).map((s) => s.replace(/\s/g, 'x')),
        async (openId) => {
          // Clear data before each property run
          mockOpenidsKV.clear();
          mockAppsKV.clear();
          const appId = await createTestApp();
          
          // First creation should succeed
          const first = await openidService.create(appId, { openId });
          expect(first.id).toBeDefined();

          // Second creation with same openId should fail
          await expect(openidService.create(appId, { openId })).rejects.toThrow('already exists');

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 16: Same OpenID can exist in different apps', async () => {
    await fc.assert(
      fc.asyncProperty(openIdArb, async (openId) => {
        // Create another test app
        const anotherAppId = await createTestApp();

        // Create OpenID in first app
        const first = await openidService.create(testAppId, { openId });
        expect(first.id).toBeDefined();

        // Create same OpenID in second app should succeed
        const second = await openidService.create(anotherAppId, { openId });
        expect(second.id).toBeDefined();
        expect(second.id).not.toBe(first.id);

        return true;
      }),
      { numRuns: 30 }
    );
  });

  /**
   * Additional: OpenID list contains all created OpenIDs for an app
   */
  it('OpenID list contains all created OpenIDs for an app', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 5, maxLength: 30 }).filter((s) => s.trim().length >= 5),
          { minLength: 1, maxLength: 10 }
        ),
        async (openIds) => {
          // Clear data before each property run
          mockOpenidsKV.clear();
          mockAppsKV.clear();
          const appId = await createTestApp();
          
          // Ensure unique openIds by trimming and deduplicating
          const uniqueOpenIds = [...new Set(openIds.map((o) => o.trim()))];
          
          const createdIds = [];
          for (const openId of uniqueOpenIds) {
            const record = await openidService.create(appId, { openId });
            createdIds.push(record.id);
          }

          const list = await openidService.listByApp(appId);
          const listIds = list.map((o) => o.id);

          for (const id of createdIds) {
            expect(listIds).toContain(id);
          }

          expect(list.length).toBe(uniqueOpenIds.length);

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Additional: existsInApp correctly detects existing OpenIDs
   */
  it('existsInApp correctly detects existing OpenIDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Use alphanumeric strings to avoid trim edge cases
        fc.string({ minLength: 5, maxLength: 20 }).map((s) => 'oid1_' + s.replace(/\s/g, 'x')),
        fc.string({ minLength: 5, maxLength: 20 }).map((s) => 'oid2_' + s.replace(/\s/g, 'y')),
        async (openId1, openId2) => {
          // Clear data before each property run
          mockOpenidsKV.clear();
          mockAppsKV.clear();
          const appId = await createTestApp();

          // Create first OpenID
          await openidService.create(appId, { openId: openId1 });

          // Check existence
          const exists1 = await openidService.existsInApp(appId, openId1);
          expect(exists1).toBe(true);

          const exists2 = await openidService.existsInApp(appId, openId2);
          expect(exists2).toBe(false);

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Additional: deleteByApp removes all OpenIDs for an app
   */
  it('deleteByApp removes all OpenIDs for an app', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(openIdArb, { minLength: 1, maxLength: 5 }),
        async (openIds) => {
          // Ensure unique openIds
          const uniqueOpenIds = [...new Set(openIds)];
          
          for (const openId of uniqueOpenIds) {
            await openidService.create(testAppId, { openId });
          }

          // Verify OpenIDs exist
          const listBefore = await openidService.listByApp(testAppId);
          expect(listBefore.length).toBe(uniqueOpenIds.length);

          // Delete all
          await openidService.deleteByApp(testAppId);

          // Verify all deleted
          const listAfter = await openidService.listByApp(testAppId);
          expect(listAfter.length).toBe(0);

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});
