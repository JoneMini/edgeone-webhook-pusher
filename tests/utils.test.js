/**
 * Utility Functions Tests
 * Property 4: KV Operations Functional Equivalence (utils part)
 * Property 5: Authentication Functional Equivalence (utils part)
 * Validates: Requirements 7.1, 7.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateSendKey,
  generateId,
  now,
  maskCredential,
  maskCredentials,
  isValidSendKey,
  sanitizeInput,
  checkRateLimit,
} from '../node-functions/shared/utils.js';

describe('generateSendKey', () => {
  it('should generate URL-safe base64 string', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const key = generateSendKey();
        // URL-safe base64 characters only
        expect(/^[A-Za-z0-9_-]+$/.test(key)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate keys of at least 32 characters', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const key = generateSendKey();
        expect(key.length).toBeGreaterThanOrEqual(32);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate unique keys', () => {
    const keys = new Set();
    for (let i = 0; i < 100; i++) {
      keys.add(generateSendKey());
    }
    expect(keys.size).toBe(100);
  });
});

describe('generateId', () => {
  it('should generate hex string', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const id = generateId();
        expect(/^[a-f0-9]+$/.test(id)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate 32-character IDs', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const id = generateId();
        expect(id.length).toBe(32);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('now', () => {
  it('should return valid ISO timestamp', () => {
    const timestamp = now();
    expect(() => new Date(timestamp)).not.toThrow();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });
});

describe('maskCredential', () => {
  it('should mask short strings completely', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 8 }), (value) => {
        const masked = maskCredential(value);
        expect(masked).toBe('*'.repeat(value.length));
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve first 4 and last 4 characters for long strings', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 9, maxLength: 100 }), (value) => {
        const masked = maskCredential(value);
        expect(masked.startsWith(value.slice(0, 4))).toBe(true);
        expect(masked.endsWith(value.slice(-4))).toBe(true);
        expect(masked.length).toBe(value.length);
      }),
      { numRuns: 100 }
    );
  });
});

describe('maskCredentials', () => {
  it('should only mask specified sensitive fields', () => {
    const credentials = {
      appId: 'wx1234567890',
      appSecret: 'secret1234567890',
      templateId: 'template123',
    };
    const sensitiveFields = ['appSecret'];
    
    const masked = maskCredentials(credentials, sensitiveFields);
    
    expect(masked.appId).toBe(credentials.appId);
    expect(masked.templateId).toBe(credentials.templateId);
    expect(masked.appSecret).not.toBe(credentials.appSecret);
    expect(masked.appSecret).toContain('*');
  });
});

describe('isValidSendKey', () => {
  it('should validate generated SendKeys', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const key = generateSendKey();
        expect(isValidSendKey(key)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject short keys', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 31 }), (key) => {
        expect(isValidSendKey(key)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject keys with invalid characters', () => {
    const invalidKeys = [
      'a'.repeat(32) + '!',
      'a'.repeat(32) + ' ',
      'a'.repeat(32) + '@',
    ];
    invalidKeys.forEach((key) => {
      expect(isValidSendKey(key)).toBe(false);
    });
  });
});

describe('sanitizeInput', () => {
  it('should remove HTML tags', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(sanitizeInput('Hello <b>World</b>')).toBe('Hello bWorld/b');
  });

  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('should limit length to 10000 characters', () => {
    const longString = 'a'.repeat(20000);
    expect(sanitizeInput(longString).length).toBe(10000);
  });

  it('should preserve normal text', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('<') && !s.includes('>')),
        (input) => {
          const sanitized = sanitizeInput(input);
          expect(sanitized).toBe(input.trim().slice(0, 10000));
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('checkRateLimit', () => {
  it('should allow requests under limit', () => {
    const rateLimit = {
      count: 3,
      resetAt: new Date(Date.now() + 30000).toISOString(),
    };
    const result = checkRateLimit(rateLimit, 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('should deny requests at limit', () => {
    const rateLimit = {
      count: 5,
      resetAt: new Date(Date.now() + 30000).toISOString(),
    };
    const result = checkRateLimit(rateLimit, 5);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset when window expires', () => {
    const rateLimit = {
      count: 5,
      resetAt: new Date(Date.now() - 1000).toISOString(),
    };
    const result = checkRateLimit(rateLimit, 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should respect custom limit', () => {
    const rateLimit = {
      count: 5,
      resetAt: new Date(Date.now() + 30000).toISOString(),
    };
    const result = checkRateLimit(rateLimit, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});
