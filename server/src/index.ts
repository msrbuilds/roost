import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { stripeWebhookRouter } from './routes/stripe-webhook.js';
import { stripeApiRouter } from './routes/stripe-api.js';
import { healthRouter } from './routes/health.js';
import passwordResetRouter from './routes/password-reset.js';
import emailPreviewRouter from './routes/email-preview.js';
import twoFactorRouter from './routes/two-factor.js';
import { notificationsRouter } from './routes/notifications.js';
import { backupRouter } from './routes/backup.js';
import { activationApiRouter } from './routes/activation-api.js';
import { uploadRouter } from './routes/upload.js';
import { liveRoomRouter } from './routes/live-room.js';
import { siteSettingsRouter } from './routes/site-settings.js';
import path from 'path';
import { initRedis, closeRedis, isRedisAvailable } from './lib/redis.js';
import {
  apiRateLimiter,
  webhookRateLimiter,
  createAdminRateLimiter,
  authRateLimiter,
} from './middleware/redis-rate-limit.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Conditional trust proxy - only enable in production or when explicitly configured
// This prevents IP spoofing in development environments
const shouldTrustProxy = process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true';
if (shouldTrustProxy) {
  app.set('trust proxy', 1);
}
console.log(`Trust proxy: ${shouldTrustProxy ? 'enabled' : 'disabled'}`);

// CORS configuration - must be before other middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5000'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Security middleware (after CORS to not block preflight)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting - use Redis-backed rate limiters for distributed state persistence
// Falls back to in-memory if Redis is unavailable
const USE_REDIS_RATE_LIMIT = process.env.REDIS_RATE_LIMIT !== 'false';

if (USE_REDIS_RATE_LIMIT) {
  console.log('[RateLimit] Using Redis-backed rate limiting');
  app.use('/api/', apiRateLimiter);
  app.use('/api/webhooks/', webhookRateLimiter);
} else {
  // Fallback to express-rate-limit (in-memory)
  console.log('[RateLimit] Using in-memory rate limiting');
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use('/api/', limiter);

  const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 50,
    message: 'Too many webhook requests.',
  });
  app.use('/api/webhooks/', webhookLimiter);
}

// Extract user ID from JWT token for user-based rate limiting (used by express-rate-limit fallback)
function extractUserIdFromToken(req: express.Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return req.ip || 'unknown';
  }

  try {
    const token = authHeader.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      return req.ip || 'unknown';
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return payload.sub || req.ip || 'unknown';
  } catch {
    return req.ip || 'unknown';
  }
}

// Admin rate limiter - Redis-backed or express-rate-limit fallback
const adminLimiter = USE_REDIS_RATE_LIMIT
  ? createAdminRateLimiter()
  : rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 30,
      message: 'Too many admin requests, please try again later.',
      keyGenerator: extractUserIdFromToken,
    });

// Stripe webhook needs raw body for signature verification — mount BEFORE JSON parser
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookRouter);

// Body parsing
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

// Auth rate limiting (stricter for password reset to prevent abuse)
// Use Redis-backed rate limiter for distributed state
const authLimiterMiddleware = USE_REDIS_RATE_LIMIT
  ? authRateLimiter
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: 'Too many password reset attempts, please try again later.',
    });

// Routes
app.use('/api/health', healthRouter);
app.use('/api/stripe', adminLimiter, stripeApiRouter);
app.use('/api/auth', authLimiterMiddleware, passwordResetRouter);
app.use('/api/2fa', adminLimiter, twoFactorRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/email-preview', emailPreviewRouter); // Dev only - disabled in production
app.use('/api/backup', backupRouter);
app.use('/api/activations', adminLimiter, activationApiRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/site-settings', siteSettingsRouter);

// Serve local uploads (fallback when S3 is not configured)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/live-room', liveRoomRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize Redis and start server
async function startServer() {
  // Initialize Redis connection
  await initRedis();
  console.log(`[Cache] Redis available: ${isRedisAvailable()}`);

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
  });

  // Graceful shutdown handler
  async function gracefulShutdown(signal: string) {
    console.log(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      console.log('HTTP server closed');
      await closeRedis();
      process.exit(0);
    });
    // Force exit if server hasn't closed in 8 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 8000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch(console.error);
