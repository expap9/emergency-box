/**
 * PUBLIC scan routes — no authentication required.
 * Rate-limited. Exposes only the specific box identified by QR code (BoxBatch.qrCode).
 * Every action records performer name + IP for accountability.
 *
 * Recycle rule: box can be redistributed only when expiryDate > today + 30 days.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export const scanRouter = Router();

const RECYCLE_DAYS = 30; // days before expiry when box is locked from redistribution

function clientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function daysUntil(date: Date): number {
  return Math.floor((date.getTime() - Date.now()) / 86400000);
}

async function auditScan(action: string, entityId: string, detail: string, ip: string) {
  await prisma.auditLog.create({
    data: { action, entity: 'BoxBatch', entityId, detail, ip },
  }).catch(() => {}); // never block the response
}

async function findBatchByQr(qrCode: string) {
  return prisma.boxBatch.findUnique({
    where: { qrCode },
    include: {
      box: { select: { boxNumber: true } },
      medications: {
        include: { medication: true },
        orderBy: { medication: { sortOrder: 'asc' } },
      },
      distributions: {
        where: { status: 'ACTIVE' },
        include: { ward: { select: { name: true, code: true, floor: true, building: true } } },
        orderBy: { distributedAt: 'desc' },
        take: 1,
      },
    },
  });
}

// GET /api/scan/_wards — ward list for dropdown (public)
// ⚠️ Must be defined BEFORE /:qrCode to avoid Express capturing "_wards" as a parameter
scanRouter.get('/_wards', async (_req: Request, res: Response) => {
  const wards = await prisma.ward.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, floor: true, building: true },
    orderBy: { name: 'asc' },
  });
  res.json(wards);
});

// GET /api/scan/:qrCode — box info for the scan page (public)
scanRouter.get('/:qrCode', async (req: Request, res: Response) => {
  const batch = await findBatchByQr(String(req.params.qrCode));
  if (!batch) return res.status(404).json({ error: 'ไม่พบกล่องนี้ในระบบ' });

  const active = batch.distributions[0] ?? null;
  const days = daysUntil(batch.expiryDate);
  const isRecyclable = days > RECYCLE_DAYS;

  res.json({
    batchNumber: batch.batchNumber,
    batchStatus: batch.status,
    expiryDate: batch.expiryDate,
    daysToExpiry: days,
    isRecyclable,
    box: batch.box ? { boxNumber: batch.box.boxNumber } : null,
    medications: batch.medications.map((m) => ({
      name: m.medication.name,
      genericName: m.medication.genericName,
      strength: m.medication.strength,
      unit: m.medication.unit,
      quantity: m.quantity,
    })),
    currentLocation: active
      ? {
          distributionId: active.id,
          type: active.type,
          wardName: active.ward?.name ?? null,
          wardCode: active.ward?.code ?? null,
          wardFloor: active.ward?.floor ?? null,
          wardBuilding: active.ward?.building ?? null,
          borrowerName: active.borrowerName ?? null,
          borrowerDept: active.borrowerDept ?? null,
          loanPurpose: active.loanPurpose ?? null,
          distributedAt: active.distributedAt,
          expectedReturnAt: active.expectedReturnAt ?? null,
        }
      : null,
  });
});

// POST /api/scan/:qrCode/distribute — จ่ายกล่องไปหอผู้ป่วย
scanRouter.post('/:qrCode/distribute', async (req: Request, res: Response) => {
  const { wardId, performedBy, performedByRole, expectedReturnDays = 30 } = req.body;
  if (!wardId || !performedBy?.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุหอผู้ป่วยและชื่อผู้ดำเนินการ' });
  }

  const batch = await prisma.boxBatch.findUnique({ where: { qrCode: String(req.params.qrCode) } });
  if (!batch) return res.status(404).json({ error: 'ไม่พบกล่องนี้ในระบบ' });
  if (batch.status === 'DISTRIBUTED') return res.status(400).json({ error: 'กล่องนี้ถูกจ่ายออกไปแล้ว' });
  if (batch.status === 'EXPIRED' || batch.status === 'RECALLED') {
    return res.status(400).json({ error: 'กล่องนี้หมดอายุหรือถูกระงับการใช้งาน' });
  }

  const days = daysUntil(batch.expiryDate);
  if (days <= RECYCLE_DAYS) {
    return res.status(400).json({
      error: `กล่องนี้เหลืออายุ ${days} วัน (ต้องเกิน ${RECYCLE_DAYS} วัน) ไม่สามารถจ่ายออกได้ — กรุณาแจ้งห้องยาออก QR Code ใหม่`,
    });
  }

  const ward = await prisma.ward.findUnique({ where: { id: wardId } });
  if (!ward) return res.status(400).json({ error: 'ไม่พบหอผู้ป่วย' });

  const ip = clientIp(req);
  const expectedReturnAt = new Date(Date.now() + Number(expectedReturnDays) * 86400000);

  await prisma.$transaction([
    prisma.distribution.create({
      data: {
        batchId: batch.id,
        type: 'WARD',
        wardId,
        distributedById: await getSystemUserId(),
        performedByName: performedBy.trim(),
        performedByRole: performedByRole?.trim() ?? null,
        expectedReturnAt,
        status: 'ACTIVE',
        scannedViaQr: true,
      },
    }),
    prisma.boxBatch.update({ where: { id: batch.id }, data: { status: 'DISTRIBUTED' } }),
  ]);

  await auditScan('DISTRIBUTE_QR', batch.id, `${performedBy} → ${ward.name}`, ip);
  logger.info(`[SCAN] Distribute ${batch.batchNumber} → ${ward.name} by ${performedBy} (${ip})`);

  res.json({ success: true, message: `จ่ายกล่อง ${batch.batchNumber} ไป ${ward.name} เรียบร้อย` });
});

// POST /api/scan/:qrCode/loan — ยืมกล่อง
scanRouter.post('/:qrCode/loan', async (req: Request, res: Response) => {
  const { performedBy, borrowerDept, borrowerContact, loanPurpose, expectedReturnDays = 7 } = req.body;
  if (!performedBy?.trim()) return res.status(400).json({ error: 'กรุณาระบุชื่อผู้ยืม' });

  const batch = await prisma.boxBatch.findUnique({ where: { qrCode: String(req.params.qrCode) } });
  if (!batch) return res.status(404).json({ error: 'ไม่พบกล่องนี้ในระบบ' });
  if (batch.status === 'DISTRIBUTED') return res.status(400).json({ error: 'กล่องนี้ถูกจ่ายออกไปแล้ว' });
  if (batch.status === 'EXPIRED' || batch.status === 'RECALLED') {
    return res.status(400).json({ error: 'กล่องนี้หมดอายุหรือถูกระงับการใช้งาน' });
  }

  const days = daysUntil(batch.expiryDate);
  if (days <= RECYCLE_DAYS) {
    return res.status(400).json({
      error: `กล่องนี้เหลืออายุ ${days} วัน (ต้องเกิน ${RECYCLE_DAYS} วัน) ไม่สามารถยืมได้ — กรุณาแจ้งห้องยาออก QR Code ใหม่`,
    });
  }

  const ip = clientIp(req);
  const expectedReturnAt = new Date(Date.now() + Number(expectedReturnDays) * 86400000);

  await prisma.$transaction([
    prisma.distribution.create({
      data: {
        batchId: batch.id,
        type: 'LOAN',
        distributedById: await getSystemUserId(),
        performedByName: performedBy.trim(),
        borrowerName: performedBy.trim(),
        borrowerDept: borrowerDept?.trim() ?? null,
        borrowerContact: borrowerContact?.trim() ?? null,
        loanPurpose: loanPurpose?.trim() ?? null,
        expectedReturnAt,
        status: 'ACTIVE',
        scannedViaQr: true,
      },
    }),
    prisma.boxBatch.update({ where: { id: batch.id }, data: { status: 'DISTRIBUTED' } }),
  ]);

  await auditScan('LOAN_QR', batch.id, `ยืมโดย ${performedBy} (${borrowerDept ?? '-'})`, ip);
  logger.info(`[SCAN] Loan ${batch.batchNumber} to ${performedBy} (${ip})`);

  res.json({ success: true, message: `บันทึกการยืมกล่อง ${batch.batchNumber} โดย ${performedBy} เรียบร้อย` });
});

// POST /api/scan/:qrCode/return — รับคืนกล่อง
scanRouter.post('/:qrCode/return', async (req: Request, res: Response) => {
  const { performedBy, condition = 'GOOD', conditionNotes } = req.body;
  if (!performedBy?.trim()) return res.status(400).json({ error: 'กรุณาระบุชื่อผู้รับคืน' });

  const batch = await prisma.boxBatch.findUnique({ where: { qrCode: String(req.params.qrCode) } });
  if (!batch) return res.status(404).json({ error: 'ไม่พบกล่องนี้ในระบบ' });

  const activeDist = await prisma.distribution.findFirst({
    where: { batchId: batch.id, status: 'ACTIVE' },
    include: { ward: true },
    orderBy: { distributedAt: 'desc' },
  });
  if (!activeDist) return res.status(400).json({ error: 'กล่องนี้ยังไม่ได้ถูกจ่ายออกไป' });

  const ip = clientIp(req);

  // Recycle: set back to ACTIVE if still >30 days remaining; else RETURNED (locked)
  const days = daysUntil(batch.expiryDate);
  const recyclable = days > RECYCLE_DAYS;
  const newStatus = recyclable ? 'ACTIVE' : 'RETURNED';

  await prisma.$transaction([
    prisma.distribution.update({
      where: { id: activeDist.id },
      data: {
        returnedAt: new Date(),
        returnedById: await getSystemUserId(),
        performedByNameReturn: performedBy.trim(),
        condition: condition as 'GOOD' | 'FAIR' | 'DAMAGED' | 'INCOMPLETE',
        conditionNotes: conditionNotes?.trim() ?? null,
        status: 'RETURNED',
        scannedViaQr: true,
      },
    }),
    prisma.boxBatch.update({ where: { id: batch.id }, data: { status: newStatus } }),
  ]);

  const from = activeDist.ward?.name ?? activeDist.borrowerName ?? 'ไม่ระบุ';
  await auditScan('RETURN_QR', batch.id, `รับคืนจาก ${from} โดย ${performedBy} สภาพ: ${condition}`, ip);
  logger.info(`[SCAN] Return ${batch.batchNumber} from ${from} by ${performedBy} recyclable=${recyclable} (${ip})`);

  const message = recyclable
    ? `รับคืนกล่อง ${batch.batchNumber} เรียบร้อย ✓ สามารถจ่ายออกได้อีก (เหลือ ${days} วัน)`
    : `รับคืนกล่อง ${batch.batchNumber} เรียบร้อย — กล่องใกล้หมดอายุ (เหลือ ${days} วัน) กรุณาแจ้งห้องยาออก QR ใหม่`;

  res.json({ success: true, message, recyclable, daysToExpiry: days });
});

// POST /api/scan/:qrCode/request-stock — แจ้งขอลง Stock
scanRouter.post('/:qrCode/request-stock', async (req: Request, res: Response) => {
  const { performedBy, notes } = req.body;
  if (!performedBy?.trim()) return res.status(400).json({ error: 'กรุณาระบุชื่อผู้แจ้ง' });

  const batch = await prisma.boxBatch.findUnique({ where: { qrCode: String(req.params.qrCode) } });
  if (!batch) return res.status(404).json({ error: 'ไม่พบกล่องนี้ในระบบ' });

  const ip = clientIp(req);
  await auditScan('REQUEST_STOCK_QR', batch.id, `แจ้งขอลง stock โดย ${performedBy}: ${notes ?? '-'}`, ip);
  logger.info(`[SCAN] Stock request for ${batch.batchNumber} by ${performedBy} (${ip})`);

  try {
    await prisma.notification.create({
      data: {
        batchId: batch.id,
        type: 'CUSTOM',
        message: `📦 แจ้งขอลงยากล่อง ${batch.batchNumber} โดย ${performedBy}${notes ? ` — ${notes}` : ''}`,
        status: 'PENDING',
      },
    });
  } catch { /* non-blocking */ }

  res.json({ success: true, message: `แจ้งห้องยาเรียบร้อย — ห้องยาจะดำเนินการโดยเร็ว` });
});

// helper — system user for scan actions (cached with 1-hour TTL)
let _systemUserId: string | null = null;
let _systemUserIdFetchedAt = 0;
const SYSTEM_USER_CACHE_MS = 60 * 60 * 1000;

async function getSystemUserId(): Promise<string> {
  const now = Date.now();
  if (_systemUserId && (now - _systemUserIdFetchedAt) < SYSTEM_USER_CACHE_MS) {
    return _systemUserId;
  }
  // Prefer ADMIN, fall back to any active user — never use a fake 'system' string
  const sys = await prisma.user.findFirst({
    where: { isActive: true, role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  }) ?? await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!sys) throw new Error('ไม่พบผู้ใช้ในระบบ — กรุณาสร้างบัญชี admin ก่อนใช้งาน QR scan');
  _systemUserId = sys.id;
  _systemUserIdFetchedAt = now;
  return _systemUserId;
}
