/**
 * OpenAPI 生成脚本错误处理测试
 * 
 * Property 7: Graceful Error Handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { RouteScanner } from './route-scanner.js';
import { SchemaExtractor } from './schema-extractor.js';
import { JSDocParser } from './jsdoc-parser.js';
import { OpenAPIBuilder } from './openapi-builder.js';

describe('Property 7: Graceful Error Handling', () => {
  describe('RouteScanner error handling', () => {
    it('should handle non-existent directory gracefully', async () => {
      const scanner = new RouteScanner('/non/existent/path');
      const routes = await scanner.scanDirectory();
      
      expect(routes).toEqual([]);
    });

    it('should handle empty directory gracefully', async () => {
      const tempDir = path.join(process.cwd(), '.test-temp-routes');
      fs.mkdirSync(tempDir, { recursive: true });
      
      try {
        const scanner = new RouteScanner(tempDir);
        const routes = await scanner.scanDirectory();
        
        expect(routes).toEqual([]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should skip invalid route files gracefully', async () => {
      const tempDir = path.join(process.cwd(), '.test-temp-routes-invalid');
      fs.mkdirSync(tempDir, { recursive: true });
      
      // 创建一个无效的路由文件
      fs.writeFileSync(
        path.join(tempDir, 'invalid.ts'),
        'this is not valid typescript router code'
      );
      
      try {
        const scanner = new RouteScanner(tempDir);
        const routes = await scanner.scanDirectory();
        
        // 应该返回空数组而不是抛出错误
        expect(Array.isArray(routes)).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('SchemaExtractor error handling', () => {
    it('should handle non-existent types directory gracefully', () => {
      const extractor = new SchemaExtractor('/non/existent/types');
      const schemas = extractor.extractSchemas();
      
      expect(schemas).toEqual({});
    });

    it('should handle missing index.ts gracefully', () => {
      const tempDir = path.join(process.cwd(), '.test-temp-types');
      fs.mkdirSync(tempDir, { recursive: true });
      
      try {
        const extractor = new SchemaExtractor(tempDir);
        const schemas = extractor.extractSchemas();
        
        expect(schemas).toEqual({});
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('JSDocParser error handling', () => {
    it('should handle empty content gracefully', () => {
      const parser = new JSDocParser();
      const result = parser.parseFileContent('');
      
      expect(result.size).toBe(0);
    });

    it('should handle content without JSDoc gracefully', () => {
      const parser = new JSDocParser();
      const result = parser.parseFileContent('const x = 1; function foo() {}');
      
      expect(result.size).toBe(0);
    });

    it('should handle malformed JSDoc gracefully', () => {
      const parser = new JSDocParser();
      const content = `
        /* This is not a JSDoc comment */
        /** Incomplete JSDoc
        /** @param */
        /** @returns */
      `;
      
      // 不应该抛出错误
      expect(() => parser.parseFileContent(content)).not.toThrow();
    });
  });

  describe('OpenAPIBuilder error handling', () => {
    it('should handle empty routes gracefully', () => {
      const builder = new OpenAPIBuilder();
      const spec = builder.build([], {});
      
      // 应该生成有效的基本规范
      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info.title).toBeTruthy();
      expect(spec.paths).toBeDefined();
    });

    it('should handle empty schemas gracefully', () => {
      const builder = new OpenAPIBuilder();
      const spec = builder.build([], {});
      
      // 应该包含通用 schemas
      expect(spec.components?.schemas?.Error).toBeDefined();
      expect(spec.components?.schemas?.Success).toBeDefined();
    });

    it('should handle routes with missing fields gracefully', () => {
      const builder = new OpenAPIBuilder();
      
      // 使用属性测试验证各种边界情况
      fc.assert(
        fc.property(
          fc.record({
            method: fc.constantFrom('get', 'post', 'put', 'delete') as fc.Arbitrary<'get' | 'post' | 'put' | 'delete'>,
            path: fc.oneof(
              fc.constant('/'),
              fc.constant('/test'),
              fc.constant('/test/{id}'),
              fc.stringMatching(/^\/[a-z]+$/)
            ),
            requiresAuth: fc.boolean(),
          }),
          ({ method, path, requiresAuth }) => {
            const routes = [{
              method,
              path,
              koaPath: path.replace(/\{([^}]+)\}/g, ':$1'),
              prefix: '',
              requiresAuth,
              handlerName: 'testHandler',
              sourceFile: 'test.ts',
            }];

            // 不应该抛出错误
            expect(() => builder.build(routes, {})).not.toThrow();
            
            const spec = builder.build(routes, {});
            expect(spec.paths[path]).toBeDefined();
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Integration error handling', () => {
    it('should produce valid output even with partial failures', () => {
      const builder = new OpenAPIBuilder();
      
      // 混合有效和边界情况的路由
      const routes = [
        {
          method: 'get' as const,
          path: '/valid',
          koaPath: '/valid',
          prefix: '',
          requiresAuth: true,
          handlerName: 'getValid',
          sourceFile: 'valid.ts',
        },
        {
          method: 'post' as const,
          path: '/',  // 根路径
          koaPath: '/',
          prefix: '',
          requiresAuth: false,
          handlerName: 'postRoot',
          sourceFile: 'root.ts',
        },
        {
          method: 'delete' as const,
          path: '/items/{id}',
          koaPath: '/items/:id',
          prefix: '/items',
          requiresAuth: true,
          handlerName: 'deleteItem',
          sourceFile: 'items.ts',
        },
      ];

      const spec = builder.build(routes, {});
      
      // 验证所有路由都被处理
      expect(Object.keys(spec.paths).length).toBeGreaterThanOrEqual(routes.length);
      expect(spec.openapi).toBe('3.0.3');
    });
  });
});
