import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth';
import { boxRouter } from './routes/boxes';
import { batchRouter } from './routes/batches';
import { medicationRouter } from './routes/medications';
import { wardRouter } from './routes/wards';
import { distributionRouter } from './routes/distributions';
import { reportRouter } from './routes/reports';
import { notificationRouter } from './routes/notifications';
import { settingRouter } from './routes/settings';
import { userRouter } from './routes/users';
import { scanRouter } from './routes/scan';
import { startCronJobs } from './services/cronService';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 4000;

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
}));

app.set('trust proxy', 1); // trust nginx reverse proxy

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://emergency-box.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Global rate limit (all routes)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
}));

// Stricter rate limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 login attempts per 15 min per IP
  message: { error: 'Too many login attempts, please try again later' },
});

// Scan-specific rate limit (public, generous but bounded)
const scanLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60, // 60 scan actions per 5 min per IP
  message: { error: 'กรุณารอสักครู่แล้วลองใหม่' },
});

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public QR scan routes (no auth, rate-limited)
app.use('/api/scan', scanLimiter, scanRouter);

// Authenticated routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/boxes', boxRouter);
app.use('/api/batches', batchRouter);
app.use('/api/medications', medicationRouter);
app.use('/api/wards', wardRouter);
app.use('/api/distributions', distributionRouter);
app.use('/api/reports', reportRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/settings', settingRouter);
app.use('/api/users', userRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`🚑 EBTS Backend running on port ${PORT}`);
  startCronJobs();
});

export default app;
