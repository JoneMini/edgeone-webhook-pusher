/**
 * Config Management API Routes
 * Feature: multi-tenant-refactor
 *
 * GET /api/config - Get application configuration
 * PUT /api/config - Update application configuration
 *
 * All routes require Admin Token authentication
 */

import { configService } from '../services/config.js';
import { withAdminAuth } from '../middleware/admin-auth.js';
import { ErrorCodes, ErrorMessages } from '../shared/types.js';

/**
 * Create JSON response
 * @param {number} status - HTTP status code
 * @param {Object} data - Response data
 * @returns {Response}
 */
function jsonResponse(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Create error response
 * @param {number} status - HTTP status code
 * @param {number} code - Error code
 * @param {string} [message] - Error message
 * @returns {Response}
 */
function errorResponse(status, code, message) {
  return jsonResponse(status, {
    success: false,
    error: {
      code,
      message: message || ErrorMessages[code] || 'Unknown error',
    },
  });
}

/**
 * GET /api/config - Get application configuration
 */
async function handleGetConfig(context) {
  try {
    const config = await configService.getConfig();
    if (!config) {
      return errorResponse(404, ErrorCodes.INVALID_CONFIG, 'Configuration not found');
    }

    // Mask sensitive fields
    const maskedConfig = configService.maskConfig(config);

    return jsonResponse(200, {
      success: true,
      data: maskedConfig,
    });
  } catch (error) {
    console.error('Get config error:', error);
    return errorResponse(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }
}

/**
 * PUT /api/config - Update application configuration
 */
async function handleUpdateConfig(context) {
  const { request } = context;

  try {
    // Parse request body
    let updates;
    try {
      updates = await request.json();
    } catch {
      return errorResponse(400, ErrorCodes.INVALID_PARAM, 'Invalid JSON body');
    }

    // Validate updates
    if (!updates || typeof updates !== 'object') {
      return errorResponse(400, ErrorCodes.INVALID_PARAM, 'Request body must be an object');
    }

    // Update config
    const updatedConfig = await configService.updateConfig(updates);

    // Mask sensitive fields
    const maskedConfig = configService.maskConfig(updatedConfig);

    return jsonResponse(200, {
      success: true,
      data: maskedConfig,
    });
  } catch (error) {
    console.error('Update config error:', error);
    return errorResponse(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }
}

/**
 * Main route handler
 */
export async function onRequest(context) {
  const { request } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
      },
    });
  }

  // All config routes require admin auth
  const handler = async (ctx) => {
    switch (request.method) {
      case 'GET':
        return handleGetConfig(ctx);
      case 'PUT':
        return handleUpdateConfig(ctx);
      default:
        return errorResponse(405, ErrorCodes.INVALID_PARAM, 'Method not allowed');
    }
  };

  return withAdminAuth(handler)(context);
}
