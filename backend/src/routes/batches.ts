import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { format, addDays } from 'date-fns';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

export const batchRouter = Router();
batchRouter.use(authenticate);

const appUrl = () => process.env.APP_URL || 'http://localhost';

// List batches with filters
batchRouter.get('/', async (req, res: Response) => {
  const { status, expiringSoon } = req.query;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (expiringSoon === 'true') {
    where.expiryDate = { lte: addDays(new Date(), 30), gte: new Date() };
  }

  const batches = await prisma.boxBatch.findMany({
    where,
    orderBy: { expiryDate: 'asc' },
    include: {
      box: true,
      preparedBy: { select: { name: true } },
      medications: { include: { medication: true }, orderBy: { medication: { sortOrder: 'asc' } } },
      distributions: {
        orderBy: { distributedAt: 'desc' },
        take: 1,
        include: { ward: true },
      },
    },
  });
  res.json(batches);
});

// Get batch by ID
batchRouter.get('/:id', async (req, res: Response) => {
  const batch = await prisma.boxBatch.findUnique({
    where: { id: String(req.params.id) },
    include: {
      box: true,
      preparedBy: { select: { name: true } },
      medications: { include: { medication: true }, orderBy: { medication: { sortOrder: 'asc' } } },
      distributions: {
        orderBy: { distributedAt: 'desc' },
        include: {
          ward: true,
          distributedBy: { select: { name: true } },
          returnedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!batch) return res.status(404).json({ error: 'Batch not found' });

  const qrUrl = batch.qrCode ? `${appUrl()}/scan/${batch.qrCode}` : null;
  const qrCodeDataUrl = qrUrl
    ? await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 })
    : null;

  res.json({ ...batch, qrCodeDataUrl });
});

// Create batch (จัดยาใส่กล่อง — detailed flow with box + medications)
batchRouter.post('/', requireRole('ADMIN', 'PHARMACIST'), async (req: AuthRequest, res: Response) => {
  const { boxId, expiryDate, medications, notes } = req.body;
  if (!boxId || !expiryDate || !medications?.length) {
    return res.status(400).json({ error: 'boxId, expiryDate, and medications are required' });
  }

  const box = await prisma.box.findUnique({ where: { id: boxId } });
  if (!box) return res.status(404).json({ error: 'Box not found' });

  const qrCode = randomUUID();
  const batchNumber = `BATCH-${format(new Date(), 'yyyyMMdd')}-${box.boxNumber}-${Date.now().toString().slice(-4)}`;

  const batch = await prisma.boxBatch.create({
    data: {
      batchNumber,
      qrCode,
      boxId,
      preparedDate: new Date(),
      expiryDate: new Date(expiryDate),
      preparedById: req.user!.id,
      notes,
      status: 'ACTIVE',
      medications: {
        create: medications.map((m: { medicationId: string; quantity: number; lotNumber?: string; expiryDate?: string }) => ({
          medicationId: m.medicationId,
          quantity: m.quantity,
          lotNumber: m.lotNumber,
          expiryDate: m.expiryDate ? new Date(m.expiryDate) : null,
        })),
      },
    },
    include: {
      box: true,
      medications: { include: { medication: true } },
      preparedBy: { select: { name: true } },
    },
  });

  await prisma.box.update({ where: { id: boxId }, data: { status: 'AVAILABLE' } });

  const qrUrl = `${appUrl()}/scan/${qrCode}`;
  const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 });

  res.status(201).json({ ...batch, qrCodeDataUrl });
});

