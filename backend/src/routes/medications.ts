import { Router, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';

export const medicationRouter = Router();
medicationRouter.use(authenticate);

medicationRouter.get('/', async (_req, res: Response) => {
  const meds = await prisma.medication.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json(meds);
});

medicationRouter.post('/', requireRole('ADMIN', 'PHARMACIST'), async (req, res: Response) => {
  const { name, genericName, strength, unit, standardQty, description, sortOrder } = req.body;
  const med = await prisma.medication.create({
    data: { name, genericName, strength, unit, standardQty, description, sortOrder: sortOrder || 0 },
  });
  res.status(201).json(med);
});

medicationRouter.put('/:id', requireRole('ADMIN', 'PHARMACIST'), async (req, res: Response) => {
  const { name, genericName, strength, unit, standardQty, description, sortOrder, isActive } = req.body;
  const med = await prisma.medication.update({
    where: { id: String(req.params.id) },
    data: { name, genericName, strength, unit, standardQty, description, sortOrder, isActive },
  });
  res.json(med);
});
