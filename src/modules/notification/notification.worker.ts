import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import notificationService from './notification.service';
import { NotificationPayload } from './notification.types';
import logger from '../../common/utils/logger';
import connectDB from '../../config/database';

// Connect to database
connectDB();

const worker = new Worker(
  'notifications',
  async (job: Job<NotificationPayload>) => {
    logger.info(`Processing notification job ${job.id}`, {
      event: job.data.event,
      userId: job.data.userId,
    });

    try {
      await notificationService.processNotification(job.data);
      logger.info(`Notification sent successfully for job ${job.id}`);
    } catch (error) {
      logger.error(`Failed to process notification job ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    },
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // 10 jobs per second
    },
  }
);


worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  logger.error('Worker error:', err);
});

logger.info('Notification worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker...');
  await worker.close();
  process.exit(0);
});
