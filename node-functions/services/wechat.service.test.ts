/**
 * WeChatService Property-Based Tests
 * 
 * Feature: config-channel-refactor
 * Tests correctness properties for WeChat service with channel-based credentials
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getAccessTokenCacheKey } from './wechat.service.js';
import type { Channel } from '../types/channel.js';

/**
 * Arbitrary generator for ISO date strings
 */
const isoDateArbitrary = fc.integer({ min: 1577836800000, max: 1893456000000 })
  .map(ts => new Date(ts).toISOString());

/**
 * Arbitrary generator for Channel objects
 */
const channelArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.constant('wechat' as const),
  config: fc.record({
    appId: fc.string({ minLength: 10, maxLength: 32 }).filter(s => s.length > 0),
    appSecret: fc.string({ minLength: 10, maxLength: 64 }).filter(s => s.length > 0),
  }),
  createdAt: isoDateArbitrary,
  updatedAt: isoDateArbitrary,
});

describe('WeChatService Property Tests', () => {
  /**
   * Property 3: Access token caching per channel
   * 
   * *For any* two different channels, the WeChat_Service SHALL use distinct 
   * cache keys for their access tokens, ensuring tokens are not shared between channels.
   * 
   * **Validates: Requirements 5.3**
   */
  describe('Property 3: Access token caching per channel', () => {
    it('should generate unique cache keys for channels with different appIds', () => {
      fc.assert(
        fc.property(
          channelArbitrary,
          channelArbitrary,
          (channel1, channel2) => {
            // Only test when appIds are different
            fc.pre(channel1.config.appId !== channel2.config.appId);
            
            const key1 = getAccessTokenCacheKey(channel1);
            const key2 = getAccessTokenCacheKey(channel2);
            
            // Different channels should have different cache keys
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate same cache key for channels with same appId', () => {
      fc.assert(
        fc.property(
          channelArbitrary,
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          (channel, differentId, differentName) => {
            // Create another channel with same appId but different id/name
            const channel2: Channel = {
              ...channel,
              id: differentId,
              name: differentName,
            };
            
            const key1 = getAccessTokenCacheKey(channel);
            const key2 = getAccessTokenCacheKey(channel2);
            
            // Same appId should produce same cache key
            expect(key1).toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cache key should contain appId for traceability', () => {
      fc.assert(
        fc.property(
          channelArbitrary,
          (channel) => {
            const cacheKey = getAccessTokenCacheKey(channel);
            
            // Cache key should include the appId
            expect(cacheKey).toContain(channel.config.appId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
