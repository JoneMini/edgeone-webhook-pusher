/**
 * JSDocParser 属性测试
 * 
 * Property 4: JSDoc Extraction Completeness
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { JSDocParser, extractFileHeader } from './jsdoc-parser.js';

describe('JSDocParser', () => {
  const parser = new JSDocParser();

  describe('parseComment', () => {
    it('should extract summary from first line', () => {
      const comment = `/**
       * 获取渠道列表
       */`;
      
      const result = parser.parseComment(comment);
      expect(result.summary).toBe('获取渠道列表');
    });

    it('should extract summary and description', () => {
      const comment = `/**
       * 获取渠道列表
       * 
       * 返回所有已配置的渠道信息
       */`;
      
      const result = parser.parseComment(comment);
      // comment-parser 将整个描述作为一个块处理
      expect(result.summary).toContain('获取渠道列表');
      expect(result.description).toContain('返回所有已配置的渠道信息');
    });

    it('should extract @tag annotation', () => {
      const comment = `/**
       * 获取渠道列表
       * @tag Channels
       */`;
      
      const result = parser.parseComment(comment);
      expect(result.tags).toContain('Channels');
    });

    it('should extract multiple @tag annotations', () => {
      const comment = `/**
       * 获取渠道列表
       * @tag Channels
       * @tag Admin
       */`;
      
      const result = parser.parseComment(comment);
      expect(result.tags).toContain('Channels');
      expect(result.tags).toContain('Admin');
    });

    it('should extract @param annotations', () => {
      const comment = `/**
       * 获取渠道详情
       * @param id 渠道 ID
       */`;
      
      const result = parser.parseComment(comment);
      expect(result.params).toBeDefined();
      expect(result.params!.length).toBe(1);
      expect(result.params![0].name).toBe('id');
      expect(result.params![0].description).toBe('渠道 ID');
    });

    it('should extract @param with type', () => {
      const comment = `/**
       * 获取渠道详情
       * @param {string} id 渠道 ID
       */`;
      
      const result = parser.parseComment(comment);
      expect(result.params![0].type).toBe('string');
    });

    it('should extract @returns annotation', () => {
      const comment = `/**
       * 获取渠道列表
       * @returns {Channel[]} 渠道列表
       */`;
      
      const result = parser.parseComment(comment);
      expect(result.responses).toBeDefined();
      expect(result.responses!.length).toBe(1);
      expect(result.responses![0].status).toBe(200);
      // comment-parser 将类型和描述分开处理
      expect(result.responses![0].schema).toBe('Channel[]');
    });

    it('should extract @response annotation with status', () => {
      const comment = `/**
       * 创建渠道
       * @response 201 创建成功
       * @response 400 参数错误
       */`;
      
      const result = parser.parseComment(comment);
      expect(result.responses).toBeDefined();
      expect(result.responses!.length).toBe(2);
      expect(result.responses![0].status).toBe(201);
      expect(result.responses![0].description).toBe('创建成功');
      expect(result.responses![1].status).toBe(400);
    });

    it('should extract @summary annotation', () => {
      const comment = `/**
       * @summary 获取渠道列表
       */`;
      
      const result = parser.parseComment(comment);
      expect(result.summary).toBe('获取渠道列表');
    });

    it('should extract @description annotation', () => {
      const comment = `/**
       * @description 返回所有已配置的渠道信息
       */`;
      
      const result = parser.parseComment(comment);
      expect(result.description).toBe('返回所有已配置的渠道信息');
    });
  });

  describe('Property 4: JSDoc Extraction Completeness', () => {
    it('should extract all annotations from complex JSDoc', () => {
      const comment = `/**
       * 获取渠道详情
       * 
       * 根据 ID 获取单个渠道的详细信息
       * 
       * @tag Channels
       * @param {string} id 渠道 ID (path)
       * @returns {Channel} 渠道详情
       * @response 404 渠道不存在
       */`;
      
      const result = parser.parseComment(comment);
      
      // 验证所有信息都被提取
      expect(result.summary).toContain('获取渠道详情');
      expect(result.description).toContain('根据 ID 获取单个渠道的详细信息');
      expect(result.tags).toContain('Channels');
      expect(result.params).toBeDefined();
      expect(result.params!.some(p => p.name === 'id')).toBe(true);
      expect(result.responses).toBeDefined();
      expect(result.responses!.some(r => r.status === 200)).toBe(true);
      expect(result.responses!.some(r => r.status === 404)).toBe(true);
    });

    // 属性测试：任何有效的 JSDoc 注释都应该能被解析
    it('should parse any valid JSDoc comment without throwing', () => {
      fc.assert(
        fc.property(
          fc.record({
            summary: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,50}$/),
            tag: fc.stringMatching(/^[A-Z][a-zA-Z]*$/),
            paramName: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
          }),
          ({ summary, tag, paramName }) => {
            const comment = `/**
             * ${summary}
             * @tag ${tag}
             * @param ${paramName} Some description
             */`;
            
            // 不应该抛出异常
            const result = parser.parseComment(comment);
            
            // 应该提取到 tag 和 param
            expect(result.tags).toContain(tag);
            expect(result.params?.some(p => p.name === paramName)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('parseFileContent', () => {
    it('should parse multiple JSDoc comments in file content', () => {
      const content = `
/**
 * 获取列表
 */
router.get('/', handler1);

/**
 * 创建资源
 * @tag Resources
 */
router.post('/', handler2);
`;
      
      const result = parser.parseFileContent(content);
      expect(result.size).toBe(2);
    });

    it('should associate JSDoc with correct position', () => {
      const content = `
/**
 * First handler
 */
router.get('/first', handler1);

/**
 * Second handler
 */
router.get('/second', handler2);
`;
      
      const result = parser.parseFileContent(content);
      
      // 验证位置信息
      const positions = Array.from(result.keys()).sort((a, b) => a - b);
      expect(positions.length).toBe(2);
      expect(positions[0]).toBeLessThan(positions[1]);
    });
  });

  describe('Parameter location inference', () => {
    it('should infer path location for common path params', () => {
      const comment = `/**
       * @param id 资源 ID
       * @param appId 应用 ID
       */`;
      
      const result = parser.parseComment(comment);
      expect(result.params![0].in).toBe('path');
      expect(result.params![1].in).toBe('path');
    });

    it('should infer location from description', () => {
      const comment = `/**
       * @param page 页码 (query)
       * @param data 请求体 (body)
       */`;
      
      const result = parser.parseComment(comment);
      expect(result.params![0].in).toBe('query');
      expect(result.params![1].in).toBe('body');
    });
  });
});

describe('extractFileHeader', () => {
  it('should extract routes from file header', () => {
    const content = `/**
 * Channel Management API Routes
 * 
 * GET /channels - 获取渠道列表
 * POST /channels - 创建渠道
 */

import Router from '@koa/router';
`;
    
    const result = extractFileHeader(content);
    // 第一行包含 "API Routes" 所以不会被当作 description
    expect(result.routes).toBeDefined();
    expect(result.routes!.length).toBe(2);
  });

  it('should extract description when present', () => {
    const content = `/**
 * 渠道管理模块
 * 
 * GET /channels - 获取渠道列表
 */

import Router from '@koa/router';
`;
    
    const result = extractFileHeader(content);
    expect(result.description).toBe('渠道管理模块');
    expect(result.routes).toBeDefined();
  });

  it('should return empty object for files without header', () => {
    const content = `import Router from '@koa/router';

const router = new Router();
`;
    
    const result = extractFileHeader(content);
    expect(result.description).toBeUndefined();
    expect(result.routes).toBeUndefined();
  });
});
