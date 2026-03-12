/**
 * CORS 中间件
 * 
 * 安全配置：
 * - 生产环境应配置具体的允许域名
 * - 限制允许的请求方法和头
 */

import type { Context, Next } from 'koa';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];

export async function cors(ctx: Context, next: Next): Promise<void> {
  const origin = ctx.get('Origin');
  
  if (origin) {
    if (ALLOWED_ORIGINS.length > 0) {
      if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
        ctx.set('Access-Control-Allow-Origin', origin);
      }
    } else {
      ctx.set('Access-Control-Allow-Origin', '*');
    }
  } else {
    ctx.set('Access-Control-Allow-Origin', '*');
  }
  
  ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
  ctx.set('Access-Control-Max-Age', '86400');
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('X-Frame-Options', 'DENY');
  ctx.set('X-XSS-Protection', '1; mode=block');

  if (ctx.method === 'OPTIONS') {
    ctx.status = 204;
    return;
  }

  await next();
}
