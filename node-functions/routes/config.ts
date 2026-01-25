/**
 * Config Management API Routes
 * 
 * @tag Config
 * @description 系统配置 API，用于管理系统级配置
 */

import Router from '@koa/router';
import type { AppContext } from '../types/context.js';
import { configService } from '../services/config.service.js';
import { adminAuth } from '../middleware/admin-auth.js';
import { ApiError, ErrorCodes } from '../types/index.js';
import type { SystemConfig } from '../types/index.js';

const router = new Router({ prefix: '/config' });

// 所有配置路由需要认证
router.use(adminAuth);

/**
 * 获取系统配置
 * @tag Config
 * @summary 获取系统配置
 * @description 获取当前系统配置，敏感信息已脱敏
 * @returns {SystemConfig} 系统配置
 */
router.get('/', async (ctx: AppContext) => {
  const config = await configService.getConfig();
  if (!config) {
    throw ApiError.badRequest('Configuration not found', ErrorCodes.INVALID_CONFIG);
  }

  // 脱敏敏感字段
  ctx.body = configService.maskConfig(config);
});

/**
 * 更新系统配置
 * @tag Config
 * @summary 更新系统配置
 * @description 更新系统配置，如速率限制、数据保留策略等
 * @param {object} body - 配置更新参数
 * @returns {SystemConfig} 更新后的系统配置
 */
router.put('/', async (ctx: AppContext) => {
  const updates = ctx.request.body as Partial<SystemConfig> | undefined;

  if (!updates || typeof updates !== 'object') {
    throw ApiError.badRequest('Request body must be an object');
  }

  const updatedConfig = await configService.updateConfig(updates);

  // 脱敏敏感字段
  ctx.body = configService.maskConfig(updatedConfig);
});

/**
 * 重置管理员令牌
 * @tag Config
 * @summary 重置管理员令牌
 * @description 生成新的管理员令牌并更新系统配置。旧令牌将立即失效。
 * @returns {object} 包含新管理员令牌和提示信息的对象
 */
router.post('/reset-token', async (ctx: AppContext) => {
  try {
    const updatedConfig = await configService.resetAdminToken();
    
    ctx.body = {
      adminToken: updatedConfig.adminToken,
      message: '管理员令牌已重置。请妥善保管新令牌，旧令牌已失效。',
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'Configuration not initialized') {
      throw ApiError.badRequest('系统配置未初始化', ErrorCodes.INVALID_CONFIG);
    }
    // 其他错误（如 KV 存储失败）
    throw ApiError.internal('重置令牌失败，请稍后重试');
  }
});

export default router;
