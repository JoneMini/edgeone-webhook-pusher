import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateAdminToken,
  generateSendKey,
  generateTopicKey,
  isValidAdminToken,
  isValidSendKey,
  isValidTopicKey,
} from '../node-functions/shared/utils.js';
import { KeyPrefixes } from '../node-functions/shared/types.js';

/**
 * Property-Based Tests for Key Generation
 * Feature: multi-tenant-refactor
 */

describe('Key Generation Properties', () => {
  /**
   * Property 2: Admin Token Uniqueness and Security
   * For any set of generated Admin_Tokens, each token SHALL be unique,
   * have sufficient length (≥32 characters), and contain only URL-safe characters.
   * Validates: Requirements 1.2, 1.5
   */
  describe('Property 2: Admin Token Uniqueness and Security', () => {
    it('should generate unique admin tokens', () => {
      fc.assert(
        fc.property(fc.integer({ min: 10, max: 100 }), (count) => {
          const tokens = new Set();
          for (let i = 0; i < count; i++) {
            tokens.add(generateAdminToken());
          }
          // All tokens should be unique
          return tokens.size === count;
        }),
        { numRuns: 100 }
      );
    });

    it('should generate admin tokens with correct prefix', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const token = generateAdminToken();
          return token.startsWith(KeyPrefixes.ADMIN_TOKEN);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate admin tokens with sufficient length (≥35 chars)', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const token = generateAdminToken();
          return token.length >= 35;
        }),
        { numRuns: 100 }
      );
    });

    it('should generate admin tokens with only URL-safe characters', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const token = generateAdminToken();
          // AT_ prefix + URL-safe base64 characters
          return /^AT_[A-Za-z0-9_-]+$/.test(token);
        }),
        { numRuns: 100 }
      );
    });

    it('should validate generated admin tokens', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const token = generateAdminToken();
          return isValidAdminToken(token);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Key Generation Uniqueness
   * For any set of generated SendKeys or TopicKeys, each key SHALL be unique
   * across all keys of the same type.
   * Validates: Requirements 4.1, 5.1
   */
  describe('Property 5: Key Generation Uniqueness', () => {
    describe('SendKey Uniqueness', () => {
      it('should generate unique SendKeys', () => {
        fc.assert(
          fc.property(fc.integer({ min: 10, max: 100 }), (count) => {
            const keys = new Set();
            for (let i = 0; i < count; i++) {
              keys.add(generateSendKey());
            }
            return keys.size === count;
          }),
          { numRuns: 100 }
        );
      });

      it('should generate SendKeys with correct prefix', () => {
        fc.assert(
          fc.property(fc.constant(null), () => {
            const key = generateSendKey();
            return key.startsWith(KeyPrefixes.SEND_KEY);
          }),
          { numRuns: 100 }
        );
      });

      it('should generate SendKeys with sufficient length (≥32 chars)', () => {
        fc.assert(
          fc.property(fc.constant(null), () => {
            const key = generateSendKey();
            return key.length >= 32;
          }),
          { numRuns: 100 }
        );
      });

      it('should generate SendKeys with only URL-safe characters', () => {
        fc.assert(
          fc.property(fc.constant(null), () => {
            const key = generateSendKey();
            return /^SCT[A-Za-z0-9_-]+$/.test(key);
          }),
          { numRuns: 100 }
        );
      });

      it('should validate generated SendKeys', () => {
        fc.assert(
          fc.property(fc.constant(null), () => {
            const key = generateSendKey();
            return isValidSendKey(key);
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('TopicKey Uniqueness', () => {
      it('should generate unique TopicKeys', () => {
        fc.assert(
          fc.property(fc.integer({ min: 10, max: 100 }), (count) => {
            const keys = new Set();
            for (let i = 0; i < count; i++) {
              keys.add(generateTopicKey());
            }
            return keys.size === count;
          }),
          { numRuns: 100 }
        );
      });

      it('should generate TopicKeys with correct prefix', () => {
        fc.assert(
          fc.property(fc.constant(null), () => {
            const key = generateTopicKey();
            return key.startsWith(KeyPrefixes.TOPIC_KEY);
          }),
          { numRuns: 100 }
        );
      });

      it('should generate TopicKeys with sufficient length (≥32 chars)', () => {
        fc.assert(
          fc.property(fc.constant(null), () => {
            const key = generateTopicKey();
            return key.length >= 32;
          }),
          { numRuns: 100 }
        );
      });

      it('should generate TopicKeys with only URL-safe characters', () => {
        fc.assert(
          fc.property(fc.constant(null), () => {
            const key = generateTopicKey();
            return /^TPK[A-Za-z0-9_-]+$/.test(key);
          }),
          { numRuns: 100 }
        );
      });

      it('should validate generated TopicKeys', () => {
        fc.assert(
          fc.property(fc.constant(null), () => {
            const key = generateTopicKey();
            return isValidTopicKey(key);
          }),
          { numRuns: 100 }
        );
      });
    });
  });

  /**
   * Validation function tests
   */
  describe('Key Validation', () => {
    it('should reject invalid admin tokens', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 50 }), (str) => {
          // Random strings should not be valid admin tokens (unless they happen to match)
          if (str.startsWith('AT_') && str.length >= 35 && /^AT_[A-Za-z0-9_-]+$/.test(str)) {
            return true; // Skip valid-looking strings
          }
          return !isValidAdminToken(str);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid SendKeys', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 50 }), (str) => {
          if (str.startsWith('SCT') && str.length >= 32 && /^SCT[A-Za-z0-9_-]+$/.test(str)) {
            return true; // Skip valid-looking strings
          }
          return !isValidSendKey(str);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid TopicKeys', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 50 }), (str) => {
          if (str.startsWith('TPK') && str.length >= 32 && /^TPK[A-Za-z0-9_-]+$/.test(str)) {
            return true; // Skip valid-looking strings
          }
          return !isValidTopicKey(str);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject null/undefined values', () => {
      expect(isValidAdminToken(null)).toBe(false);
      expect(isValidAdminToken(undefined)).toBe(false);
      expect(isValidSendKey(null)).toBe(false);
      expect(isValidSendKey(undefined)).toBe(false);
      expect(isValidTopicKey(null)).toBe(false);
      expect(isValidTopicKey(undefined)).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isValidAdminToken('')).toBe(false);
      expect(isValidSendKey('')).toBe(false);
      expect(isValidTopicKey('')).toBe(false);
    });

    it('should reject strings that are too short', () => {
      expect(isValidAdminToken('AT_short')).toBe(false);
      expect(isValidSendKey('SCTshort')).toBe(false);
      expect(isValidTopicKey('TPKshort')).toBe(false);
    });
  });
});
