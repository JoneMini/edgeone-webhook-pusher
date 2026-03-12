/**
 * Admin Token 认证中间件
 */

import * as crypto from 'crypto';
import type { Next } from 'koa';
import type { AppContext } from '../types/context.js';
import { ApiError, ErrorCodes } from '../types/index.js';
import { configService } from '../services/config.service.js';
import { isValidAdminToken } from '../shared/utils.js';

function extractToken(ctx: AppContext): string | null {
  const authHeader = ctx.get('Authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1];
    }
  }

  const tokenHeader = ctx.get('X-Admin-Token');
  if (tokenHeader) {
    return tokenHeader;
  }

  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function adminAuth(ctx: AppContext, next: Next): Promise<void> {
  if (ctx.method === 'OPTIONS') {
    await next();
    return;
  }

  const token = extractToken(ctx);

  if (!token) {
    throw new ApiError(ErrorCodes.TOKEN_REQUIRED, 'Admin token is required', 401);
  }

  if (!isValidAdminToken(token)) {
    throw new ApiError(ErrorCodes.INVALID_TOKEN, 'Invalid admin token format', 401);
  }

  const config = await configService.getConfig();
  if (!config || !config.adminToken || !timingSafeEqual(config.adminToken, token)) {
    throw new ApiError(ErrorCodes.INVALID_TOKEN, 'Invalid admin token', 401);
  }

  ctx.state.adminToken = token;

  await next();
}

export async function hasValidAdminToken(ctx: AppContext): Promise<boolean> {
  const token = extractToken(ctx);
  if (!token || !isValidAdminToken(token)) {
    return false;
  }

  const config = await configService.getConfig();
  if (!config || !config.adminToken) {
    return false;
  }

  return timingSafeEqual(config.adminToken, token);
}
