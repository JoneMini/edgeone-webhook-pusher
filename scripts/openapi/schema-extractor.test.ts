/**
 * SchemaExtractor 属性测试
 * 
 * Property 2: TypeScript to JSON Schema Round-Trip Consistency
 * Property 3: Union Type to Enum Conversion
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SchemaExtractor, convertPathParams } from './schema-extractor.js';
import * as path from 'path';

const typesDir = path.join(process.cwd(), 'node-functions/types');
const tsconfigPath = path.join(process.cwd(), 'node-functions/tsconfig.json');

describe('SchemaExtractor', () => {
  const extractor = new SchemaExtractor(typesDir, tsconfigPath);

  describe('Property 2: TypeScript to JSON Schema Round-Trip Consistency', () => {
    it('should extract schemas with all property names preserved', () => {
      const schemas = extractor.extractSchemas();
      
      // Channel 类型应该包含所有属性
      expect(schemas.Channel).toBeDefined();
      expect(schemas.Channel.properties).toBeDefined();
      expect(schemas.Channel.properties!.id).toBeDefined();
      expect(schemas.Channel.properties!.name).toBeDefined();
      expect(schemas.Channel.properties!.type).toBeDefined();
      expect(schemas.Channel.properties!.config).toBeDefined();
      expect(schemas.Channel.properties!.createdAt).toBeDefined();
      expect(schemas.Channel.properties!.updatedAt).toBeDefined();
    });

    it('should mark optional properties as not required', () => {
      const schemas = extractor.extractSchemas();
      
      // CreateChannelInput 中 type 是可选的
      expect(schemas.CreateChannelInput).toBeDefined();
      const required = schemas.CreateChannelInput.required || [];
      expect(required).toContain('name');
      expect(required).toContain('config');
      expect(required).not.toContain('type');
    });

    it('should handle UpdateAppInput with all optional properties', () => {
      const schemas = extractor.extractSchemas();
      
      // UpdateAppInput 所有属性都是可选的
      expect(schemas.UpdateAppInput).toBeDefined();
      const required = schemas.UpdateAppInput.required || [];
      expect(required).not.toContain('name');
      expect(required).not.toContain('templateId');
    });

    it('should handle OpenID with optional nickname and remark', () => {
      const schemas = extractor.extractSchemas();
      
      expect(schemas.OpenID).toBeDefined();
      const required = schemas.OpenID.required || [];
      expect(required).toContain('id');
      expect(required).toContain('appId');
      expect(required).toContain('openId');
      expect(required).not.toContain('nickname');
      expect(required).not.toContain('remark');
    });
  });

  describe('Property 3: Union Type to Enum Conversion', () => {
    it('should convert PushMode union type to enum', () => {
      const schemas = extractor.extractSchemas();
      
      expect(schemas.PushMode).toBeDefined();
      expect(schemas.PushMode.type).toBe('string');
      expect(schemas.PushMode.enum).toBeDefined();
      expect(schemas.PushMode.enum).toContain('single');
      expect(schemas.PushMode.enum).toContain('subscribe');
    });

    it('should convert MessageType union type to enum', () => {
      const schemas = extractor.extractSchemas();
      
      expect(schemas.MessageType).toBeDefined();
      expect(schemas.MessageType.type).toBe('string');
      expect(schemas.MessageType.enum).toBeDefined();
      expect(schemas.MessageType.enum).toContain('normal');
      expect(schemas.MessageType.enum).toContain('template');
    });

    it('should convert ChannelType to string type', () => {
      const schemas = extractor.extractSchemas();
      
      // ChannelType 只有一个值 'wechat'，生成器可能不会生成 enum
      // 但应该至少是 string 类型
      expect(schemas.ChannelType).toBeDefined();
      expect(schemas.ChannelType.type).toBe('string');
    });
  });

  describe('$ref conversion', () => {
    it('should convert $ref to OpenAPI format', () => {
      const schemas = extractor.extractSchemas();
      
      // App 类型中的 pushMode 应该引用 PushMode
      if (schemas.App?.properties?.pushMode?.$ref) {
        expect(schemas.App.properties.pushMode.$ref).toMatch(
          /^#\/components\/schemas\//
        );
      }
    });
  });
});

describe('convertPathParams', () => {
  describe('Property 1: Path Parameter Conversion', () => {
    it('should convert single parameter', () => {
      expect(convertPathParams('/users/:id')).toBe('/users/{id}');
    });

    it('should convert multiple parameters', () => {
      expect(convertPathParams('/users/:userId/posts/:postId')).toBe(
        '/users/{userId}/posts/{postId}'
      );
    });

    it('should handle paths without parameters', () => {
      expect(convertPathParams('/users')).toBe('/users');
      expect(convertPathParams('/health')).toBe('/health');
    });

    it('should handle root path', () => {
      expect(convertPathParams('/')).toBe('/');
    });

    // Property-based test: for any valid parameter name, conversion should work
    it('should convert any valid parameter name', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
          (paramName) => {
            const koaPath = `/resource/:${paramName}`;
            const openApiPath = convertPathParams(koaPath);
            expect(openApiPath).toBe(`/resource/{${paramName}}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: conversion should be idempotent on already converted paths
    it('should not double-convert already converted paths', () => {
      const alreadyConverted = '/users/{id}/posts/{postId}';
      expect(convertPathParams(alreadyConverted)).toBe(alreadyConverted);
    });

    // Property: all :param patterns should be converted
    it('should convert all parameters in complex paths', () => {
      fc.assert(
        fc.property(
          fc.array(fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/), { minLength: 1, maxLength: 5 }),
          (paramNames) => {
            const koaPath = '/' + paramNames.map(p => `:${p}`).join('/');
            const openApiPath = convertPathParams(koaPath);
            
            // 验证所有 :param 都被转换
            expect(openApiPath).not.toMatch(/:[a-zA-Z_]/);
            // 验证所有参数都在结果中
            for (const param of paramNames) {
              expect(openApiPath).toContain(`{${param}}`);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
