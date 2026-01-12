/**
 * Webhook-style Topic Push Route
 * Feature: multi-tenant-refactor
 *
 * URL: /:topicKey.topic
 * Methods: GET, POST
 * Query params: title (required), desp (optional)
 *
 * No authentication required - only validates TopicKey existence
 */

import { pushService } from '../services/push.js';
import { ErrorCodes, ErrorMessages } from '../shared/types.js';

/**
 * Create JSON response
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
 */
function errorResponse(status, code, message) {
  return jsonResponse(status, {
    code,
    message: message || ErrorMessages[code] || 'Unknown error',
    data: null,
  });
}

/**
 * Create success response
 */
function successResponse(data) {
  return jsonResponse(200, {
    code: 0,
    message: 'success',
    data,
  });
}

/**
 * Extract TopicKey from URL path
 * Supports: /TPKxxx.topic or /topic/TPKxxx
 * @param {string} pathname
 * @returns {string|null}
 */
function extractTopicKey(pathname) {
  // Pattern: /:topicKey.topic
  const dotMatch = pathname.match(/\/([^/]+)\.topic$/);
  if (dotMatch) {
    return dotMatch[1];
  }

  // Pattern: /topic/:topicKey
  const slashMatch = pathname.match(/\/topic\/([^/]+)/);
  if (slashMatch) {
    return slashMatch[1];
  }

  return null;
}

/**
 * Get parameters from request (URL params or body)
 * @param {Request} request
 * @returns {Promise<{ title?: string, desp?: string }>}
 */
async function getParams(request) {
  const url = new URL(request.url);
  const params = {
    title: url.searchParams.get('title'),
    desp: url.searchParams.get('desp'),
  };

  // For POST requests, also check body
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const body = await request.json();
        params.title = params.title || body.title;
        params.desp = params.desp || body.desp || body.content;
      } catch {
        // Ignore JSON parse errors
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      try {
        const text = await request.text();
        const formData = new URLSearchParams(text);
        params.title = params.title || formData.get('title');
        params.desp = params.desp || formData.get('desp');
      } catch {
        // Ignore form parse errors
      }
    }
  }

  return params;
}

/**
 * Map error code to HTTP status
 */
function getHttpStatus(errorCode) {
  switch (errorCode) {
    case ErrorCodes.KEY_NOT_FOUND:
      return 404;
    case ErrorCodes.RATE_LIMIT_EXCEEDED:
      return 429;
    case ErrorCodes.NO_SUBSCRIBERS:
      return 400;
    case ErrorCodes.MISSING_TITLE:
    case ErrorCodes.INVALID_PARAM:
      return 400;
    case ErrorCodes.INVALID_CONFIG:
      return 500;
    default:
      return 500;
  }
}

/**
 * Main route handler
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Only allow GET and POST
  if (request.method !== 'GET' && request.method !== 'POST') {
    return errorResponse(405, ErrorCodes.INVALID_PARAM, 'Method not allowed');
  }

  // Extract TopicKey from URL
  const topicKey = extractTopicKey(pathname);
  if (!topicKey) {
    return errorResponse(400, ErrorCodes.INVALID_PARAM, 'Invalid URL format');
  }

  // Get parameters
  const params = await getParams(request);

  // Validate title
  if (!params.title) {
    return errorResponse(400, ErrorCodes.MISSING_TITLE);
  }

  // Push message
  try {
    const result = await pushService.pushByTopicKey(topicKey, params.title, params.desp);

    if (result.error) {
      return errorResponse(getHttpStatus(result.error), result.error);
    }

    return successResponse({
      pushId: result.pushId,
      total: result.total,
      success: result.success,
      failed: result.failed,
      results: result.results,
    });
  } catch (error) {
    console.error('Topic push error:', error);
    return errorResponse(500, ErrorCodes.INTERNAL_ERROR, error.message);
  }
}
