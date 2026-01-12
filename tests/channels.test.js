/**
 * Channel Registry Tests
 * Feature: multi-tenant-refactor
 * Validates: Requirements 9.1, 9.2, 9.3
 */

import { describe, it, expect } from 'vitest';
import {
  getChannelAdapter,
  getSupportedChannelTypes,
  getSensitiveFields,
  isChannelSupported,
  getChannelInfo,
  getAllChannelsInfo,
} from '../node-functions/shared/channels/registry.js';

describe('Channel Registry', () => {
  describe('getSupportedChannelTypes', () => {
    it('should return array of channel types', () => {
      const types = getSupportedChannelTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });

    it('should include wechat-template', () => {
      const types = getSupportedChannelTypes();
      expect(types).toContain('wechat-template');
    });
  });

  describe('getChannelAdapter', () => {
    it('should return adapter for wechat-template', () => {
      const adapter = getChannelAdapter('wechat-template');
      expect(adapter).toBeDefined();
      expect(adapter.type).toBe('wechat-template');
      expect(adapter.name).toBe('微信模板消息');
    });

    it('should return undefined for unknown type', () => {
      const adapter = getChannelAdapter('unknown-type');
      expect(adapter).toBeUndefined();
    });

    it('should have required methods', () => {
      const adapter = getChannelAdapter('wechat-template');
      expect(typeof adapter.send).toBe('function');
      expect(typeof adapter.validate).toBe('function');
      expect(typeof adapter.getConfigSchema).toBe('function');
    });
  });

  describe('isChannelSupported', () => {
    it('should return true for supported channel', () => {
      expect(isChannelSupported('wechat-template')).toBe(true);
    });

    it('should return false for unsupported channel', () => {
      expect(isChannelSupported('unknown-type')).toBe(false);
    });
  });

  describe('getChannelInfo', () => {
    it('should return channel info for supported channel', () => {
      const info = getChannelInfo('wechat-template');
      expect(info).toBeDefined();
      expect(info.type).toBe('wechat-template');
      expect(info.name).toBe('微信模板消息');
      expect(info.configSchema).toBeDefined();
    });

    it('should return null for unsupported channel', () => {
      const info = getChannelInfo('unknown-type');
      expect(info).toBeNull();
    });
  });

  describe('getAllChannelsInfo', () => {
    it('should return array of channel info', () => {
      const channels = getAllChannelsInfo();
      expect(Array.isArray(channels)).toBe(true);
      expect(channels.length).toBeGreaterThan(0);
      expect(channels[0].type).toBeDefined();
    });
  });

  describe('getSensitiveFields', () => {
    it('should return sensitive fields for wechat-template', () => {
      const fields = getSensitiveFields('wechat-template');
      expect(Array.isArray(fields)).toBe(true);
      expect(fields).toContain('appSecret');
    });

    it('should return empty array for unknown type', () => {
      const fields = getSensitiveFields('unknown-type');
      expect(fields).toEqual([]);
    });
  });
});

describe('WeChat Template Adapter', () => {
  const adapter = getChannelAdapter('wechat-template');

  describe('getConfigSchema', () => {
    it('should return valid schema', () => {
      const schema = adapter.getConfigSchema();
      expect(schema).toBeDefined();
      expect(schema.appId).toBeDefined();
      expect(schema.appSecret).toBeDefined();
      expect(schema.templateId).toBeDefined();
      // openId is not part of config schema (it's per-message)
      expect(schema.url).toBeDefined();
    });

    it('should mark appSecret as sensitive', () => {
      const schema = adapter.getConfigSchema();
      expect(schema.appSecret.sensitive).toBe(true);
    });

    it('should mark required fields correctly', () => {
      const schema = adapter.getConfigSchema();
      expect(schema.appId.required).toBe(true);
      expect(schema.appSecret.required).toBe(true);
      expect(schema.templateId.required).toBe(true);
      expect(schema.url.required).toBe(false);
    });
  });

  describe('getRequiredFields', () => {
    it('should return required field names', () => {
      const fields = adapter.getRequiredFields();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields).toContain('appId');
      expect(fields).toContain('appSecret');
      expect(fields).toContain('templateId');
    });
  });

  describe('getSensitiveFields', () => {
    it('should return sensitive field names', () => {
      const fields = adapter.getSensitiveFields();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields).toContain('appSecret');
    });
  });

  describe('validate', () => {
    it('should reject empty credentials', async () => {
      const result = await adapter.validate({});
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject incomplete credentials', async () => {
      const result = await adapter.validate({
        appId: 'test',
        appSecret: 'test',
        // missing templateId
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
