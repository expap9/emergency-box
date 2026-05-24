import nodemailer from 'nodemailer';
import TelegramBot from 'node-telegram-bot-api';
import { addDays, format } from 'date-fns';
import { th } from 'date-fns/locale';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

let telegramBot: TelegramBot | null = null;

if (process.env.TELEGRAM_BOT_TOKEN) {
  telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const ALERT_THRESHOLDS = [30, 7, 1];
const TYPE_MAP: Record<number, string> = {
  30: 'EXPIRY_30_DAYS',
  7: 'EXPIRY_7_DAYS',
  1: 'EXPIRY_1_DAY',
};

export async function sendExpiryNotifications() {
  const now = new Date();

  for (const days of ALERT_THRESHOLDS) {
    const targetDate = addDays(now, days);
    const batches = await prisma.boxBatch.findMany({
      where: {
        expiryDate: {
          gte: new Date(targetDate.toDateString()),
          lt: addDays(new Date(targetDate.toDateString()), 1),
        },
        status: { notIn: ['RECALLED', 'RETURNED'] },
      },
      include: {
        box: true,
        distributions: { where: { status: 'ACTIVE' }, include: { ward: true } },
      },
    });

    for (const batch of batches) {
      const existing = await prisma.notification.findFirst({
        where: { batchId: batch.id, type: TYPE_MAP[days] as 'EXPIRY_30_DAYS' | 'EXPIRY_7_DAYS' | 'EXPIRY_1_DAY' },
      });
      if (existing) continue;

      const ward = batch.distributions[0]?.ward;
      const expiryStr = format(batch.expiryDate, 'd MMMM yyyy', { locale: th });
      const locationStr = ward ? `หอผู้ป่วย ${ward.name}` : 'ห้องยา';
      const boxLabel = batch.box?.boxNumber ?? batch.batchNumber;
      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      const detailLink = `${appUrl}/batches/${batch.id}/sticker`;
      const phoneStr = ward?.contactPhone ? `\n📞 เบอร์ติดต่อ: ${ward.contactPhone}` : '';
      const message = `⚠️ กล่องยา Emergency Box ${boxLabel} (${batch.batchNumber}) จะหมดอายุใน ${days} วัน (${expiryStr})\n📍 ปัจจุบันอยู่ที่: ${locationStr}${phoneStr}\n🔗 ดูรายละเอียด: ${detailLink}`;

      const users = await prisma.user.findMany({
        where: { isActive: true, role: { in: ['ADMIN', 'PHARMACIST'] } },
      });

      const notification = await prisma.notification.create({
        data: {
          batchId: batch.id,
          type: TYPE_MAP[days] as 'EXPIRY_30_DAYS' | 'EXPIRY_7_DAYS' | 'EXPIRY_1_DAY',
          message,
          status: 'PENDING',
          recipients: {
            create: users.flatMap(u => [
              { userId: u.id, channel: 'EMAIL' as const },
              ...(u.telegramId ? [{ userId: u.id, channel: 'TELEGRAM' as const }] : []),
            ]),
          },
        },
        include: { recipients: { include: { user: true } } },
      });

      // Send notifications
      for (const recipient of notification.recipients) {
        try {
          if (recipient.channel === 'EMAIL' && recipient.user.email) {
            await transporter.sendMail({
              from: process.env.EMAIL_FROM,
              to: recipient.user.email,
              subject: `⚠️ Emergency Box ใกล้หมดอายุ - ${batch.box?.boxNumber ?? batch.batchNumber}`,
              html: buildEmailHtml(message, batch, ward),
            });
          } else if (recipient.channel === 'TELEGRAM' && recipient.user.telegramId && telegramBot) {
            // Build Telegram message with clickable link using HTML tags
            const tgMsg = message.replace(
              /🔗 ดูรายละเอียด: (https?:\/\/\S+)/,
              '🔗 <a href="$1">ดูรายละเอียดในระบบ</a>'
            );
            await telegramBot.sendMessage(recipient.user.telegramId, tgMsg, { parse_mode: 'HTML' });
          }
          await prisma.notificationRecipient.update({
            where: { id: recipient.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
        } catch (err) {
          logger.error('Failed to send notification', { error: err, recipientId: recipient.id });
          await prisma.notificationRecipient.update({
            where: { id: recipient.id },
            data: { status: 'FAILED', errorMessage: String(err) },
          });
        }
      }
      await prisma.notification.update({ where: { id: notification.id }, data: { status: 'SENT' } });
      logger.info(`Sent expiry notification for batch ${batch.batchNumber} (${days} days)`);
    }
  }

  // Mark expired
  await prisma.boxBatch.updateMany({
    where: { expiryDate: { lt: now }, status: 'ACTIVE' },
    data: { status: 'EXPIRED' },
  });
  await prisma.box.updateMany({
    where: {
      batches: { some: { status: 'EXPIRED' } },
      status: { not: 'DISTRIBUTED' },
    },
    data: { status: 'EXPIRED' },
  });
}

function buildEmailHtml(
  message: string,
  batch: { id: string; box?: { boxNumber: string } | null; batchNumber: string; expiryDate: Date },
  ward: { name: string; contactPhone?: string | null } | null | undefined
) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const detailLink = `${appUrl}/batches/${batch.id}/sticker`;
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #dc2626; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠️ แจ้งเตือน Emergency Box ใกล้หมดอายุ</h2>
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
          <tr style="background: #f3f4f6;">
            <td style="padding: 8px; font-weight: bold;">กล่องหมายเลข</td>
            <td style="padding: 8px;">${batch.box?.boxNumber ?? batch.batchNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Batch</td>
            <td style="padding: 8px;">${batch.batchNumber}</td>
          </tr>
          <tr style="background: #f3f4f6;">
            <td style="padding: 8px; font-weight: bold;">วันหมดอายุ</td>
            <td style="padding: 8px; color: #dc2626; font-weight: bold;">${format(batch.expiryDate, 'dd/MM/yyyy')}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">ตำแหน่ง</td>
            <td style="padding: 8px;">${ward ? `หอผู้ป่วย ${ward.name}` : 'ห้องยา'}</td>
          </tr>
          ${ward?.contactPhone ? `
          <tr style="background: #f3f4f6;">
            <td style="padding: 8px; font-weight: bold;">เบอร์ติดต่อ</td>
            <td style="padding: 8px;">📞 ${ward.contactPhone}</td>
          </tr>` : ''}
        </table>
        <div style="text-align: center; margin-top: 20px;">
          <a href="${detailLink}" style="background: #dc2626; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
            🔗 ดูรายละเอียดในระบบ
          </a>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">ระบบติดตาม Emergency Box - โรงพยาบาล</p>
      </div>
    </div>
  `;
}
