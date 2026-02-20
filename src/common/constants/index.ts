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

export const CACHE_TTL = {
  ANALYTICS_PREDICTION: 60 * 60 * 24, // 24 hours
  ANALYTICS_DASHBOARD: 60 * 30,      // 30 minutes
  ITEMS_SEARCH: 60 * 5,             // 5 minutes
  CLAIM_DETAIL: 60 * 10,            // 10 minutes
};

// File Uploads
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880'); // 5MB
export const ALLOWED_FILE_TYPES = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/jpg,application/pdf').split(',');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Retention Periods (in days)
export const RETENTION_PERIODS = {
  DEFAULT: parseInt(process.env.RETENTION_DEFAULT || '30'),
  VALUABLES: parseInt(process.env.RETENTION_VALUABLES || '365'),
  ELECTRONICS: parseInt(process.env.RETENTION_ELECTRONICS || '90'),
  DOCUMENTS: parseInt(process.env.RETENTION_DOCUMENTS || '180'),
  PERISHABLES: parseInt(process.env.RETENTION_PERISHABLES || '2'),
  KEYS: parseInt(process.env.RETENTION_KEYS || '30'),
  JEWELRY: parseInt(process.env.RETENTION_JEWELRY || '60'),
  BAGS: parseInt(process.env.RETENTION_BAGS || '45'),
  CLOTHING: parseInt(process.env.RETENTION_CLOTHING || '60'),
  ACCESSORIES: parseInt(process.env.RETENTION_ACCESSORIES || '60'),
  BOOKS: parseInt(process.env.RETENTION_BOOKS || '30'),
  SPORTS_EQUIPMENT: parseInt(process.env.RETENTION_SPORTS || '60'),
  OTHER: parseInt(process.env.RETENTION_OTHER || '30'),
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

// Fees
export const FEES = {
  HANDLING_FEE: 50,
  STORAGE_FEE_PER_DAY: 10,
};

// Redis Configuration
export const REDIS = {
  HOST: process.env.REDIS_HOST || 'localhost',
  PORT: parseInt(process.env.REDIS_PORT || '6379'),
  PASSWORD: process.env.REDIS_PASSWORD || undefined,
};
