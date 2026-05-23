import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

export const userRouter = Router();
userRouter.use(authenticate);

userRouter.get('/', requireRole('ADMIN'), async (_req, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, email: true, role: true, telegramId: true, isActive: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

userRouter.post('/', requireRole('ADMIN'), async (req, res: Response) => {
  const { username, name, email, password, role, telegramId } = req.body;
  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, name, email, password: hashed, role, telegramId },
    select: { id: true, username: true, name: true, email: true, role: true, telegramId: true },
  });
  res.status(201).json(user);
});

userRouter.put('/:id', requireRole('ADMIN'), async (req, res: Response) => {
  const { name, email, role, telegramId, isActive, password } = req.body;
  const data: Record<string, unknown> = { name, email, role, telegramId, isActive };
  if (password) data.password = await bcrypt.hash(password, 12);
  const user = await prisma.user.update({
    where: { id: String(req.params.id) },
    data,
    select: { id: true, username: true, name: true, email: true, role: true, telegramId: true, isActive: true },
  });
  res.json(user);
});

// Update own profile (telegram id, notification preferences)
userRouter.put('/profile/me', authenticate, async (req: AuthRequest, res: Response) => {
  const { telegramId, name } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { telegramId, name },
    select: { id: true, username: true, name: true, email: true, role: true, telegramId: true },
  });
  res.json(user);
});
