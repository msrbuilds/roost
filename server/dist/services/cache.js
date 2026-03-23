"use strict";
/**
 * Cache Service
 *
 * High-level caching operations for specific data types.
 * Provides domain-specific cache management with proper key generation and invalidation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedSubscriptionStatus = getCachedSubscriptionStatus;
exports.invalidateSubscriptionStatus = invalidateSubscriptionStatus;
exports.invalidateAllSubscriptionStatuses = invalidateAllSubscriptionStatuses;
exports.getCachedDashboardStats = getCachedDashboardStats;
exports.invalidateDashboardStats = invalidateDashboardStats;
exports.getCachedActivationStats = getCachedActivationStats;
exports.invalidateActivationStats = invalidateActivationStats;
exports.getCachedUserProfile = getCachedUserProfile;
exports.invalidateUserProfile = invalidateUserProfile;
exports.getCacheStatus = getCacheStatus;
exports.invalidateStripeCaches = invalidateStripeCaches;
exports.invalidateWebhookRelatedCaches = invalidateWebhookRelatedCaches;
const redis_js_1 = require("../lib/redis.js");
// ============================================================================
// Subscription Status Cache
// ============================================================================
/**
 * Get subscription status from cache or fetch from database
 */
async function getCachedSubscriptionStatus(userId, fetcher) {
    const key = `${redis_js_1.CACHE_KEYS.SUBSCRIPTION_STATUS}:${userId}`;
    return (0, redis_js_1.cacheAside)(key, redis_js_1.CACHE_TTL.SUBSCRIPTION_STATUS, fetcher);
}
/**
 * Invalidate subscription status for a user
 */
async function invalidateSubscriptionStatus(userId) {
    const key = `${redis_js_1.CACHE_KEYS.SUBSCRIPTION_STATUS}:${userId}`;
    await (0, redis_js_1.cacheDelete)(key);
}
/**
 * Invalidate all subscription statuses (e.g., after bulk operations)
 */
async function invalidateAllSubscriptionStatuses() {
    await (0, redis_js_1.cacheDeletePattern)(`${redis_js_1.CACHE_KEYS.SUBSCRIPTION_STATUS}:*`);
}
// ============================================================================
// Dashboard Stats Cache
// ============================================================================
/**
 * Get dashboard stats from cache or fetch from database
 */
async function getCachedDashboardStats(fetcher) {
    return (0, redis_js_1.cacheAside)(redis_js_1.CACHE_KEYS.DASHBOARD_STATS, redis_js_1.CACHE_TTL.DASHBOARD_STATS, fetcher);
}
/**
 * Invalidate dashboard stats (called after webhook processing, subscription changes, etc.)
 */
async function invalidateDashboardStats() {
    await (0, redis_js_1.cacheDelete)(redis_js_1.CACHE_KEYS.DASHBOARD_STATS);
}
// ============================================================================
// Activation Stats Cache
// ============================================================================
/**
 * Get activation stats from cache or fetch from database
 */
async function getCachedActivationStats(fetcher) {
    return (0, redis_js_1.cacheAside)(redis_js_1.CACHE_KEYS.ACTIVATION_STATS, redis_js_1.CACHE_TTL.ACTIVATION_STATS, fetcher);
}
/**
 * Invalidate activation stats (called after status update)
 */
async function invalidateActivationStats() {
    await (0, redis_js_1.cacheDelete)(redis_js_1.CACHE_KEYS.ACTIVATION_STATS);
}
// ============================================================================
// User Profile Cache (for role checks)
// ============================================================================
/**
 * Get user profile from cache or fetch from database
 */
async function getCachedUserProfile(userId, fetcher) {
    const key = `${redis_js_1.CACHE_KEYS.USER_PROFILE}:${userId}`;
    return (0, redis_js_1.cacheAside)(key, redis_js_1.CACHE_TTL.USER_PROFILE, fetcher);
}
/**
 * Invalidate user profile cache
 */
async function invalidateUserProfile(userId) {
    const key = `${redis_js_1.CACHE_KEYS.USER_PROFILE}:${userId}`;
    await (0, redis_js_1.cacheDelete)(key);
}
// ============================================================================
// Cache Stats and Monitoring
// ============================================================================
/**
 * Get cache status info
 */
function getCacheStatus() {
    return {
        enabled: process.env.CACHE_ENABLED !== 'false',
        connected: (0, redis_js_1.isRedisAvailable)(),
    };
}
// ============================================================================
// Bulk Invalidation Helpers
// ============================================================================
/**
 * Invalidate all caches related to Stripe/subscription data
 * Called after major operations
 */
async function invalidateStripeCaches() {
    await Promise.all([
        invalidateDashboardStats(),
        invalidateAllSubscriptionStatuses(),
    ]);
}
/**
 * Invalidate caches after a webhook is processed
 */
async function invalidateWebhookRelatedCaches(userId) {
    const invalidations = [invalidateDashboardStats()];
    if (userId) {
        invalidations.push(invalidateSubscriptionStatus(userId));
    }
    await Promise.all(invalidations);
}
//# sourceMappingURL=cache.js.map