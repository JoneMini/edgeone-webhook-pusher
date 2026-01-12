/**
 * Error codes for the push service
 */
export const ErrorCodes = {
  // Validation errors (400xx)
  MISSING_TITLE: 40001,
  INVALID_PARAM: 40002,
  INVALID_CONFIG: 40003,

  // Authentication errors (401xx)
  INVALID_TOKEN: 40101,
  TOKEN_REQUIRED: 40102,

  // Not found errors (404xx)
  KEY_NOT_FOUND: 40401,
  MESSAGE_NOT_FOUND: 40402,
  NO_SUBSCRIBERS: 40403,
  OPENID_NOT_FOUND: 40404,

  // Rate limit errors (429xx)
  RATE_LIMIT_EXCEEDED: 42901,

  // Internal errors (500xx)
  INTERNAL_ERROR: 50001,
  WECHAT_API_ERROR: 50002,
};

/**
 * Error messages corresponding to error codes
 */
export const ErrorMessages = {
  [ErrorCodes.MISSING_TITLE]: 'Message title is required',
  [ErrorCodes.INVALID_PARAM]: 'Invalid parameter',
  [ErrorCodes.INVALID_CONFIG]: 'Invalid configuration',
  [ErrorCodes.INVALID_TOKEN]: 'Invalid admin token',
  [ErrorCodes.TOKEN_REQUIRED]: 'Admin token is required',
  [ErrorCodes.KEY_NOT_FOUND]: 'SendKey or TopicKey not found',
  [ErrorCodes.MESSAGE_NOT_FOUND]: 'Message not found',
  [ErrorCodes.NO_SUBSCRIBERS]: 'Topic has no subscribers',
  [ErrorCodes.OPENID_NOT_FOUND]: 'OpenID not found',
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ErrorCodes.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCodes.WECHAT_API_ERROR]: 'WeChat API error',
};

/**
 * Message types
 */
export const MessageTypes = {
  SINGLE: 'single',
  TOPIC: 'topic',
};

/**
 * Default configuration values
 */
export const DefaultConfig = {
  rateLimit: {
    perMinute: 5,
  },
  retention: {
    days: 30,
  },
};

/**
 * Key prefixes for different data types
 */
export const KeyPrefixes = {
  ADMIN_TOKEN: 'AT_',
  SEND_KEY: 'SCT',
  TOPIC_KEY: 'TPK',
};

/**
 * KV key formats
 */
export const KVKeys = {
  CONFIG: 'config',
  SENDKEY_PREFIX: 'sk:',
  SENDKEY: (id) => `sk:${id}`,
  SENDKEY_INDEX: (key) => `sk_idx:${key}`,
  TOPIC_PREFIX: 'tp:',
  TOPIC: (id) => `tp:${id}`,
  TOPIC_INDEX: (key) => `tp_idx:${key}`,
  OPENID_PREFIX: 'oid:',
  OPENID: (id) => `oid:${id}`,
  OPENID_INDEX: (openId) => `oid_idx:${openId}`,
  MESSAGE_PREFIX: 'msg:',
  MESSAGE: (id) => `msg:${id}`,
  MESSAGE_LIST: 'msg_list',
};

/**
 * @typedef {Object} AppConfig
 * @property {string} adminToken - Admin token (read-only after creation)
 * @property {Object} wechat - WeChat configuration
 * @property {string} wechat.appId - WeChat public account AppID
 * @property {string} wechat.appSecret - WeChat public account AppSecret
 * @property {string} wechat.templateId - Template message ID
 * @property {Object} rateLimit - Rate limit settings
 * @property {number} rateLimit.perMinute - Messages per minute per key
 * @property {Object} retention - Message retention settings
 * @property {number} retention.days - Days to retain messages
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * @typedef {Object} SendKeyData
 * @property {string} id - Internal ID
 * @property {string} key - SendKey value (SCT prefix)
 * @property {string} name - Display name
 * @property {string} openIdRef - Reference to OpenID record ID
 * @property {Object} rateLimit - Rate limit state
 * @property {number} rateLimit.count - Current count
 * @property {string} rateLimit.resetAt - ISO timestamp for reset
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * @typedef {Object} TopicData
 * @property {string} id - Internal ID
 * @property {string} key - TopicKey value (TPK prefix)
 * @property {string} name - Display name
 * @property {string[]} subscriberRefs - Array of OpenID record IDs
 * @property {Object} rateLimit - Rate limit state
 * @property {number} rateLimit.count - Current count
 * @property {string} rateLimit.resetAt - ISO timestamp for reset
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * @typedef {Object} OpenIdData
 * @property {string} id - Internal ID
 * @property {string} openId - WeChat OpenID
 * @property {string} [name] - Display name
 * @property {string} source - Source (e.g., 'wechat')
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * @typedef {Object} MessageData
 * @property {string} id - Push ID
 * @property {'single'|'topic'} type - Message type
 * @property {string} keyId - SendKey ID or TopicKey ID
 * @property {string} title - Message title
 * @property {string} [content] - Message content
 * @property {DeliveryResult[]} results - Delivery results
 * @property {string} createdAt - ISO timestamp
 */

/**
 * @typedef {Object} DeliveryResult
 * @property {string} openId - Target OpenID
 * @property {boolean} success - Whether delivery succeeded
 * @property {string} [error] - Error message if failed
 * @property {string} [msgId] - WeChat message ID if succeeded
 */

/**
 * @typedef {Object} PushResult
 * @property {string} pushId - Push ID
 * @property {boolean} success - Whether push succeeded
 * @property {string} [error] - Error message if failed
 * @property {string} [msgId] - WeChat message ID if succeeded
 */

/**
 * @typedef {Object} TopicPushResult
 * @property {string} pushId - Push ID
 * @property {number} total - Total subscribers
 * @property {number} success - Successful deliveries
 * @property {number} failed - Failed deliveries
 * @property {DeliveryResult[]} results - Individual results
 */
