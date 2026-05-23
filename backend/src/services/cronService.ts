import cron from 'node-cron';
import { sendExpiryNotifications } from './notificationService';
import { logger } from '../utils/logger';

export function startCronJobs() {
  // Run expiry check every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running daily expiry notification check...');
    try {
      await sendExpiryNotifications();
      logger.info('Expiry notification check completed');
    } catch (err) {
      logger.error('Expiry notification check failed', { error: err });
    }
  }, { timezone: 'Asia/Bangkok' });

  logger.info('⏰ Cron jobs started (daily at 08:00 Bangkok time)');
}
