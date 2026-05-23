import { Router, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';

export const settingRouter = Router();
settingRouter.use(authenticate);

settingRouter.get('/', async (_req, res: Response) => {
  const settings = await prisma.systemSetting.findMany();
  const map: Record<string, string> = {};
  settings.forEach(s => (map[s.key] = s.value));
  res.json(map);
});

settingRouter.put('/', requireRole('ADMIN'), async (req, res: Response) => {
  const settings: Record<string, string> = req.body;
  await Promise.all(
    Object.entries(settings).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
  res.json({ message: 'Settings saved' });
});
