import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import notificationService from './notification.service';
import { NotificationPayload } from './notification.types';
import logger from '../../common/utils/logger';
import connectDB from '../../config/database';

// Connect to database
connectDB();

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

// 1. Push Worker: Fast, high concurrency
const pushWorker = new Worker(
  'push-notifications',
  async (job: Job<NotificationPayload>) => {
    logger.info(`[Push] Processing job ${job.id}`);
    await notificationService.processPush(job.data);
  },
  { 
    connection, 
    concurrency: 10,
    limiter: { max: 50, duration: 1000 } // 50/sec
  }
);

// 2. Email Worker: Slower, medium concurrency (e.g. SES limits)
const emailWorker = new Worker(
  'email-notifications',
  async (job: Job<NotificationPayload>) => {
    logger.info(`[Email] Processing job ${job.id}`);
    await notificationService.processEmail(job.data);
  },
  { 
    connection, 
    concurrency: 5,
    limiter: { max: 10, duration: 1000 } // 10/sec
  }
);

// 3. SMS Worker: Slowest, low concurrency (costly)
const smsWorker = new Worker(
  'sms-notifications',
  async (job: Job<NotificationPayload>) => {
    logger.info(`[SMS] Processing job ${job.id}`);
    await notificationService.processSMS(job.data);
  },
  { 
    connection, 
    concurrency: 2,
    limiter: { max: 5, duration: 1000 } // 5/sec
  }
);

const workers = [pushWorker, emailWorker, smsWorker];

workers.forEach(w => {
  w.on('completed', job => logger.info(`Job ${job.id} completed on ${w.name}`));
  w.on('failed', (job, err) => logger.error(`Job ${job?.id} failed on ${w.name}:`, err));
  w.on('error', err => logger.error(`Worker error on ${w.name}:`, err));
});

logger.info('Notification workers (Push, Email, SMS) started');

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down notification workers...');
  await Promise.all(workers.map(w => w.close()));
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
