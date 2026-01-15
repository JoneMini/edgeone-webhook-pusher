/**
 * Authentication Property Tests
 * Feature: system-restructure
 * 
 * Tests correctness properties for Authentication and Initialization
 * Properties 1-3 from design document
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock KV client
const mockConfigKV = {
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
  configKV: mockConfigKV,
  channelsKV: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  appsKV: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  openidsKV: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  messagesKV: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// Import after mocking
const { authService } = await import('../node-functions/services/auth.js');
const { configService } = await import('../node-functions/services/config.js');

// Helper to clear state before each property test iteration
function clearState() {
  mockConfigKV.clear();
}

// Arbitrary generators
const tokenArb = fc.string({ minLength: 10, maxLength: 50 });
const wechatConfigArb = fc.record({
  appId: fc.string({ minLength: 5, maxLength: 30 }),
  appSecret: fc.string({ minLength: 10, maxLength: 50 }),
  templateId: fc.string({ minLength: 5, maxLength: 50 }),
});

describe('Authentication Property Tests', () => {
  beforeEach(() => {
    clearState();
  });

  /**
   * Property 1: Admin Token Immutability
   * For any initialized system, the Admin Token SHALL remain unchanged 
   * regardless of any subsequent operations (config updates, channel/app/openid operations).
   * Validates: Requirements 1.4
   */
  describe('Property 1: Admin Token Immutability', () => {
    it('admin token cannot be changed via config update', async () => {
      await fc.assert(
        fc.asyncProperty(wechatConfigArb, async (wechatConfig) => {
          clearState(); // Clear before each iteration
          
          // Initialize system
          const initResult = await authService.initialize(wechatConfig);
          const originalToken = initResult.adminToken;

          // Try to update config with a new adminToken
          await configService.updateConfig({
            adminToken: 'NEW_FAKE_TOKEN_12345',
            wechat: { appId: 'updated_app_id' },
          });

          // Verify token is unchanged
          const config = await configService.getConfig();
          expect(config.adminToken).toBe(originalToken);
          expect(config.adminToken).not.toBe('NEW_FAKE_TOKEN_12345');

          return true;
        }),
        { numRuns: 30 }
      );
    });

    it('admin token remains unchanged after multiple config updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          wechatConfigArb,
          fc.array(fc.record({
            rateLimit: fc.record({ perMinute: fc.integer({ min: 1, max: 100 }) }),
            retention: fc.record({ days: fc.integer({ min: 1, max: 365 }) }),
          }), { minLength: 1, maxLength: 5 }),
          async (wechatConfig, updates) => {
            clearState(); // Clear before each iteration
            
            // Initialize system
            const initResult = await authService.initialize(wechatConfig);
            const originalToken = initResult.adminToken;

            // Apply multiple updates
            for (const update of updates) {
              await configService.updateConfig(update);
            }

            // Verify token is still unchanged
            const config = await configService.getConfig();
            expect(config.adminToken).toBe(originalToken);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 2: Authentication Correctness
   * For any Admin API request, the system SHALL return 401 if and only if 
   * the provided X-Admin-Token header is missing or does not match the stored Admin Token.
   * Validates: Requirements 2.1, 2.2, 2.3
   */
  describe('Property 2: Authentication Correctness', () => {
    it('valid token is accepted', async () => {
      await fc.assert(
        fc.asyncProperty(wechatConfigArb, async (wechatConfig) => {
          clearState(); // Clear before each iteration
          
          // Initialize system
          const initResult = await authService.initialize(wechatConfig);
          const validToken = initResult.adminToken;

          // Validate with correct token
          const isValid = await authService.validateAdminToken(validToken);
          expect(isValid).toBe(true);

          return true;
        }),
        { numRuns: 30 }
      );
    });

    it('invalid token is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(wechatConfigArb, tokenArb, async (wechatConfig, fakeToken) => {
          clearState(); // Clear before each iteration
          
          // Initialize system
          const initResult = await authService.initialize(wechatConfig);

          // Skip if fake token happens to match (extremely unlikely)
          if (fakeToken === initResult.adminToken) {
            return true;
          }

          // Validate with incorrect token
          const isValid = await authService.validateAdminToken(fakeToken);
          expect(isValid).toBe(false);

          return true;
        }),
        { numRuns: 50 }
      );
    });

    it('missing token is rejected', async () => {
      await fc.assert(
        fc.asyncProperty(wechatConfigArb, async (wechatConfig) => {
          clearState(); // Clear before each iteration
          
          // Initialize system
          await authService.initialize(wechatConfig);

          // Validate with null/undefined/empty token
          expect(await authService.validateAdminToken(null)).toBe(false);
          expect(await authService.validateAdminToken(undefined)).toBe(false);
          expect(await authService.validateAdminToken('')).toBe(false);

          return true;
        }),
        { numRuns: 20 }
      );
    });

    it('token validation fails when system not initialized', async () => {
      await fc.assert(
        fc.asyncProperty(tokenArb, async (token) => {
          clearState(); // Clear before each iteration
          
          // Don't initialize - system is empty
          const isValid = await authService.validateAdminToken(token);
          expect(isValid).toBe(false);

          return true;
        }),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 3: Initialization Idempotence
   * For any already-initialized system, calling the initialization endpoint 
   * SHALL return an error and not modify the existing Admin Token.
   * Validates: Requirements 1.2
   */
  describe('Property 3: Initialization Idempotence', () => {
    it('second initialization attempt fails', async () => {
      await fc.assert(
        fc.asyncProperty(wechatConfigArb, wechatConfigArb, async (config1, config2) => {
          clearState(); // Clear before each iteration
          
          // First initialization should succeed
          const initResult = await authService.initialize(config1);
          const originalToken = initResult.adminToken;

          // Second initialization should fail
          await expect(authService.initialize(config2)).rejects.toThrow('already initialized');

          // Verify original token is unchanged
          const config = await configService.getConfig();
          expect(config.adminToken).toBe(originalToken);

          return true;
        }),
        { numRuns: 30 }
      );
    });

    it('multiple initialization attempts all fail after first', async () => {
      await fc.assert(
        fc.asyncProperty(
          wechatConfigArb,
          fc.array(wechatConfigArb, { minLength: 2, maxLength: 5 }),
          async (firstConfig, subsequentConfigs) => {
            clearState(); // Clear before each iteration
            
            // First initialization should succeed
            const initResult = await authService.initialize(firstConfig);
            const originalToken = initResult.adminToken;

            // All subsequent attempts should fail
            for (const config of subsequentConfigs) {
              await expect(authService.initialize(config)).rejects.toThrow('already initialized');
            }

            // Verify original token is still unchanged
            const config = await configService.getConfig();
            expect(config.adminToken).toBe(originalToken);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Additional: Token format validation
   */
  describe('Token Format Validation', () => {
    it('generated tokens have correct format', async () => {
      await fc.assert(
        fc.asyncProperty(wechatConfigArb, async (wechatConfig) => {
          clearState(); // Clear before each iteration
          
          const initResult = await authService.initialize(wechatConfig);
          const token = initResult.adminToken;

          // Token should start with AT_
          expect(token.startsWith('AT_')).toBe(true);
          
          // Token should be at least 35 characters
          expect(token.length).toBeGreaterThanOrEqual(35);
          
          // Token suffix should be URL-safe base64
          const suffix = token.slice(3);
          expect(/^[A-Za-z0-9_-]+$/.test(suffix)).toBe(true);

          return true;
        }),
        { numRuns: 30 }
      );
    });

    it('all generated tokens are unique', async () => {
      // Generate multiple tokens by reinitializing
      const tokens = [];
      for (let i = 0; i < 20; i++) {
        clearState();
        const result = await authService.initialize({ appId: `app${i}`, appSecret: `secret${i}` });
        tokens.push(result.adminToken);
      }

      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });
  });

  /**
   * Additional: Initialization status
   */
  describe('Initialization Status', () => {
    it('isInitialized returns false before initialization', async () => {
      clearState();
      const isInit = await authService.isInitialized();
      expect(isInit).toBe(false);
    });

    it('isInitialized returns true after initialization', async () => {
      await fc.assert(
        fc.asyncProperty(wechatConfigArb, async (wechatConfig) => {
          clearState(); // Clear before each iteration
          
          await authService.initialize(wechatConfig);
          const isInit = await authService.isInitialized();
          expect(isInit).toBe(true);

          return true;
        }),
        { numRuns: 20 }
      );
    });

    it('getStatus returns correct status', async () => {
      clearState();
      
      // Before initialization
      let status = await authService.getStatus();
      expect(status.initialized).toBe(false);

      // After initialization with WeChat config
      await authService.initialize({
        appId: 'wx_test',
        appSecret: 'secret_test',
        templateId: 'tpl_test',
      });

      status = await authService.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.hasWeChatConfig).toBe(true);
    });
  });
});
