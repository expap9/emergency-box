import { Router, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { sendExpiryNotifications } from '../services/notificationService';

export const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get('/', async (_req, res: Response) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { sentAt: 'desc' },
    take: 50,
    include: {
      batch: { include: { box: true } },
      recipients: { include: { user: { select: { name: true, email: true } } } },
    },
  });
  res.json(notifications);
});

// Manually trigger notification check
notificationRouter.post('/check', requireRole('ADMIN', 'PHARMACIST'), async (_req, res: Response) => {
  await sendExpiryNotifications();
  res.json({ message: 'Notification check completed' });
});

// Send custom notification
notificationRouter.post('/custom', requireRole('ADMIN', 'PHARMACIST'), async (req, res: Response) => {
  const { batchId, message, userIds } = req.body;
  const notification = await prisma.notification.create({
    data: {
      batchId,
      type: 'CUSTOM',
      message,
      status: 'PENDING',
      recipients: {
        create: userIds.flatMap((userId: string) => [
          { userId, channel: 'EMAIL' },
          { userId, channel: 'TELEGRAM' },
        ]),
      },
    },
  });
  res.status(201).json(notification);
});
