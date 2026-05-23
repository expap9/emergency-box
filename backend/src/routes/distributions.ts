import { Router, Response } from 'express';
import { addDays } from 'date-fns';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

export const distributionRouter = Router();
distributionRouter.use(authenticate);

// List distributions
distributionRouter.get('/', async (req, res: Response) => {
  const { status, wardId } = req.query;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (wardId) where.wardId = wardId;

  const distributions = await prisma.distribution.findMany({
    where,
    orderBy: { distributedAt: 'desc' },
    include: {
      batch: { include: { box: true } },
      ward: true,
      distributedBy: { select: { name: true } },
      returnedBy: { select: { name: true } },
    },
  });
  res.json(distributions);
});

// Distribute box to ward (จ่ายกล่องไปหอ)
distributionRouter.post('/', requireRole('ADMIN', 'PHARMACIST', 'STAFF'), async (req: AuthRequest, res: Response) => {
  const { batchId, wardId, expectedReturnDays = 30 } = req.body;
  if (!batchId || !wardId) return res.status(400).json({ error: 'batchId and wardId are required' });

  const batch = await prisma.boxBatch.findUnique({
    where: { id: batchId },
    include: { distributions: { where: { status: 'ACTIVE' } } },
  });
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  if (batch.status === 'RECALLED') return res.status(400).json({ error: 'Batch is recalled' });
  if (batch.distributions.length > 0) return res.status(400).json({ error: 'Batch already distributed' });

  const distribution = await prisma.distribution.create({
    data: {
      batchId,
      wardId,
      distributedById: req.user!.id,
      expectedReturnAt: addDays(new Date(), expectedReturnDays),
      status: 'ACTIVE',
    },
    include: {
      batch: { include: { box: true } },
      ward: true,
      distributedBy: { select: { name: true } },
    },
  });

  const updates: Promise<unknown>[] = [
    prisma.boxBatch.update({ where: { id: batchId }, data: { status: 'DISTRIBUTED' } }),
  ];
  if (batch.boxId) {
    updates.push(prisma.box.update({ where: { id: batch.boxId }, data: { status: 'DISTRIBUTED' } }));
  }
  await Promise.all(updates);

  res.status(201).json(distribution);
});

// Return box (รับกล่องคืน)
distributionRouter.post('/:id/return', requireRole('ADMIN', 'PHARMACIST', 'STAFF'), async (req: AuthRequest, res: Response) => {
  const { condition, conditionNotes } = req.body;

  const distribution = await prisma.distribution.findUnique({
    where: { id: String(req.params.id) },
    include: { batch: true },
  });
  if (!distribution) return res.status(404).json({ error: 'Distribution not found' });
  if (distribution.status === 'RETURNED') return res.status(400).json({ error: 'Already returned' });

  const updated = await prisma.distribution.update({
    where: { id: String(req.params.id) },
    data: {
      returnedAt: new Date(),
      returnedById: req.user!.id,
      condition,
      conditionNotes,
      status: 'RETURNED',
    },
    include: {
      batch: { include: { box: true } },
      ward: true,
      distributedBy: { select: { name: true } },
      returnedBy: { select: { name: true } },
    },
  });

  const batchWithBox = await prisma.boxBatch.findUnique({ where: { id: distribution.batchId } });
  const returnUpdates: Promise<unknown>[] = [
    prisma.boxBatch.update({ where: { id: distribution.batchId }, data: { status: 'RETURNED' } }),
  ];
  if (batchWithBox?.boxId) {
    returnUpdates.push(prisma.box.update({ where: { id: batchWithBox.boxId }, data: { status: 'AVAILABLE' } }));
  }
  await Promise.all(returnUpdates);

  res.json(updated);
});

// Get distribution by batch (for QR scan)
distributionRouter.get('/batch/:batchId', async (req, res: Response) => {
  const dist = await prisma.distribution.findFirst({
    where: { batchId: String(req.params.batchId), status: 'ACTIVE' },
    include: {
      batch: { include: { box: true, medications: { include: { medication: true } } } },
      ward: true,
      distributedBy: { select: { name: true } },
    },
  });
  res.json(dist);
});
