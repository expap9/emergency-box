import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

export const boxRouter = Router();
boxRouter.use(authenticate);

// List all boxes
boxRouter.get('/', async (_req, res: Response) => {
  const boxes = await prisma.box.findMany({
    orderBy: { boxNumber: 'asc' },
    include: {
      batches: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          distributions: { where: { status: 'ACTIVE' }, include: { ward: true } },
        },
      },
    },
  });
  res.json(boxes);
});

// Get box by ID or QR code
boxRouter.get('/:id', async (req, res: Response) => {
  const box = await prisma.box.findFirst({
    where: { OR: [{ id: String(req.params.id) }, { qrCode: String(req.params.id) }] },
    include: {
      batches: {
        orderBy: { createdAt: 'desc' },
        include: {
          preparedBy: { select: { name: true } },
          medications: { include: { medication: true } },
          distributions: {
            include: {
              ward: true,
              distributedBy: { select: { name: true } },
              returnedBy: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!box) return res.status(404).json({ error: 'Box not found' });
  res.json(box);
});

// Create box
boxRouter.post('/', requireRole('ADMIN', 'PHARMACIST'), async (req: AuthRequest, res: Response) => {
  const { boxNumber, notes } = req.body;
  if (!boxNumber) return res.status(400).json({ error: 'Box number is required' });

  const qrCode = `EBTS-BOX-${uuidv4()}`;
  const qrCodeDataUrl = await QRCode.toDataURL(
    `${process.env.APP_URL || 'http://localhost:5173'}/scan/${qrCode}`,
    { width: 256, margin: 2 }
  );

  const box = await prisma.box.create({
    data: { boxNumber, qrCode, notes },
  });
  res.status(201).json({ ...box, qrCodeDataUrl });
});

// Update box
boxRouter.put('/:id', requireRole('ADMIN', 'PHARMACIST'), async (req, res: Response) => {
  const { notes, status } = req.body;
  const box = await prisma.box.update({
    where: { id: String(req.params.id) },
    data: { notes, ...(status && { status }) },
  });
  res.json(box);
});

// Get QR code image for box
boxRouter.get('/:id/qrcode', async (req, res: Response) => {
  const box = await prisma.box.findUnique({ where: { id: String(req.params.id) } });
  if (!box) return res.status(404).json({ error: 'Box not found' });

  const url = `${process.env.APP_URL || 'http://localhost:5173'}/scan/${box.qrCode}`;
  const qrCodeDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  res.json({ qrCode: box.qrCode, qrCodeDataUrl, url });
});
