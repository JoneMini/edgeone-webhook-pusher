/**
 * TypeScript 类型定义
 * 
 * 所有类型从 schemas 导出，确保类型和 JSON Schema 一致
 */

export * from '../schemas/index';

// ============ 额外的工具类型 ============

// 错误码枚举
export enum ErrorCode {
  SUCCESS = 0,
  INVALID_PARAM = 40001,
  UNAUTHORIZED = 40101,
  FORBIDDEN = 40301,
  NOT_FOUND = 40401,
  INTERNAL_ERROR = 50001,
}

// API 错误类
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
