/**
 * Webhook Push Route
 * 
 * URL: /{appKey}.send
 * Methods: GET, POST
 * 
 * GET: Query params - title (required), desp (optional)
 * POST: JSON body - { title, desp }
 *
 * 安全说明：
 * - 通过 App Key 验证身份
 * - 消息长度限制防止滥用
 * - 安全头防止常见攻击
 */

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { pushService } from '../services/push.service.js';
import { kvBaseUrlMiddleware } from '../middleware/index.js';
import { ErrorCodes } from '../types/index.js';
import type { PushMessageInput } from '../types/index.js';

const app = new Koa();

app.proxy = true;

const MAX_TITLE_LENGTH = 1000;
const MAX_DESP_LENGTH = 10000;

app.use(kvBaseUrlMiddleware);

app.use(async (ctx, next) => {
  ctx.set('Access-Control-Allow-Origin', '*');
  ctx.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  ctx.set('Access-Control-Allow-Headers', 'Content-Type');
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('X-Frame-Options', 'DENY');

  if (ctx.method === 'OPTIONS') {
    ctx.status = 204;
    return;
  }

  await next();
});

app.use(bodyParser({
  jsonLimit: '32kb',
  formLimit: '32kb',
}));

app.use(async (ctx) => {
  const pathname = ctx.path;

  if (ctx.method !== 'GET' && ctx.method !== 'POST') {
    ctx.status = 405;
    ctx.body = {
      code: ErrorCodes.INVALID_PARAM,
      message: 'Method not allowed. Use GET or POST.',
      data: null,
    };
    return;
  }

  const appKey = extractAppKey(pathname);
  
  if (!appKey) {
    ctx.status = 400;
    ctx.body = {
      code: ErrorCodes.INVALID_PARAM,
      message: 'Invalid URL format',
      data: null,
    };
    return;
  }

  const message = parseMessage(ctx);

  if (!message.title) {
    ctx.status = 400;
    ctx.body = {
      code: ErrorCodes.MISSING_TITLE,
      message: 'Missing required field: title',
      data: null,
    };
    return;
  }

  if (message.title.length > MAX_TITLE_LENGTH) {
    ctx.status = 400;
    ctx.body = {
      code: ErrorCodes.INVALID_PARAM,
      message: `Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters`,
      data: null,
    };
    return;
  }

  if (message.desp && message.desp.length > MAX_DESP_LENGTH) {
    ctx.status = 400;
    ctx.body = {
      code: ErrorCodes.INVALID_PARAM,
      message: `Description exceeds maximum length of ${MAX_DESP_LENGTH} characters`,
      data: null,
    };
    return;
  }

  try {
    const result = await pushService.push(appKey, message);

    ctx.body = {
      code: 0,
      message: 'success',
      data: {
        pushId: result.pushId,
        total: result.total,
        success: result.success,
        failed: result.failed,
        results: result.results,
      },
    };
  } catch (error) {
    console.error('Push error:', error);
    ctx.status = 500;
    ctx.body = {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'Internal error',
      data: null,
    };
  }
});

function extractAppKey(pathname: string): string | null {
  const dotMatch = pathname.match(/\/([^/]+)\.send$/);
  if (dotMatch) {
    return dotMatch[1];
  }

  const slashMatch = pathname.match(/\/send\/([^/]+)/);
  if (slashMatch) {
    return slashMatch[1];
  }

  const directMatch = pathname.match(/^\/([A-Za-z0-9_-]+)$/);
  if (directMatch && directMatch[1].startsWith('APK')) {
    return directMatch[1];
  }

  return null;
}

function parseMessage(ctx: Koa.Context): PushMessageInput {
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  if (ctx.method === 'GET') {
    const desp = ctx.query.desp ? (ctx.query.desp as string) : '';
    const despWithTime = desp ? `${desp}\n\n⏰ ${timestamp}` : `⏰ ${timestamp}`;
    return {
      title: (ctx.query.title as string || '').slice(0, MAX_TITLE_LENGTH),
      desp: despWithTime.slice(0, MAX_DESP_LENGTH),
    };
  }

  const body = (ctx.request as { body?: { title?: string; desp?: string } }).body;
  const desp = body?.desp || '';
  const despWithTime = desp ? `${desp}\n\n⏰ ${timestamp}` : `⏰ ${timestamp}`;
  return {
    title: (body?.title || '').slice(0, MAX_TITLE_LENGTH),
    desp: despWithTime.slice(0, MAX_DESP_LENGTH),
  };
}

export default app;
