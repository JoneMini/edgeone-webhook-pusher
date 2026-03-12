/**
 * 统一错误处理中间件
 */

import type { Context, Next } from 'koa';
import { ApiError, ErrorCodes, ErrorMessages, getHttpStatus } from '../types/index.js';

const isProduction = process.env.NODE_ENV === 'production';

export async function errorHandler(ctx: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (err) {
    if (err instanceof ApiError) {
      ctx.status = err.statusCode;
      ctx.body = {
        code: err.code,
        message: err.message,
        data: null,
      };
      return;
    }

    if (err && typeof err === 'object' && 'status' in err) {
      const koaError = err as { status: number; message?: string };
      const status = koaError.status || 500;
      const code = status === 404 ? ErrorCodes.KEY_NOT_FOUND :
                   status === 401 ? ErrorCodes.UNAUTHORIZED :
                   status === 400 ? ErrorCodes.INVALID_PARAM :
                   ErrorCodes.INTERNAL_ERROR;
      
      ctx.status = status;
      ctx.body = {
        code,
        message: koaError.message || ErrorMessages[code] || 'Unknown error',
        data: null,
      };
      return;
    }

    ctx.status = 500;
    ctx.body = {
      code: ErrorCodes.INTERNAL_ERROR,
      message: isProduction ? 'Internal server error' : (err instanceof Error ? err.message : 'Internal server error'),
      data: null,
    };

    if (!isProduction) {
      console.error('[Error]', err);
    }
  }
}
