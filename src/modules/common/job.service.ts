import { Queue, Worker, Job } from 'bullmq';
import itemService from '../item/item.service';
import notificationService from '../notification/notification.service';
import { NotificationEvent } from '../../common/types';
import { IItem } from '../item/item.model';

interface PopulatedItem extends Omit<IItem, 'registeredBy'> {
  registeredBy: {
    _id: string;
    name: string;
    email: string;
  };
}
import logger from '../../common/utils/logger';

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

class JobService {
  private systemQueue?: Queue;

  constructor() {
    try {
      this.systemQueue = new Queue('system-jobs', {
        connection: REDIS_CONFIG,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: { age: 24 * 3600 * 7 }, // Keep failed jobs for 7 days
        },
      });
      logger.info('System queue initialized');
    } catch (error) {
      logger.error('Failed to initialize system queue (Redis 6.0+ may be required):', error);
      // Fallback or disable queue-dependent features
    }
  }

  async initializeRepeatableJobs() {
    if (!this.systemQueue) {
      logger.warn('Skipping repeatable jobs initialization: queue not available');
      return;
    }

    try {
      // Check for expiring items every day at 9 AM
      await this.systemQueue.add(
        'check-expiring-items',
        {},
        {
          repeat: { pattern: '0 9 * * *' }, // Daily at 9 AM
          jobId: 'daily-expiration-check',
        }
      );

      logger.info('Repeatable jobs initialized');
    } catch (error) {
      logger.error('Failed to add repeatable jobs:', error);
    }
  }

  setupWorker() {
    try {
      const worker = new Worker(
        'system-jobs',
        async (job: Job) => {
          logger.info(`Processing system job: ${job.name}`);

          switch (job.name) {
            case 'check-expiring-items':
              await this.processExpiringItems();
              break;
            default:
              logger.warn(`Unknown job type: ${job.name}`);
          }
        },
        { connection: REDIS_CONFIG }
      );

      worker.on('completed', (job) => {
        logger.info(`System job ${job.id} completed successfully`);
      });

      worker.on('failed', (job, err) => {
        logger.error(`System job ${job?.id} failed:`, err);
      });

      logger.info('System worker started');
      return worker;
    } catch (error) {
      logger.error('Failed to setup system worker:', error);
      return null;
    }
  }

  private async processExpiringItems() {
    try {
      const expiringItems = await itemService.getExpiringItems(7);
      logger.info(`Found ${expiringItems.length} items expiring in 7 days`);

      for (const item of expiringItems as unknown as PopulatedItem[]) {
        if (item.registeredBy) {
          await notificationService.queueNotification({
            event: NotificationEvent.RETENTION_EXPIRY_WARNING,
            userId: item.registeredBy._id.toString(),
            data: {
              itemId: item._id.toString(),
              description: item.description,
              expiryDate: item.retentionExpiryDate,
            },
          });
        }
      }
    } catch (error) {
      logger.error('Error processing expiring items:', error);
      throw error;
    }
  }
}

export default new JobService();
