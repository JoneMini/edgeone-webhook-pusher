/**
 * EdgeOne Node Functions - TypeScript + Koa
 * Route: /v1/*
 * 
 * OpenAPI 文档通过编译时脚本生成到 public/openapi.json
 * 前端可直接读取静态文件渲染
 */

import Koa from 'koa';
import Router from '@koa/router';
// @ts-ignore - koa-bodyparser types are not fully compatible
import bodyParser from 'koa-bodyparser';

// 扩展 Koa Context 类型以支持 body
interface RequestWithBody {
  body?: Record<string, unknown>;
}

// ============ 类型定义 ============

interface ApiResponse<T = unknown> {
  code: number;
  message?: string;
  data: T;
}

interface TestItem {
  id: string;
  name: string;
  createdAt: string;
}

// ============ 创建 Koa 应用 ============

const app = new Koa();

// CORS 中间件
app.use(async (ctx, next) => {
  ctx.set('Access-Control-Allow-Origin', '*');
  ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
  
  if (ctx.method === 'OPTIONS') {
    ctx.status = 204;
    return;
  }
  
  await next();
});

// Body parser
app.use(bodyParser());

// 错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('Error:', err);
    ctx.status = 500;
    ctx.body = {
      code: 50001,
      message: err instanceof Error ? err.message : 'Internal error',
      data: null,
    } as ApiResponse<null>;
  }
});

// 响应包装中间件
app.use(async (ctx, next) => {
  await next();
  
  // 如果响应体已经是标准格式，不再包装
  if (ctx.body && typeof ctx.body === 'object' && 'code' in ctx.body) {
    return;
  }
  
  // 包装成功响应
  if (ctx.body !== undefined) {
    ctx.body = {
      code: 0,
      message: 'success',
      data: ctx.body,
    };
  }
});

// ============ 路由定义 ============

const router = new Router();

// 健康检查
router.get('/health', async (ctx) => {
  ctx.body = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    runtime: 'TypeScript + Koa',
  };
});

// 获取列表
router.get('/items', async (ctx) => {
  const items: TestItem[] = [
    { id: '1', name: 'Item 1', createdAt: new Date().toISOString() },
    { id: '2', name: 'Item 2', createdAt: new Date().toISOString() },
  ];
  ctx.body = items;
});

// 创建项目
router.post('/items', async (ctx) => {
  const body = (ctx.request as unknown as RequestWithBody).body as { name?: string } | undefined;
  
  if (!body?.name) {
    ctx.status = 400;
    ctx.body = {
      code: 40001,
      message: 'Missing required field: name',
      data: null,
    } as ApiResponse<null>;
    return;
  }
  
  const item: TestItem = {
    id: Date.now().toString(),
    name: body.name,
    createdAt: new Date().toISOString(),
  };
  
  ctx.status = 201;
  ctx.body = item;
});

// 获取单个项目
router.get('/items/:id', async (ctx) => {
  const { id } = ctx.params;
  
  if (id === '1' || id === '2') {
    const item: TestItem = {
      id,
      name: `Item ${id}`,
      createdAt: new Date().toISOString(),
    };
    ctx.body = item;
  } else {
    ctx.status = 404;
    ctx.body = {
      code: 40401,
      message: 'Item not found',
      data: null,
    } as ApiResponse<null>;
  }
});

// 注册路由
app.use(router.routes());
app.use(router.allowedMethods());

// EdgeOne Node Functions 规范：导出 Koa 应用实例
export default app;
