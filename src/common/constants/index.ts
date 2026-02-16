/**
 * System-wide constants for the Lost & Found Backend
 */

// Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_PAGE_LIMIT = 100;

// Security & Rate Limiting (from .env or defaults)
export const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000');
export const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');

// File Uploads
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880'); // 5MB
export const ALLOWED_FILE_TYPES = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/jpg,application/pdf').split(',');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Retention Periods (in days)
export const RETENTION_PERIODS = {
  DEFAULT: parseInt(process.env.RETENTION_PERIOD_DEFAULT || '30'),
  HIGH_VALUE: parseInt(process.env.RETENTION_PERIOD_HIGH_VALUE || '60'),
  DOCUMENTS: parseInt(process.env.RETENTION_PERIOD_DOCUMENTS || '90'),
};

// Matching Engine
export const MATCH_THRESHOLD = parseFloat(process.env.MATCH_CONFIDENCE_THRESHOLD || '0.6');
export const MATCH_NOTIFY_THRESHOLD = parseFloat(process.env.MATCH_NOTIFICATION_THRESHOLD || '0.8');

// Organization Details
export const ORGANIZATION = {
  NAME: process.env.ORGANIZATION_NAME || 'Lost & Found Platform',
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@lostandfound.com',
};

// JWT Token Settings
export const JWT = {
  ACCESS_TOKEN_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
  ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_SECRET || '',
  REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_SECRET || '',
};

// Timeouts
export const DB_SELECTION_TIMEOUT = 5000;
export const DB_SOCKET_TIMEOUT = 45000;
