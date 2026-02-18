import dotenv from 'dotenv';
dotenv.config();

import connectDB from './config/database';
import { connectRedis } from './config/redis';
import logger from './common/utils/logger';

// Import workers
import './modules/notification/notification.worker';
import './modules/match/match.worker';
import jobService from './modules/common/job.service';

const startWorker = async () => {
  try {
    await connectDB();
    await connectRedis();

    // Start system job worker
    jobService.setupWorker();
    
    // Initialize repeatable jobs (optional, usually done by server)
    // await jobService.initializeRepeatableJobs();

    logger.info('Background worker process started running all workers');
  } catch (error) {
    logger.error('Failed to start worker process:', error);
    process.exit(1);
  }
};

startWorker();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker process...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down worker process...');
  process.exit(0);
});
