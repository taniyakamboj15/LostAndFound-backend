import Redis from 'ioredis';
import logger from '../utils/logger';

class CacheService {
  private client: Redis | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    if (process.env.NODE_ENV === 'test') {
      logger.info('Cache disabled for testing environment');
      return;
    }

    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Connected to Redis');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        logger.error(`Redis error: ${err.message}`);
      });
      
    } catch (error) {
      logger.error('Failed to initialize Redis client', error);
    }
  }

  // Helper method to wrap a function call with caching
  async wrap<T>(key: string, fetchFunction: () => Promise<T>, ttlSeconds: number = 3600): Promise<T> {
    if (!this.client || !this.isConnected) {
      // Fallback
      return fetchFunction();
    }

    try {
      const cachedResult = await this.client.get(key);
      if (cachedResult) {
        return JSON.parse(cachedResult) as T;
      }
    } catch (error) {
      logger.warn(`Cache read error for key ${key}:`, error);
    }

    const data = await fetchFunction();

    try {
      if (data !== undefined && data !== null) {
        await this.client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
      }
    } catch (error) {
      logger.warn(`Cache write error for key ${key}:`, error);
    }

    return data;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache get error', error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number = 3600): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      logger.error('Cache set error', error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Cache del error', error);
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      const keys = await this.client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      logger.error('Cache delByPrefix error', error);
    }
  }

  async quit(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}

export default new CacheService();
