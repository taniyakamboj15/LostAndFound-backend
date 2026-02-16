import Redis from 'ioredis';
import logger from '../common/utils/logger';

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
});

redisClient.on('ready', () => {
  logger.info('Redis Client Ready');
});

redisClient.on('close', () => {
  logger.warn('Redis Client Disconnected');
});

export const connectRedis = async (): Promise<void> => {
  // ioredis connects automatically, but we can check the status
  if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
    return;
  }
};

export default redisClient;

