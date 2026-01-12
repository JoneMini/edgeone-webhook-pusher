/**
 * Error Codes
 * Feature: frontend-admin-ui
 * 
 * Unified error codes for API responses.
 */

export const ErrorCodes = {
  // Success
  SUCCESS: 0,

  // 400xx - Client errors
  INVALID_STATE: 40001,
  STATE_EXPIRED: 40002,
  OAUTH_FAILED: 40003,
  NOT_FOLLOWED: 40004,
  ALREADY_BOUND: 40005,
  ALREADY_SUBSCRIBED: 40006,
  INVALID_PARAMS: 40007,
  UNAUTHORIZED: 40100,

  // 404xx - Not found
  SENDKEY_NOT_FOUND: 40401,
  TOPIC_NOT_FOUND: 40402,
  OPENID_NOT_FOUND: 40403,
  MESSAGE_NOT_FOUND: 40404,

  // 500xx - Server errors
  SERVER_ERROR: 50000,
  CONFIG_ERROR: 50001,
  WECHAT_API_ERROR: 50002,
};

export const ErrorMessages = {
  [ErrorCodes.SUCCESS]: '成功',
  [ErrorCodes.INVALID_STATE]: '无效的请求参数',
  [ErrorCodes.STATE_EXPIRED]: '链接已过期或无效',
  [ErrorCodes.OAUTH_FAILED]: '微信授权失败',
  [ErrorCodes.NOT_FOLLOWED]: '请先关注公众号',
  [ErrorCodes.ALREADY_BOUND]: '已绑定',
  [ErrorCodes.ALREADY_SUBSCRIBED]: '已订阅',
  [ErrorCodes.INVALID_PARAMS]: '参数错误',
  [ErrorCodes.UNAUTHORIZED]: '未授权',
  [ErrorCodes.SENDKEY_NOT_FOUND]: 'SendKey 不存在',
  [ErrorCodes.TOPIC_NOT_FOUND]: 'Topic 不存在',
  [ErrorCodes.OPENID_NOT_FOUND]: 'OpenID 不存在',
  [ErrorCodes.MESSAGE_NOT_FOUND]: '消息不存在',
  [ErrorCodes.SERVER_ERROR]: '服务器错误',
  [ErrorCodes.CONFIG_ERROR]: '配置错误',
  [ErrorCodes.WECHAT_API_ERROR]: '微信接口错误',
};

/**
 * Create error response
 * @param {number} code - Error code
 * @param {string} [message] - Custom message (optional)
 * @param {any} [detail] - Additional detail (optional)
 */
export function errorResponse(code, message, detail) {
  return {
    code,
    message: message || ErrorMessages[code] || '未知错误',
    ...(detail !== undefined && { detail }),
  };
}

/**
 * Create success response
 * @param {any} data - Response data
 * @param {string} [message] - Success message
 */
export function successResponse(data, message = '成功') {
  return {
    code: 0,
    message,
    data,
  };
}
