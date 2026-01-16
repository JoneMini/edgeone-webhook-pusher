/**
 * 本地开发服务器 - 独立运行 Node Functions
 * 
 * 用于本地调试时：
 * - 前端 (Nuxt) → 本地 Node Functions → 远程 Edge Functions KV API
 * 
 * 使用方式：
 * 1. 配置 .env.local 中的 KV_BASE_URL 和 INTERNAL_DEBUG_KEY
 * 2. 运行 yarn dev:node 启动此服务器
 * 3. 运行 yarn dev 启动前端（会自动代理到此服务器）
 */

import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config } from 'dotenv';

// ANSI 颜色码
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

// 加载环境变量
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// 按优先级加载环境变量：.env.local > .env
config({ path: resolve(rootDir, '.env.local') });
config({ path: resolve(rootDir, '.env') });

// 动态导入 Koa 应用
const app = (await import('../node-functions/v1/[[default]].js')).default;

const PORT = process.env.NODE_PORT || 3001;

const server = createServer(app.callback());

server.listen(PORT, () => {
  const hasDebugKey = !!process.env.INTERNAL_DEBUG_KEY;
  const kvUrl = process.env.KV_BASE_URL || '(未配置，使用同源)';
  
  console.log('');
  console.log(`${c.green}${c.bold}🚀 Node Functions 开发服务器已启动${c.reset}`);
  console.log(`${c.dim}   地址: ${c.reset}${c.cyan}http://localhost:${PORT}${c.reset}`);
  console.log('');
  console.log(`${c.magenta}${c.bold}📡 KV API 配置:${c.reset}`);
  console.log(`${c.dim}   KV_BASE_URL:${c.reset} ${c.yellow}${kvUrl}${c.reset}`);
  console.log(`${c.dim}   INTERNAL_DEBUG_KEY:${c.reset} ${hasDebugKey ? `${c.green}已配置 ✓${c.reset}` : `${c.red}未配置 ✗${c.reset}`}`);
  console.log('');
  console.log(`${c.blue}💡 提示:${c.reset} 在另一个终端运行 ${c.cyan}yarn dev${c.reset} 启动前端`);
  console.log('');
});
