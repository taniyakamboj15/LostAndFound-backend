import { Queue } from 'bullmq';
import logger from '../../common/utils/logger';

export const matchQueue = new Queue('matches', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // 7 days
    },
  },
});

export const addMatchJob = async (data: { type: 'ITEM_CREATED' | 'REPORT_CREATED'; id: string }) => {
  try {
    await matchQueue.add(data.type, data);
    logger.info(`Added match job: ${data.type} for ID ${data.id}`);
  } catch (error) {
    logger.error('Failed to add match job:', error);
  }
};
