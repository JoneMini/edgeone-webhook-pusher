/**
 * System 系统配置相关类型定义
 */

export interface SystemConfig {
  adminToken: string;
  rateLimit?: {
    perMinute: number;
  };
  retention?: {
    days: number;
  };
  createdAt: string;
  updatedAt: string;
}
