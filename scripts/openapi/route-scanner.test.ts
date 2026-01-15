/**
 * RouteScanner 属性测试
 * 
 * Property 1: Path Parameter Conversion
 * Property 5: Auth Middleware Detection
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { RouteScanner, inferTagFromFileName } from './route-scanner.js';
import { convertPathParams } from './schema-extractor.js';
import * as path from 'path';

const routesDir = path.join(process.cwd(), 'node-functions/routes');

describe('RouteScanner', () => {
  const scanner = new RouteScanner(routesDir);

  describe('scanDirectory', () => {
    it('should scan all route files in directory', async () => {
      const routes = await scanner.scanDirectory();
      
      // 应该找到多个路由
      expect(routes.length).toBeGreaterThan(0);
      
      // 验证路由结构
      for (const route of routes) {
        expect(route.method).toMatch(/^(get|post|put|delete|patch)$/);
        expect(route.path).toBeTruthy();
        expect(route.koaPath).toBeTruthy();
        expect(route.sourceFile).toBeTruthy();
      }
    });

    it('should extract routes from channels.ts', async () => {
      const routes = await scanner.scanDirectory();
      const channelRoutes = routes.filter(r => r.sourceFile.includes('channels.ts'));
      
      // channels.ts 应该有 5 个路由
      expect(channelRoutes.length).toBe(5);
      
      // 验证路由方法
      const methods = channelRoutes.map(r => r.method);
      expect(methods).toContain('get');
      expect(methods).toContain('post');
      expect(methods).toContain('put');
      expect(methods).toContain('delete');
    });

    it('should extract routes from apps.ts', async () => {
      const routes = await scanner.scanDirectory();
      const appRoutes = routes.filter(r => r.sourceFile.includes('apps.ts'));
      
      expect(appRoutes.length).toBe(5);
    });
  });

  describe('Property 5: Auth Middleware Detection', () => {
    it('should detect adminAuth middleware in channels.ts', async () => {
      const routes = await scanner.scanDirectory();
      const channelRoutes = routes.filter(r => r.sourceFile.includes('channels.ts'));
      
      // 所有 channel 路由都需要认证
      for (const route of channelRoutes) {
        expect(route.requiresAuth).toBe(true);
      }
    });

    it('should detect adminAuth middleware in apps.ts', async () => {
      const routes = await scanner.scanDirectory();
      const appRoutes = routes.filter(r => r.sourceFile.includes('apps.ts'));
      
      for (const route of appRoutes) {
        expect(route.requiresAuth).toBe(true);
      }
    });

    it('should not require auth for init routes', async () => {
      const routes = await scanner.scanDirectory();
      const initRoutes = routes.filter(r => r.sourceFile.includes('init.ts'));
      
      // init 路由不需要认证
      for (const route of initRoutes) {
        expect(route.requiresAuth).toBe(false);
      }
    });

    it('should not require auth for auth routes', async () => {
      const routes = await scanner.scanDirectory();
      const authRoutes = routes.filter(r => r.sourceFile.includes('auth.ts'));
      
      // auth 路由本身不需要认证（用于验证 token）
      for (const route of authRoutes) {
        expect(route.requiresAuth).toBe(false);
      }
    });
  });

  describe('Path conversion', () => {
    it('should convert Koa path params to OpenAPI format', async () => {
      const routes = await scanner.scanDirectory();
      
      // 找到带参数的路由
      const routesWithParams = routes.filter(r => r.koaPath.includes(':'));
      
      for (const route of routesWithParams) {
        // Koa 格式应该有 :param
        expect(route.koaPath).toMatch(/:[a-zA-Z_]/);
        // OpenAPI 格式应该有 {param}
        expect(route.path).toMatch(/\{[a-zA-Z_]/);
        // OpenAPI 格式不应该有 :param
        expect(route.path).not.toMatch(/:[a-zA-Z_]/);
      }
    });

    it('should preserve path structure after conversion', async () => {
      const routes = await scanner.scanDirectory();
      
      for (const route of routes) {
        // 路径段数应该相同
        const koaSegments = route.koaPath.split('/').filter(Boolean);
        const openApiSegments = route.path.split('/').filter(Boolean);
        expect(koaSegments.length).toBe(openApiSegments.length);
      }
    });
  });

  describe('Prefix extraction', () => {
    it('should extract correct prefix for channels', async () => {
      const routes = await scanner.scanDirectory();
      const channelRoutes = routes.filter(r => r.sourceFile.includes('channels.ts'));
      
      for (const route of channelRoutes) {
        expect(route.prefix).toBe('/channels');
      }
    });

    it('should extract correct prefix for nested routes', async () => {
      const routes = await scanner.scanDirectory();
      const openidRoutes = routes.filter(r => r.sourceFile.includes('openids.ts'));
      
      for (const route of openidRoutes) {
        expect(route.prefix).toBe('/apps/:appId/openids');
      }
    });
  });
});

describe('inferTagFromFileName', () => {
  it('should infer correct tags from file names', () => {
    expect(inferTagFromFileName('channels.ts')).toBe('Channels');
    expect(inferTagFromFileName('apps.ts')).toBe('Apps');
    expect(inferTagFromFileName('openids.ts')).toBe('OpenIDs');
    expect(inferTagFromFileName('messages.ts')).toBe('Messages');
    expect(inferTagFromFileName('init.ts')).toBe('Init');
    expect(inferTagFromFileName('auth.ts')).toBe('Auth');
    expect(inferTagFromFileName('config.ts')).toBe('Config');
    expect(inferTagFromFileName('stats.ts')).toBe('Stats');
    expect(inferTagFromFileName('wechat-msg.ts')).toBe('Webhook');
  });
});

describe('Property 1: Path Parameter Conversion (additional)', () => {
  // 属性测试：任意有效的 Koa 路径都应该正确转换
  it('should convert any valid Koa path with parameters', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.stringMatching(/^[a-z]+$/), // 普通路径段
            fc.stringMatching(/^:[a-zA-Z_][a-zA-Z0-9_]*$/) // 参数段
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (segments) => {
          const koaPath = '/' + segments.join('/');
          const openApiPath = convertPathParams(koaPath);
          
          // 所有 :param 都应该被转换
          const koaParamCount = (koaPath.match(/:[a-zA-Z_]/g) || []).length;
          const openApiParamCount = (openApiPath.match(/\{[a-zA-Z_]/g) || []).length;
          
          expect(openApiParamCount).toBe(koaParamCount);
          expect(openApiPath).not.toMatch(/:[a-zA-Z_]/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
