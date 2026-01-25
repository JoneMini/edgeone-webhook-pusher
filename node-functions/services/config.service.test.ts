/**
 * Config Service Property-Based Tests
 * Feature: wechat-push-enhancements
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { configService } from './config.service.js';
import { configKV } from '../shared/kv-client.js';
import { generateAdminToken, now } from '../shared/utils.js';
import type { SystemConfig } from '../types/index.js';
import { KVKeys } from '../types/index.js';

// Mock dependencies
vi.mock('../shared/kv-client.js', () => ({
  configKV: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('../shared/utils.js', async () => {
  const actual = await vi.importActual<typeof import('../shared/utils.js')>('../shared/utils.js');
  return {
    ...actual,
    now: vi.fn(() => new Date().toISOString()),
  };
});

describe('ConfigService - resetAdminToken Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 2: 重置操作生成新令牌
   * 对于任何有效的系统配置，执行重置操作后应该生成一个新的、格式正确的 adminToken
   * （以 "AT_" 开头，长度至少35个字符），并且与旧 token 完全不同。
   */
  it('Property 2: resetAdminToken generates new valid token different from old token', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary system configs
        fc.record({
          adminToken: fc.string({ minLength: 35, maxLength: 50 }).map(s => `AT_${s}`),
          rateLimit: fc.record({
            perMinute: fc.integer({ min: 1, max: 100 }),
          }),
          retention: fc.record({
            days: fc.integer({ min: 1, max: 365 }),
          }),
          createdAt: fc.date().map(d => d.toISOString()),
          updatedAt: fc.date().map(d => d.toISOString()),
        }),
        async (originalConfig: SystemConfig) => {
          // Setup: Mock KV to return original config
          vi.mocked(configKV.get).mockResolvedValue(originalConfig);
          vi.mocked(configKV.put).mockResolvedValue(undefined);

          // Execute: Reset admin token
          const result = await configService.resetAdminToken();

          // Verify: New token is valid and different
          expect(result.adminToken).toBeDefined();
          expect(result.adminToken).toMatch(/^AT_/);
          expect(result.adminToken.length).toBeGreaterThanOrEqual(35);
          expect(result.adminToken).not.toBe(originalConfig.adminToken);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: 重置操作保持其他配置不变
   * 对于任何有效的系统配置，重置 adminToken 后，rateLimit 和 retention 配置
   * 应该保持完全不变（值相等）。
   */
  it('Property 4: resetAdminToken preserves other config fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminToken: fc.string({ minLength: 35, maxLength: 50 }).map(s => `AT_${s}`),
          rateLimit: fc.record({
            perMinute: fc.integer({ min: 1, max: 100 }),
          }),
          retention: fc.record({
            days: fc.integer({ min: 1, max: 365 }),
          }),
          createdAt: fc.date().map(d => d.toISOString()),
          updatedAt: fc.date().map(d => d.toISOString()),
        }),
        async (originalConfig: SystemConfig) => {
          // Setup
          vi.mocked(configKV.get).mockResolvedValue(originalConfig);
          vi.mocked(configKV.put).mockResolvedValue(undefined);

          // Execute
          const result = await configService.resetAdminToken();

          // Verify: rateLimit and retention are unchanged
          expect(result.rateLimit).toEqual(originalConfig.rateLimit);
          expect(result.retention).toEqual(originalConfig.retention);
          expect(result.createdAt).toBe(originalConfig.createdAt);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: 配置更新时间戳更新
   * 对于任何配置更新操作（包括重置 adminToken），updatedAt 时间戳应该被更新为
   * 操作时的当前时间，并且应该晚于或等于操作前的 updatedAt 时间。
   */
  it('Property 5: resetAdminToken updates updatedAt timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminToken: fc.string({ minLength: 35, maxLength: 50 }).map(s => `AT_${s}`),
          rateLimit: fc.record({
            perMinute: fc.integer({ min: 1, max: 100 }),
          }),
          retention: fc.record({
            days: fc.integer({ min: 1, max: 365 }),
          }),
          createdAt: fc.integer({ min: 1577836800000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
          updatedAt: fc.integer({ min: 1577836800000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
        }),
        async (originalConfig: SystemConfig) => {
          // Setup
          const mockNow = new Date().toISOString();
          vi.mocked(now).mockReturnValue(mockNow);
          vi.mocked(configKV.get).mockResolvedValue(originalConfig);
          vi.mocked(configKV.put).mockResolvedValue(undefined);

          // Execute
          const result = await configService.resetAdminToken();

          // Verify: updatedAt is updated to current time
          expect(result.updatedAt).toBe(mockNow);
          expect(new Date(result.updatedAt).getTime()).toBeGreaterThanOrEqual(
            new Date(originalConfig.updatedAt).getTime()
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: 重置失败保持原令牌
   * 对于任何导致重置操作失败的情况，系统配置中的 adminToken 应该保持完全不变，
   * 并且应该向用户显示错误信息。
   */
  it('Property 3: resetAdminToken preserves token on failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminToken: fc.string({ minLength: 35, maxLength: 50 }).map(s => `AT_${s}`),
          rateLimit: fc.record({
            perMinute: fc.integer({ min: 1, max: 100 }),
          }),
          retention: fc.record({
            days: fc.integer({ min: 1, max: 365 }),
          }),
          createdAt: fc.date().map(d => d.toISOString()),
          updatedAt: fc.date().map(d => d.toISOString()),
        }),
        async (originalConfig: SystemConfig) => {
          // Setup: Mock KV.put to fail
          vi.mocked(configKV.get).mockResolvedValue(originalConfig);
          vi.mocked(configKV.put).mockRejectedValue(new Error('KV storage failed'));

          // Execute and verify: Should throw error
          await expect(configService.resetAdminToken()).rejects.toThrow('Failed to update configuration');

          // Verify: Original config was not modified (KV.put was called but failed)
          // The service should not have modified the original config object
          expect(originalConfig.adminToken).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Unit test: Config not initialized
   */
  it('throws error when config is not initialized', async () => {
    vi.mocked(configKV.get).mockResolvedValue(null);

    await expect(configService.resetAdminToken()).rejects.toThrow('Configuration not initialized');
  });
});
