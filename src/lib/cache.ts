/**
 * Lightweight in-memory cache for service layer data.
 * Prevents redundant API calls during SPA navigation.
 * TTL-based expiration with manual invalidation support.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

const store = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL = 120_000; // 2 minutes

/**
 * Get cached data if fresh, otherwise return null.
 */
export function cacheGet<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
        store.delete(key);
        return null;
    }
    return entry.data as T;
}

/**
 * Store data in cache with TTL.
 */
export function cacheSet<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    store.set(key, { data, timestamp: Date.now(), ttl });
}

/**
 * Invalidate cache entries matching a prefix.
 * e.g., cacheInvalidate('posts:') clears all post caches.
 */
export function cacheInvalidate(prefix: string): void {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
            store.delete(key);
        }
    }
}

/**
 * Wrap an async function with caching.
 * Returns cached data if fresh, otherwise calls fn and caches result.
 */
export async function cached<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = DEFAULT_TTL
): Promise<T> {
    const existing = cacheGet<T>(key);
    if (existing !== null) return existing;
    const result = await fn();
    cacheSet(key, result, ttl);
    return result;
}

/**
 * Stale-while-revalidate cache pattern.
 * Returns stale data immediately while refreshing in the background.
 * On first call (no cache), behaves like `cached()` — waits for the fetch.
 */
export async function cachedSWR<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = DEFAULT_TTL
): Promise<T> {
    const entry = store.get(key);

    if (entry) {
        const age = Date.now() - entry.timestamp;
        if (age <= ttl) {
            // Fresh — return as-is
            return entry.data as T;
        }
        // Stale — return immediately, revalidate in background
        fn().then(result => {
            cacheSet(key, result, ttl);
        }).catch(console.error);
        return entry.data as T;
    }

    // No cache — must wait for first fetch
    const result = await fn();
    cacheSet(key, result, ttl);
    return result;
}
