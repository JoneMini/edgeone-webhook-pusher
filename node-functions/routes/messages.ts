/**
 * Message History API Routes
 * 
 * @tag Messages
 * @description 消息历史 API，用于查询推送消息的历史记录
 */

import Router from '@koa/router';
import type { AppContext } from '../types/context.js';
import { messageService } from '../services/message.service.js';
import { adminAuth } from '../middleware/admin-auth.js';
import { ApiError, ErrorCodes } from '../types/index.js';

const router = new Router({ prefix: '/messages' });

// 所有消息路由需要认证
router.use(adminAuth);

/**
 * 获取消息历史列表
 * @tag Messages
 * @summary 获取消息历史
 * @description 分页获取推送消息的历史记录，支持按应用和日期筛选
 * @param {number} page - 页码，默认 1
 * @param {number} pageSize - 每页数量，默认 20，最大 100
 * @param {string} appId - 按应用筛选
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @returns {object} 消息列表和分页信息
 */
router.get('/', async (ctx: AppContext) => {
  const { page, pageSize, appId, startDate, endDate } = ctx.query;

  const pageNum = parseInt(page as string || '1', 10);
  const pageSizeNum = parseInt(pageSize as string || '20', 10);

  // 验证参数
  if (pageNum < 1) {
    throw ApiError.badRequest('page must be >= 1');
  }
  if (pageSizeNum < 1 || pageSizeNum > 100) {
    throw ApiError.badRequest('pageSize must be between 1 and 100');
  }

  const result = await messageService.list({
    page: pageNum,
    pageSize: pageSizeNum,
    appId: appId as string | undefined,
    startDate: startDate as string | undefined,
    endDate: endDate as string | undefined,
  });

  // 返回带分页信息的响应
  ctx.body = {
    items: result.messages,
    pagination: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.ceil(result.total / result.pageSize),
    },
  };
});

/**
 * 获取消息详情
 * @tag Messages
 * @summary 获取消息详情
 * @description 根据 ID 获取单条消息的详细信息，包含发送结果
 * @param {string} id - 消息 ID
 * @returns {Message} 消息详情
 */
router.get('/:id', async (ctx: AppContext) => {
  const { id } = ctx.params;

  const message = await messageService.get(id);
  if (!message) {
    throw ApiError.notFound('Message not found', ErrorCodes.MESSAGE_NOT_FOUND);
  }

  ctx.body = message;
});

export default router;
