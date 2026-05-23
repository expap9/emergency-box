import { Router, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';

export const wardRouter = Router();
wardRouter.use(authenticate);

wardRouter.get('/', async (_req, res: Response) => {
  const wards = await prisma.ward.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      distributions: {
        where: { status: 'ACTIVE' },
        include: { batch: { include: { box: true } } },
      },
    },
  });
  res.json(wards);
});

wardRouter.post('/', requireRole('ADMIN', 'PHARMACIST'), async (req, res: Response) => {
  const { name, code, floor, building, department, contactName, contactPhone } = req.body;
  const ward = await prisma.ward.create({
    data: { name, code, floor, building, department, contactName, contactPhone },
  });
  res.status(201).json(ward);
});

wardRouter.put('/:id', requireRole('ADMIN', 'PHARMACIST'), async (req, res: Response) => {
  const { name, code, floor, building, department, contactName, contactPhone, isActive } = req.body;
  const ward = await prisma.ward.update({
    where: { id: String(req.params.id) },
    data: { name, code, floor, building, department, contactName, contactPhone, isActive },
  });
  res.json(ward);
});

// Current boxes at ward
wardRouter.get('/:id/current-boxes', async (req, res: Response) => {
  const distributions = await prisma.distribution.findMany({
    where: { wardId: String(req.params.id), status: 'ACTIVE' },
    include: {
      batch: { include: { box: true, medications: { include: { medication: true } } } },
      distributedBy: { select: { name: true } },
    },
  });
  res.json(distributions);
});
