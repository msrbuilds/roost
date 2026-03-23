"use strict";
/**
 * Redis-Backed Rate Limiting Middleware
 *
 * Provides distributed rate limiting using Redis for persistent state
 * across server restarts and multiple instances.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimiter = exports.webhookRateLimiter = exports.apiRateLimiter = void 0;
exports.createRedisRateLimiter = createRedisRateLimiter;
exports.createAdminRateLimiter = createAdminRateLimiter;
const redis_js_1 = require("../lib/redis.js");
const DEFAULT_OPTIONS = {
    message: 'Too many requests, please try again later.',
    keyGenerator: (req) => req.ip || 'unknown',
    skipFailedRequests: false,
    category: 'default',
};
/**
 * In-memory fallback store for when Redis is unavailable
 */
const memoryStore = new Map();
function cleanupMemoryStore() {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
        if (value.resetTime <= now) {
            memoryStore.delete(key);
        }
    }
}
// Clean up expired entries every minute
setInterval(cleanupMemoryStore, 60000);
/**
 * Memory-based rate limit check (fallback)
 */
function checkMemoryRateLimit(key, max, windowMs) {
    const now = Date.now();
    const existing = memoryStore.get(key);
    if (existing && existing.resetTime > now) {
        existing.count++;
        return {
            allowed: existing.count <= max,
            current: existing.count,
            resetTime: existing.resetTime,
        };
    }
    const resetTime = now + windowMs;
    memoryStore.set(key, { count: 1, resetTime });
    return {
        allowed: true,
        current: 1,
        resetTime,
    };
}
/**
 * Create a Redis-backed rate limiter middleware
 */
function createRedisRateLimiter(options) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const windowSeconds = Math.ceil(config.windowMs / 1000);
    return async (req, res, next) => {
        const identifier = config.keyGenerator(req);
        const key = `${redis_js_1.CACHE_KEYS.RATE_LIMIT}:${config.category}:${identifier}`;
        try {
            let current;
            let resetTime;
            let allowed;
            if ((0, redis_js_1.isRedisAvailable)()) {
                // Use Redis for distributed rate limiting
                current = await (0, redis_js_1.cacheIncrement)(key, windowSeconds);
                const ttl = await (0, redis_js_1.cacheTTL)(key);
                resetTime = Date.now() + (ttl > 0 ? ttl * 1000 : config.windowMs);
                allowed = current <= config.max;
            }
            else {
                // Fall back to memory store
                const result = checkMemoryRateLimit(key, config.max, config.windowMs);
                current = result.current;
                resetTime = result.resetTime;
                allowed = result.allowed;
            }
            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', config.max);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - current));
            res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
            if (!allowed) {
                res.setHeader('Retry-After', Math.ceil((resetTime - Date.now()) / 1000));
                return res.status(429).json({
                    error: config.message,
                    retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
                });
            }
            next();
        }
        catch (error) {
            // On error, allow the request but log the issue
            console.error('[RateLimit] Error checking rate limit:', error);
            next();
        }
    };
}
/**
 * Pre-configured rate limiters for different use cases
 */
// General API rate limiter (300 requests per 15 minutes)
exports.apiRateLimiter = createRedisRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: 'Too many requests from this IP, please try again later.',
    category: 'api',
});
// Webhook rate limiter (50 requests per minute)
exports.webhookRateLimiter = createRedisRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: 50,
    message: 'Too many webhook requests.',
    category: 'webhook',
});
// Admin rate limiter (30 requests per minute per user)
function createAdminRateLimiter() {
    return createRedisRateLimiter({
        windowMs: 1 * 60 * 1000,
        max: 30,
        message: 'Too many admin requests, please try again later.',
        category: 'admin',
        keyGenerator: extractUserIdFromToken,
    });
}
// Auth rate limiter (10 requests per 15 minutes)
exports.authRateLimiter = createRedisRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many authentication attempts, please try again later.',
    category: 'auth',
});
/**
 * Extract user ID from JWT token for user-based rate limiting
 */
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
//# sourceMappingURL=redis-rate-limit.js.map