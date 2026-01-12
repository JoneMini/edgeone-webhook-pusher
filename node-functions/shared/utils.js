import { randomBytes } from 'crypto';
import { KeyPrefixes } from './types.js';

/**
 * Generate a cryptographically secure Admin Token
 * Format: AT_ + 32 URL-safe characters (total 35+ chars)
 * @returns {string}
 */
export function generateAdminToken() {
  const random = randomBytes(24).toString('base64url');
  return `${KeyPrefixes.ADMIN_TOKEN}${random}`;
}

/**
 * Generate a unique SendKey
 * Format: SCT + 29 URL-safe characters (total 32 chars)
 * @returns {string}
 */
export function generateSendKey() {
  const random = randomBytes(22).toString('base64url').slice(0, 29);
  return `${KeyPrefixes.SEND_KEY}${random}`;
}

/**
 * Generate a unique TopicKey
 * Format: TPK + 29 URL-safe characters (total 32 chars)
 * @returns {string}
 */
export function generateTopicKey() {
  const random = randomBytes(22).toString('base64url').slice(0, 29);
  return `${KeyPrefixes.TOPIC_KEY}${random}`;
}

/**
 * Generate a unique ID (hex format)
 * @returns {string}
 */
export function generateId() {
  return randomBytes(16).toString('hex');
}

/**
 * Generate a unique push ID
 * @returns {string}
 */
export function generatePushId() {
  return `push_${randomBytes(12).toString('hex')}`;
}

/**
 * Get current ISO timestamp
 * @returns {string}
 */
export function now() {
  return new Date().toISOString();
}

/**
 * Mask sensitive credential values
 * @param {string} value
 * @returns {string}
 */
export function maskCredential(value) {
  if (!value) return '';
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  return value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4);
}

/**
 * Mask all sensitive fields in credentials object
 * @param {Object} credentials
 * @param {string[]} sensitiveFields
 * @returns {Object}
 */
export function maskCredentials(credentials, sensitiveFields) {
  const masked = { ...credentials };
  for (const field of sensitiveFields) {
    if (masked[field]) {
      masked[field] = maskCredential(masked[field]);
    }
  }
  return masked;
}

/**
 * Validate Admin Token format
 * @param {string} token
 * @returns {boolean}
 */
export function isValidAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  if (!token.startsWith(KeyPrefixes.ADMIN_TOKEN)) return false;
  if (token.length < 35) return false;
  // URL-safe base64 characters only after prefix
  const suffix = token.slice(KeyPrefixes.ADMIN_TOKEN.length);
  return /^[A-Za-z0-9_-]+$/.test(suffix);
}

/**
 * Validate SendKey format
 * @param {string} sendKey
 * @returns {boolean}
 */
export function isValidSendKey(sendKey) {
  if (!sendKey || typeof sendKey !== 'string') return false;
  if (!sendKey.startsWith(KeyPrefixes.SEND_KEY)) return false;
  if (sendKey.length < 32) return false;
  // URL-safe base64 characters only after prefix
  const suffix = sendKey.slice(KeyPrefixes.SEND_KEY.length);
  return /^[A-Za-z0-9_-]+$/.test(suffix);
}

/**
 * Validate TopicKey format
 * @param {string} topicKey
 * @returns {boolean}
 */
export function isValidTopicKey(topicKey) {
  if (!topicKey || typeof topicKey !== 'string') return false;
  if (!topicKey.startsWith(KeyPrefixes.TOPIC_KEY)) return false;
  if (topicKey.length < 32) return false;
  // URL-safe base64 characters only after prefix
  const suffix = topicKey.slice(KeyPrefixes.TOPIC_KEY.length);
  return /^[A-Za-z0-9_-]+$/.test(suffix);
}

/**
 * Sanitize user input to prevent injection
 * @param {string} input
 * @returns {string}
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .trim()
    .slice(0, 10000); // Limit length
}

/**
 * Check rate limit
 * @param {{ count: number, resetAt: string }} rateLimit
 * @param {number} limit - Max requests per minute
 * @returns {{ allowed: boolean, remaining: number, resetAt: string, newCount: number }}
 */
export function checkRateLimit(rateLimit, limit = 5) {
  const currentTime = new Date();
  const resetAt = new Date(rateLimit?.resetAt || 0);

  // Reset if window expired
  if (currentTime >= resetAt) {
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(currentTime.getTime() + 60000).toISOString(),
      newCount: 1,
    };
  }

  // Check if under limit
  const currentCount = rateLimit?.count || 0;
  if (currentCount < limit) {
    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetAt: rateLimit.resetAt,
      newCount: currentCount + 1,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetAt: rateLimit.resetAt,
    newCount: currentCount,
  };
}

/**
 * Create initial rate limit state
 * @returns {{ count: number, resetAt: string }}
 */
export function createRateLimitState() {
  return {
    count: 0,
    resetAt: new Date(Date.now() + 60000).toISOString(),
  };
}

/**
 * Parse key from webhook URL path
 * Extracts key from formats like "SCTxxx.send" or "TPKxxx.topic"
 * @param {string} path
 * @returns {{ key: string, type: 'send' | 'topic' } | null}
 */
export function parseWebhookPath(path) {
  if (!path) return null;
  
  // Remove leading slash
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Match pattern: {key}.{type}
  const match = cleanPath.match(/^([A-Za-z0-9_-]+)\.(send|topic)$/);
  if (!match) return null;
  
  return {
    key: match[1],
    type: match[2],
  };
}
