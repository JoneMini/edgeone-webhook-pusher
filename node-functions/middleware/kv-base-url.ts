/**
 * KV Base URL 中间件
 * 
 * 自动从请求上下文中提取域名，设置 KV API 的 baseUrl
 * 优先使用环境变量 KV_BASE_URL，否则自动检测当前域名
 * 
 * EdgeOne 环境说明：
 * - EdgeOne 默认携带 X-Forwarded-Proto 和 X-Forwarded-For 头
 * - 协议通过 X-Forwarded-Proto 获取（http/https/quic）
 * - 主机通过 Host 头获取
 */

import type { Context, Next } from 'koa';
import { runKVOperation } from '../shared/kv-client.js';

/**
 * 从请求上下文中提取 baseUrl
 * 支持 EdgeOne 和其他部署环境
 */
export function extractBaseUrl(ctx: Context): string {
  // 优先使用环境变量（本地开发或显式配置）
  const envUrl = process.env.KV_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim();
  }

  // 尝试使用 Koa 的 ctx.origin
  let origin = ctx.origin;
  
  // 如果 ctx.origin 为 null，手动构建
  if (!origin || origin === 'null') {
    const protocol = ctx.get('x-forwarded-proto') || ctx.protocol || 'https';
    
    // EdgeOne 特殊处理：从 referer 中提取真实域名
    const referer = ctx.get('referer');
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        origin = `${protocol}://${refererUrl.host}`;
        return origin;
      } catch (e) {
        // 解析失败，继续使用后备方案
      }
    }
    
    // 后备方案：使用 Host 头
    const host = ctx.get('x-forwarded-host') || ctx.get('host') || ctx.host;
    if (host) {
      origin = `${protocol}://${host}`;
    } else {
      return '';
    }
  }
  
  return origin;
}

/**
 * KV Base URL 中间件
 * 在每个请求开始时设置 KV API 的 baseUrl
 */
export async function kvBaseUrlMiddleware(ctx: Context, next: Next): Promise<void> {
  const baseUrl = extractBaseUrl(ctx);
  
  // 使用 AsyncLocalStorage 运行后续中间件
  await runKVOperation(baseUrl, () => next());
}
