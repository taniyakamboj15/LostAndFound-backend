import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import matchService from './match.service';
import logger from '../../common/utils/logger';
import connectDB from '../../config/database';
import { connectRedis } from '../../config/redis';
// Ensure DB connection if running as standalone worker process
if (require.main === module) {
  connectDB();
  connectRedis();
}

interface MatchJobData {
  type: 'ITEM_CREATED' | 'REPORT_CREATED';
  id: string;
}

const worker = new Worker(
  'matches',
  async (job: Job<MatchJobData>) => {
    logger.info(`Processing match job ${job.id}: ${job.data.type} for ${job.data.id}`);

    try {
      if (job.data.type === 'ITEM_CREATED') {
        const matches = await matchService.generateMatches({ itemId: job.data.id });
        logger.info(`Generated ${matches.length} matches for Item ${job.data.id}`);
      } else if (job.data.type === 'REPORT_CREATED') {
        const matches = await matchService.generateMatches({ lostReportId: job.data.id });
        logger.info(`Generated ${matches.length} matches for Report ${job.data.id}`);
      }
    } catch (error) {
      logger.error(`Failed to process match job ${job.id}:`, error);
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
      duration: 1000,
    },
  }
);

worker.on('completed', (job) => {
  logger.info(`Match job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  logger.error(`Match job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  logger.error('Match worker error:', err);
});

logger.info('Match worker started');

export default worker;
