"use strict";
/**
 * Redis Client Configuration
 *
 * Provides a centralized Redis client with connection pooling,
 * automatic reconnection, and graceful fallback handling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_KEYS = exports.CACHE_TTL = void 0;
exports.initRedis = initRedis;
exports.getRedisClient = getRedisClient;
exports.isRedisAvailable = isRedisAvailable;
exports.closeRedis = closeRedis;
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheDelete = cacheDelete;
exports.cacheDeletePattern = cacheDeletePattern;
exports.cacheAside = cacheAside;
exports.cacheIncrement = cacheIncrement;
exports.cacheTTL = cacheTTL;
exports.cacheGetMany = cacheGetMany;
exports.redisHealthCheck = redisHealthCheck;
const redis_1 = require("redis");
// Redis connection configuration
// Support both URL format and separate credentials
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_USERNAME = process.env.REDIS_USERNAME || 'default';
const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false';
// Cache TTL defaults (in seconds)
exports.CACHE_TTL = {
    SUBSCRIPTION_STATUS: 900, // 15 minutes
    DASHBOARD_STATS: 300, // 5 minutes
    ACTIVATION_STATS: 600, // 10 minutes
    USER_PROFILE: 1800, // 30 minutes
    RATE_LIMIT: 60, // 1 minute (for rate limit windows)
};
// Cache key prefixes for organization
exports.CACHE_KEYS = {
    SUBSCRIPTION_STATUS: 'stripe:subscription:status',
    DASHBOARD_STATS: 'stripe:stats:dashboard',
    ACTIVATION_STATS: 'activation:stats',
    USER_PROFILE: 'user:profile',
    RATE_LIMIT: 'ratelimit',
};
let redisClient = null;
let isConnected = false;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
/**
 * Initialize Redis connection
 */
async function initRedis() {
    if (!CACHE_ENABLED) {
        console.log('[Redis] Caching disabled via CACHE_ENABLED=false');
        return;
    }
    if (redisClient && isConnected) {
        return;
    }
    try {
        // Build connection options
        // If REDIS_PASSWORD is set separately, use it to override URL credentials
        const clientOptions = {
            url: REDIS_URL,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > MAX_RECONNECT_ATTEMPTS) {
                        console.error(`[Redis] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
                        return new Error('Max reconnection attempts reached');
                    }
                    // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
                    const delay = Math.min(100 * Math.pow(2, retries), 3000);
                    console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${retries + 1}/${MAX_RECONNECT_ATTEMPTS})`);
                    return delay;
                },
                connectTimeout: 10000,
            },
        };
        // If separate password is provided, use explicit credentials
        // This helps when URL parsing has issues with special characters
        if (REDIS_PASSWORD) {
            clientOptions.username = REDIS_USERNAME;
            clientOptions.password = REDIS_PASSWORD;
            console.log(`[Redis] Using explicit credentials (username: ${REDIS_USERNAME})`);
        }
        const client = (0, redis_1.createClient)(clientOptions);
        client.on('connect', () => {
            console.log('[Redis] Connecting...');
        });
        client.on('ready', () => {
            isConnected = true;
            connectionAttempts = 0;
            console.log('[Redis] Connected and ready');
        });
        client.on('error', (err) => {
            console.error('[Redis] Error:', err.message);
            connectionAttempts++;
        });
        client.on('end', () => {
            isConnected = false;
            console.log('[Redis] Connection closed');
        });
        await client.connect();
        redisClient = client;
    }
    catch (error) {
        console.error('[Redis] Failed to initialize:', error);
        redisClient = null;
        isConnected = false;
    }
}
/**
 * Get Redis client (returns null if not connected)
 */
function getRedisClient() {
    if (!CACHE_ENABLED || !redisClient || !isConnected) {
        return null;
    }
    return redisClient;
}
/**
 * Check if Redis is available
 */
function isRedisAvailable() {
    return CACHE_ENABLED && isConnected && redisClient !== null;
}
/**
 * Gracefully close Redis connection
 */
async function closeRedis() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        isConnected = false;
        console.log('[Redis] Connection gracefully closed');
    }
}
/**
 * Get a cached value
 */
async function cacheGet(key) {
    const client = getRedisClient();
    if (!client)
        return null;
    try {
        const value = await client.get(key);
        if (value) {
            return JSON.parse(value);
        }
        return null;
    }
    catch (error) {
        console.error(`[Redis] Error getting key ${key}:`, error);
        return null;
    }
}
/**
 * Set a cached value with TTL
 */
async function cacheSet(key, value, ttlSeconds) {
    const client = getRedisClient();
    if (!client)
        return false;
    try {
        await client.setEx(key, ttlSeconds, JSON.stringify(value));
        return true;
    }
    catch (error) {
        console.error(`[Redis] Error setting key ${key}:`, error);
        return false;
    }
}
/**
 * Delete a cached value
 */
async function cacheDelete(key) {
    const client = getRedisClient();
    if (!client)
        return false;
    try {
        await client.del(key);
        return true;
    }
    catch (error) {
        console.error(`[Redis] Error deleting key ${key}:`, error);
        return false;
    }
}
/**
 * Delete all keys matching a pattern
 */
async function cacheDeletePattern(pattern) {
    const client = getRedisClient();
    if (!client)
        return 0;
    try {
        let deleted = 0;
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
            deleted = await client.del(keys);
        }
        return deleted;
    }
    catch (error) {
        console.error(`[Redis] Error deleting pattern ${pattern}:`, error);
        return 0;
    }
}
/**
 * Cache-aside pattern helper
 * Tries to get from cache, falls back to fetcher function, then caches result
 */
async function cacheAside(key, ttlSeconds, fetcher) {
    // Try cache first
    const cached = await cacheGet(key);
    if (cached !== null) {
        return cached;
    }
    // Fetch fresh data
    const data = await fetcher();
    // Cache the result (don't await to avoid blocking)
    cacheSet(key, data, ttlSeconds).catch(() => {
        // Silently ignore cache write failures
    });
    return data;
}
/**
 * Increment a counter (for rate limiting)
 */
async function cacheIncrement(key, ttlSeconds) {
    const client = getRedisClient();
    if (!client)
        return 0;
    try {
        const count = await client.incr(key);
        if (ttlSeconds && count === 1) {
            // Set TTL only on first increment
            await client.expire(key, ttlSeconds);
        }
        return count;
    }
    catch (error) {
        console.error(`[Redis] Error incrementing key ${key}:`, error);
        return 0;
    }
}
/**
 * Get TTL of a key
 */
async function cacheTTL(key) {
    const client = getRedisClient();
    if (!client)
        return -1;
    try {
        return await client.ttl(key);
    }
    catch (error) {
        console.error(`[Redis] Error getting TTL for key ${key}:`, error);
        return -1;
    }
}
/**
 * Get multiple values at once
 */
async function cacheGetMany(keys) {
    const client = getRedisClient();
    if (!client || keys.length === 0)
        return keys.map(() => null);
    try {
        const values = await client.mGet(keys);
        return values.map(v => v ? JSON.parse(v) : null);
    }
    catch (error) {
        console.error('[Redis] Error getting multiple keys:', error);
        return keys.map(() => null);
    }
}
/**
 * Health check for Redis
 */
async function redisHealthCheck() {
    const client = getRedisClient();
    if (!client) {
        return { status: 'unhealthy' };
    }
    try {
        const start = Date.now();
        await client.ping();
        const latencyMs = Date.now() - start;
        return { status: 'healthy', latencyMs };
    }
    catch {
        return { status: 'unhealthy' };
    }
}
//# sourceMappingURL=redis.js.map