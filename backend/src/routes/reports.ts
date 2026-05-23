import { Router, Response } from 'express';
import { startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

export const reportRouter = Router();
reportRouter.use(authenticate);

// Dashboard summary
reportRouter.get('/dashboard', async (_req, res: Response) => {
  const now = new Date();
  const [
    totalBoxes,
    availableBoxes,
    distributedBoxes,
    expiringIn7,
    expiringIn30,
    expiredBatches,
    recentDistributions,
    wardSummary,
  ] = await Promise.all([
    prisma.box.count(),
    prisma.box.count({ where: { status: 'AVAILABLE' } }),
    prisma.box.count({ where: { status: 'DISTRIBUTED' } }),
    prisma.boxBatch.count({
      where: { expiryDate: { lte: addDays(now, 7), gte: now }, status: { not: 'RECALLED' } },
    }),
    prisma.boxBatch.count({
      where: { expiryDate: { lte: addDays(now, 30), gte: now }, status: { not: 'RECALLED' } },
    }),
    prisma.boxBatch.count({ where: { expiryDate: { lt: now } } }),
    prisma.distribution.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { distributedAt: 'desc' },
      take: 10,
      include: {
        batch: { include: { box: true } },
        ward: true,
        distributedBy: { select: { name: true } },
      },
    }),
    prisma.ward.findMany({
      include: {
        distributions: {
          where: { status: 'ACTIVE' },
          include: { batch: { select: { expiryDate: true, batchNumber: true } } },
        },
      },
    }),
  ]);

  res.json({
    summary: { totalBoxes, availableBoxes, distributedBoxes, expiringIn7, expiringIn30, expiredBatches },
    recentDistributions,
    wardSummary: wardSummary.map(w => ({
      ...w,
      activeBoxCount: w.distributions.length,
    })),
  });
});

// Expiry report
reportRouter.get('/expiry', async (req, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const batches = await prisma.boxBatch.findMany({
    where: {
      expiryDate: { lte: addDays(new Date(), days), gte: new Date() },
      status: { notIn: ['RECALLED', 'RETURNED'] },
    },
    orderBy: { expiryDate: 'asc' },
    include: {
      box: true,
      distributions: {
        where: { status: 'ACTIVE' },
        include: { ward: true },
      },
    },
  });
  res.json(batches);
});

// Distribution history report
reportRouter.get('/distributions', async (req, res: Response) => {
  const { from, to, wardId } = req.query;
  const where: Record<string, unknown> = {};
  if (from || to) {
    where.distributedAt = {
      ...(from && { gte: new Date(from as string) }),
      ...(to && { lte: new Date(to as string) }),
    };
  }
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

// Monthly statistics
reportRouter.get('/monthly', async (req, res: Response) => {
  const months = parseInt(req.query.months as string) || 6;
  const stats = [];
  for (let i = 0; i < months; i++) {
    const date = subMonths(new Date(), i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const [distributed, returned] = await Promise.all([
      prisma.distribution.count({ where: { distributedAt: { gte: start, lte: end } } }),
      prisma.distribution.count({ where: { returnedAt: { gte: start, lte: end } } }),
    ]);
    stats.unshift({ month: start.toISOString().slice(0, 7), distributed, returned });
  }
  res.json(stats);
});

// Ward activity report
reportRouter.get('/wards', async (_req, res: Response) => {
  const wards = await prisma.ward.findMany({
    include: {
      distributions: {
        include: {
          batch: { select: { expiryDate: true, batchNumber: true, box: { select: { boxNumber: true } } } },
        },
      },
    },
  });
  res.json(
    wards.map(w => ({
      ...w,
      totalDistributions: w.distributions.length,
      activeBoxes: w.distributions.filter(d => d.status === 'ACTIVE').length,
      returnedBoxes: w.distributions.filter(d => d.status === 'RETURNED').length,
    }))
  );
});
