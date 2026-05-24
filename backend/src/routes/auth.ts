import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

const MAX_FAILURES = 5;          // ล็อคหลัง 5 ครั้งผิด
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // ภายใน 15 นาที

function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
    || req.socket.remoteAddress
    || 'unknown';
}

authRouter.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const ip = clientIp(req);
  const uname = String(username).toLowerCase().trim();

  // ── Per-username lockout check ──
  const recentFailures = await prisma.loginAttempt.count({
    where: {
      username: uname,
      success: false,
      createdAt: { gte: new Date(Date.now() - LOCKOUT_WINDOW_MS) },
    },
  });
  if (recentFailures >= MAX_FAILURES) {
    return res.status(429).json({
      error: `บัญชีถูกล็อคชั่วคราว กรุณาลองใหม่ใน 15 นาที (ลองผิดแล้ว ${recentFailures} ครั้ง)`,
    });
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username }], isActive: true },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    // Record failure (non-blocking)
    prisma.loginAttempt.create({ data: { username: uname, ip, success: false } }).catch(() => {});
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Record success
  prisma.loginAttempt.create({ data: { username: uname, ip, success: true } }).catch(() => {});

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  });

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role },
  });
});

authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, username: true, name: true, email: true, role: true, telegramId: true },
  });
  res.json(user);
});

authRouter.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.user!.id }, data: { password: hashed } });
  res.json({ message: 'Password changed successfully' });
});
