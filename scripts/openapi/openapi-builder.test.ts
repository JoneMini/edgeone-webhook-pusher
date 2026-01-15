/**
 * OpenAPIBuilder 属性测试
 * 
 * Property 6: Valid OpenAPI Output
 * Property 8: Documentation Fallback
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { OpenAPIBuilder } from './openapi-builder.js';
import type { RouteInfo, JSONSchema } from './types.js';
import SwaggerParser from '@apidevtools/swagger-parser';

describe('OpenAPIBuilder', () => {
  describe('Property 6: Valid OpenAPI Output', () => {
    it('should generate valid OpenAPI 3.0.3 spec', async () => {
      const builder = new OpenAPIBuilder();
      
      const routes: RouteInfo[] = [
        {
          method: 'get',
          path: '/channels',
          koaPath: '/channels',
          prefix: '/channels',
          requiresAuth: true,
          handlerName: 'getChannels',
          sourceFile: 'channels.ts',
        },
      ];

      // 提供完整的 schemas 以避免 $ref 错误
      const schemas: Record<string, JSONSchema> = {
        Channel: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
        CreateChannelInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
        PushResult: {
          type: 'object',
          properties: {
            pushId: { type: 'string' },
            total: { type: 'integer' },
          },
        },
        PushMessageInput: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            desp: { type: 'string' },
          },
        },
      };

      const spec = builder.build(routes, schemas);

      // 验证基本结构
      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info.title).toBeTruthy();
      expect(spec.paths).toBeDefined();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);

      // 使用 swagger-parser 验证规范有效性
      try {
        await SwaggerParser.validate(spec as any);
      } catch (error) {
        // 如果验证失败，打印详细错误
        console.error('OpenAPI validation error:', error);
        throw error;
      }
    });

    it('should include security schemes', () => {
      const builder = new OpenAPIBuilder();
      const spec = builder.build([], {});

      expect(spec.components?.securitySchemes).toBeDefined();
      expect(spec.components?.securitySchemes?.BearerAuth).toBeDefined();
      expect(spec.components?.securitySchemes?.AdminToken).toBeDefined();
    });

    it('should include all predefined tags', () => {
      const builder = new OpenAPIBuilder();
      const spec = builder.build([], {});

      expect(spec.tags).toBeDefined();
      const tagNames = spec.tags!.map(t => t.name);
      expect(tagNames).toContain('Channels');
      expect(tagNames).toContain('Apps');
      expect(tagNames).toContain('Webhook');
    });
  });

  describe('Property 8: Documentation Fallback', () => {
    it('should generate basic documentation for routes without JSDoc', () => {
      const builder = new OpenAPIBuilder();
      
      const routes: RouteInfo[] = [
        {
          method: 'get',
          path: '/channels/{id}',
          koaPath: '/channels/:id',
          prefix: '/channels',
          requiresAuth: true,
          handlerName: 'getChannel',
          sourceFile: 'channels.ts',
          // 没有 jsDoc
        },
      ];

      const spec = builder.build(routes, {});

      // 验证生成了基本文档
      const channelPath = spec.paths['/channels/{id}'];
      expect(channelPath).toBeDefined();
      expect(channelPath.get).toBeDefined();
      expect(channelPath.get!.summary).toBeTruthy();
      expect(channelPath.get!.operationId).toBeTruthy();
      expect(channelPath.get!.tags).toBeDefined();
      expect(channelPath.get!.tags!.length).toBeGreaterThan(0);
    });

    it('should use JSDoc annotations when present', () => {
      const builder = new OpenAPIBuilder();
      
      const routes: RouteInfo[] = [
        {
          method: 'get',
          path: '/channels',
          koaPath: '/channels',
          prefix: '/channels',
          requiresAuth: true,
          handlerName: 'getChannels',
          sourceFile: 'channels.ts',
          jsDoc: {
            summary: '获取所有渠道',
            description: '返回系统中配置的所有渠道列表',
            tags: ['Channels'],
          },
        },
      ];

      const spec = builder.build(routes, {});

      const channelPath = spec.paths['/channels'];
      expect(channelPath.get!.summary).toBe('获取所有渠道');
      expect(channelPath.get!.description).toBe('返回系统中配置的所有渠道列表');
      expect(channelPath.get!.tags).toContain('Channels');
    });

    // 属性测试：任何路由都应该生成有效的 operation
    it('should generate valid operation for any route', () => {
      fc.assert(
        fc.property(
          fc.record({
            method: fc.constantFrom('get', 'post', 'put', 'delete') as fc.Arbitrary<'get' | 'post' | 'put' | 'delete'>,
            path: fc.stringMatching(/^\/[a-z]+$/),
            requiresAuth: fc.boolean(),
          }),
          ({ method, path, requiresAuth }) => {
            const builder = new OpenAPIBuilder();
            
            const routes: RouteInfo[] = [
              {
                method,
                path,
                koaPath: path,
                prefix: path,
                requiresAuth,
                handlerName: `${method}Handler`,
                sourceFile: 'test.ts',
              },
            ];

            const spec = builder.build(routes, {});

            // 验证生成了有效的 operation
            const pathItem = spec.paths[path];
            expect(pathItem).toBeDefined();
            
            const operation = pathItem[method];
            expect(operation).toBeDefined();
            expect(operation!.responses).toBeDefined();
            expect(Object.keys(operation!.responses).length).toBeGreaterThan(0);

            // 如果需要认证，应该有 security
            if (requiresAuth) {
              expect(operation!.security).toBeDefined();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Path parameters', () => {
    it('should extract path parameters correctly', () => {
      const builder = new OpenAPIBuilder();
      
      const routes: RouteInfo[] = [
        {
          method: 'get',
          path: '/apps/{appId}/openids/{id}',
          koaPath: '/apps/:appId/openids/:id',
          prefix: '/apps/:appId/openids',
          requiresAuth: true,
          handlerName: 'getOpenId',
          sourceFile: 'openids.ts',
        },
      ];

      const spec = builder.build(routes, {});

      const pathItem = spec.paths['/apps/{appId}/openids/{id}'];
      expect(pathItem).toBeDefined();
      expect(pathItem.parameters).toBeDefined();
      expect(pathItem.parameters!.length).toBe(2);
      
      const paramNames = pathItem.parameters!.map(p => p.name);
      expect(paramNames).toContain('appId');
      expect(paramNames).toContain('id');
    });
  });

  describe('Request body', () => {
    it('should add request body for POST requests', () => {
      const builder = new OpenAPIBuilder();
      
      const routes: RouteInfo[] = [
        {
          method: 'post',
          path: '/channels',
          koaPath: '/channels',
          prefix: '/channels',
          requiresAuth: true,
          handlerName: 'createChannel',
          sourceFile: 'channels.ts',
        },
      ];

      const spec = builder.build(routes, {});

      const operation = spec.paths['/channels'].post;
      expect(operation).toBeDefined();
      expect(operation!.requestBody).toBeDefined();
      expect(operation!.requestBody!.content['application/json']).toBeDefined();
    });

    it('should not add request body for GET requests', () => {
      const builder = new OpenAPIBuilder();
      
      const routes: RouteInfo[] = [
        {
          method: 'get',
          path: '/channels',
          koaPath: '/channels',
          prefix: '/channels',
          requiresAuth: true,
          handlerName: 'getChannels',
          sourceFile: 'channels.ts',
        },
      ];

      const spec = builder.build(routes, {});

      const operation = spec.paths['/channels'].get;
      expect(operation).toBeDefined();
      expect(operation!.requestBody).toBeUndefined();
    });
  });

  describe('Webhook paths', () => {
    it('should include webhook paths', () => {
      const builder = new OpenAPIBuilder();
      const spec = builder.build([], {});

      const webhookPath = spec.paths['/{appKey}.send'];
      expect(webhookPath).toBeDefined();
      expect(webhookPath.get).toBeDefined();
      expect(webhookPath.post).toBeDefined();
      expect(webhookPath.get!.tags).toContain('Webhook');
    });
  });
});
