import winston from 'winston';
import fs from 'fs';

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

// เพิ่ม File transport เฉพาะตอน dev (local) เท่านั้น
if (process.env.NODE_ENV !== 'production') {
  try {
    fs.mkdirSync('logs', { recursive: true });
    transports.push(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
    transports.push(new winston.transports.File({ filename: 'logs/combined.log' }));
  } catch {
    // ถ้าสร้าง logs folder ไม่ได้ก็ข้ามไป
  }
}

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
});
