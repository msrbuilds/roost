/**
 * Redis Client Configuration
 *
 * Provides a centralized Redis client with connection pooling,
 * automatic reconnection, and graceful fallback handling.
 */
import { createClient } from 'redis';
export declare const CACHE_TTL: {
    SUBSCRIPTION_STATUS: number;
    DASHBOARD_STATS: number;
    ACTIVATION_STATS: number;
    USER_PROFILE: number;
    RATE_LIMIT: number;
};
export declare const CACHE_KEYS: {
    SUBSCRIPTION_STATUS: string;
    DASHBOARD_STATS: string;
    ACTIVATION_STATS: string;
    USER_PROFILE: string;
    RATE_LIMIT: string;
};
type RedisClient = ReturnType<typeof createClient>;
/**
 * Initialize Redis connection
 */
export declare function initRedis(): Promise<void>;
/**
 * Get Redis client (returns null if not connected)
 */
export declare function getRedisClient(): RedisClient | null;
/**
 * Check if Redis is available
 */
export declare function isRedisAvailable(): boolean;
/**
 * Gracefully close Redis connection
 */
export declare function closeRedis(): Promise<void>;
/**
 * Get a cached value
 */
export declare function cacheGet<T>(key: string): Promise<T | null>;
/**
 * Set a cached value with TTL
 */
export declare function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<boolean>;
/**
 * Delete a cached value
 */
export declare function cacheDelete(key: string): Promise<boolean>;
/**
 * Delete all keys matching a pattern
 */
export declare function cacheDeletePattern(pattern: string): Promise<number>;
/**
 * Cache-aside pattern helper
 * Tries to get from cache, falls back to fetcher function, then caches result
 */
export declare function cacheAside<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T>;
/**
 * Increment a counter (for rate limiting)
 */
export declare function cacheIncrement(key: string, ttlSeconds?: number): Promise<number>;
/**
 * Get TTL of a key
 */
export declare function cacheTTL(key: string): Promise<number>;
/**
 * Get multiple values at once
 */
export declare function cacheGetMany<T>(keys: string[]): Promise<(T | null)[]>;
/**
 * Health check for Redis
 */
export declare function redisHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latencyMs?: number;
}>;
export {};
//# sourceMappingURL=redis.d.ts.map