// Bulk issue QR codes (ออก QR ทีละหลายดวง — pharmacy only)
batchRouter.post('/bulk-issue', requireRole('ADMIN', 'PHARMACIST'), async (req: AuthRequest, res: Response) => {
  const { expiryDate, quantity, notes } = req.body;

  if (!expiryDate) return res.status(400).json({ error: 'expiryDate is required' });
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty < 1 || qty > 100) {
    return res.status(400).json({ error: 'quantity ต้องอยู่ระหว่าง 1–100' });
  }
  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime()) || expiry <= new Date()) {
    return res.status(400).json({ error: 'วันหมดอายุต้องเป็นวันในอนาคต' });
  }

  // Count existing QR batches today to generate sequential numbers
  const today = format(new Date(), 'yyyyMMdd');
  const existingCount = await prisma.boxBatch.count({
    where: { batchNumber: { startsWith: `QR-${today}-` } },
  });

  // Get standard medications for auto-populate
  const meds = await prisma.medication.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const base = appUrl();
  const results = [];

  for (let i = 0; i < qty; i++) {
    const qrCode = randomUUID();
    const seq = String(existingCount + i + 1).padStart(3, '0');
    const ts = format(new Date(), 'HHmmss');
    const batchNumber = `QR-${today}-${ts}-${seq}`;

    const batch = await prisma.boxBatch.create({
      data: {
        batchNumber,
        qrCode,
        expiryDate: expiry,
        preparedById: req.user!.id,
        status: 'ACTIVE',
        notes: notes || null,
        medications: {
          create: meds.map((m) => ({
            medicationId: m.id,
            quantity: m.standardQty,
          })),
        },
      },
      include: {
        medications: { include: { medication: true } },
        preparedBy: { select: { name: true } },
      },
    });

    const qrUrl = `${base}/scan/${qrCode}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 });
    results.push({ ...batch, qrCodeDataUrl, qrUrl });
  }

  res.status(201).json(results);
});

// Mark sticker as printed
batchRouter.post('/:id/print-sticker', requireRole('ADMIN', 'PHARMACIST'), async (req, res: Response) => {
  const batch = await prisma.boxBatch.update({
    where: { id: String(req.params.id) },
    data: { stickerPrinted: true, stickerPrintedAt: new Date() },
    include: { box: true, medications: { include: { medication: true } } },
  });

  const qrUrl = batch.qrCode ? `${appUrl()}/scan/${batch.qrCode}` : null;
  const qrCodeDataUrl = qrUrl
    ? await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 })
    : null;

  res.json({ ...batch, qrCodeDataUrl });
});

// Recall batch
batchRouter.post('/:id/recall', requireRole('ADMIN', 'PHARMACIST'), async (req, res: Response) => {
  const { reason } = req.body;
  const batch = await prisma.boxBatch.update({
    where: { id: String(req.params.id) },
    data: { status: 'RECALLED', notes: reason },
  });
  res.json(batch);
});

// Refill batch — ลงยาใหม่ (same QR code, new expiry, counted as a new cycle)
batchRouter.post('/:id/refill', requireRole('ADMIN', 'PHARMACIST'), async (req: AuthRequest, res: Response) => {
  const batchId = String(req.params.id);
  const { expiryDate, notes } = req.body;

  if (!expiryDate) return res.status(400).json({ error: 'กรุณาระบุวันหมดอายุใหม่' });
  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime()) || expiry <= new Date()) {
    return res.status(400).json({ error: 'วันหมดอายุต้องเป็นวันในอนาคต' });
  }

  const existing = await prisma.boxBatch.findUnique({ where: { id: batchId } });
  if (!existing) return res.status(404).json({ error: 'Batch not found' });
  if (existing.status !== 'RETURNED') {
    return res.status(400).json({ error: 'สามารถลงยาใหม่ได้เฉพาะกล่องที่รับคืนแล้วเท่านั้น' });
  }

  const batch = await prisma.boxBatch.update({
    where: { id: batchId },
    data: {
      status: 'ACTIVE',
      expiryDate: expiry,
      preparedDate: new Date(),
      preparedById: req.user!.id,
      stickerPrinted: false,
      stickerPrintedAt: null,
      ...(notes !== undefined && { notes: notes || null }),
    },
    include: {
      box: true,
      medications: { include: { medication: true }, orderBy: { medication: { sortOrder: 'asc' } } },
      preparedBy: { select: { name: true } },
      distributions: {
        orderBy: { distributedAt: 'desc' },
        include: { ward: true, distributedBy: { select: { name: true } }, returnedBy: { select: { name: true } } },
      },
    },
  });

  const qrUrl = batch.qrCode ? `${appUrl()}/scan/${batch.qrCode}` : null;
  const qrCodeDataUrl = qrUrl ? await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 }) : null;

  res.json({ ...batch, qrCodeDataUrl });
});
