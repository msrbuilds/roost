"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = require("express-rate-limit");
const stripe_webhook_js_1 = require("./routes/stripe-webhook.js");
const stripe_api_js_1 = require("./routes/stripe-api.js");
const health_js_1 = require("./routes/health.js");
const password_reset_js_1 = __importDefault(require("./routes/password-reset.js"));
const email_preview_js_1 = __importDefault(require("./routes/email-preview.js"));
const two_factor_js_1 = __importDefault(require("./routes/two-factor.js"));
const notifications_js_1 = require("./routes/notifications.js");
const backup_js_1 = require("./routes/backup.js");
const activation_api_js_1 = require("./routes/activation-api.js");
const upload_js_1 = require("./routes/upload.js");
const live_room_js_1 = require("./routes/live-room.js");
const redis_js_1 = require("./lib/redis.js");
const redis_rate_limit_js_1 = require("./middleware/redis-rate-limit.js");
const app = (0, express_1.default)();
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
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Security middleware (after CORS to not block preflight)
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// Rate limiting - use Redis-backed rate limiters for distributed state persistence
// Falls back to in-memory if Redis is unavailable
const USE_REDIS_RATE_LIMIT = process.env.REDIS_RATE_LIMIT !== 'false';
if (USE_REDIS_RATE_LIMIT) {
    console.log('[RateLimit] Using Redis-backed rate limiting');
    app.use('/api/', redis_rate_limit_js_1.apiRateLimiter);
    app.use('/api/webhooks/', redis_rate_limit_js_1.webhookRateLimiter);
}
else {
    // Fallback to express-rate-limit (in-memory)
    console.log('[RateLimit] Using in-memory rate limiting');
    const limiter = (0, express_rate_limit_1.rateLimit)({
        windowMs: 15 * 60 * 1000,
        max: 300,
        message: 'Too many requests from this IP, please try again later.',
    });
    app.use('/api/', limiter);
    const webhookLimiter = (0, express_rate_limit_1.rateLimit)({
        windowMs: 1 * 60 * 1000,
        max: 50,
        message: 'Too many webhook requests.',
    });
    app.use('/api/webhooks/', webhookLimiter);
}
// Extract user ID from JWT token for user-based rate limiting (used by express-rate-limit fallback)
function extractUserIdFromToken(req) {
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
    }
    catch {
        return req.ip || 'unknown';
    }
}
// Admin rate limiter - Redis-backed or express-rate-limit fallback
const adminLimiter = USE_REDIS_RATE_LIMIT
    ? (0, redis_rate_limit_js_1.createAdminRateLimiter)()
    : (0, express_rate_limit_1.rateLimit)({
        windowMs: 1 * 60 * 1000,
        max: 30,
        message: 'Too many admin requests, please try again later.',
        keyGenerator: extractUserIdFromToken,
    });
// Stripe webhook needs raw body for signature verification — mount BEFORE JSON parser
app.use('/api/webhooks/stripe', express_1.default.raw({ type: 'application/json' }), stripe_webhook_js_1.stripeWebhookRouter);
// Body parsing
app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
app.use(express_1.default.json({ limit: '1mb' }));
// Auth rate limiting (stricter for password reset to prevent abuse)
// Use Redis-backed rate limiter for distributed state
const authLimiterMiddleware = USE_REDIS_RATE_LIMIT
    ? redis_rate_limit_js_1.authRateLimiter
    : (0, express_rate_limit_1.rateLimit)({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: 'Too many password reset attempts, please try again later.',
    });
// Routes
app.use('/api/health', health_js_1.healthRouter);
app.use('/api/stripe', adminLimiter, stripe_api_js_1.stripeApiRouter);
app.use('/api/auth', authLimiterMiddleware, password_reset_js_1.default);
app.use('/api/2fa', adminLimiter, two_factor_js_1.default);
app.use('/api/notifications', notifications_js_1.notificationsRouter);
app.use('/api/email-preview', email_preview_js_1.default); // Dev only - disabled in production
app.use('/api/backup', backup_js_1.backupRouter);
app.use('/api/activations', adminLimiter, activation_api_js_1.activationApiRouter);
app.use('/api/upload', upload_js_1.uploadRouter);
app.use('/api/live-room', live_room_js_1.liveRoomRouter);
// Error handling middleware
app.use((err, req, res, _next) => {
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
    await (0, redis_js_1.initRedis)();
    console.log(`[Cache] Redis available: ${(0, redis_js_1.isRedisAvailable)()}`);
    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
    });
    // Graceful shutdown handler
    async function gracefulShutdown(signal) {
        console.log(`${signal} received, shutting down gracefully...`);
        server.close(async () => {
            console.log('HTTP server closed');
            await (0, redis_js_1.closeRedis)();
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
//# sourceMappingURL=index.js.map