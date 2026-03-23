/**
 * Cache Service
 *
 * High-level caching operations for specific data types.
 * Provides domain-specific cache management with proper key generation and invalidation.
 */

import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheAside,
  CACHE_KEYS,
  CACHE_TTL,
  isRedisAvailable,
} from '../lib/redis.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SubscriptionStatus {
  hasSubscription: boolean;
  status: string | null;
  isActive: boolean;
  inGracePeriod?: boolean;
  currentPeriodEnd?: string;
  currentPeriodStart?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface DashboardStats {
  customers: number;
  subscriptions: {
    active: number;
    cancelled: number;
  };
  webhooks: {
    total: number;
    failed: number;
    recent: WebhookLogEntry[];
  };
}

export interface WebhookLogEntry {
  id: string;
  event_type: string;
  processed: boolean;
  created_at: string;
  error_message?: string;
  stripe_event_id?: string;
  ip_address?: string;
  email?: string;
}

export interface ActivationStats {
  total_products: number;
  total_requests: number;
  pending_requests: number;
  in_progress_requests: number;
  completed_this_month: number;
  rejected_this_month: number;
}

export interface UserProfile {
  id: string;
  role: string;
  is_banned?: boolean;
}

// ============================================================================
// Subscription Status Cache
// ============================================================================

/**
 * Get subscription status from cache or fetch from database
 */
export async function getCachedSubscriptionStatus(
  userId: string,
  fetcher: () => Promise<SubscriptionStatus>
): Promise<SubscriptionStatus> {
  const key = `${CACHE_KEYS.SUBSCRIPTION_STATUS}:${userId}`;
  return cacheAside(key, CACHE_TTL.SUBSCRIPTION_STATUS, fetcher);
}

/**
 * Invalidate subscription status for a user
 */
export async function invalidateSubscriptionStatus(userId: string): Promise<void> {
  const key = `${CACHE_KEYS.SUBSCRIPTION_STATUS}:${userId}`;
  await cacheDelete(key);
}

/**
 * Invalidate all subscription statuses (e.g., after bulk operations)
 */
export async function invalidateAllSubscriptionStatuses(): Promise<void> {
  await cacheDeletePattern(`${CACHE_KEYS.SUBSCRIPTION_STATUS}:*`);
}

// ============================================================================
// Dashboard Stats Cache
// ============================================================================

/**
 * Get dashboard stats from cache or fetch from database
 */
export async function getCachedDashboardStats(
  fetcher: () => Promise<DashboardStats>
): Promise<DashboardStats> {
  return cacheAside(CACHE_KEYS.DASHBOARD_STATS, CACHE_TTL.DASHBOARD_STATS, fetcher);
}

/**
 * Invalidate dashboard stats (called after webhook processing, subscription changes, etc.)
 */
export async function invalidateDashboardStats(): Promise<void> {
  await cacheDelete(CACHE_KEYS.DASHBOARD_STATS);
}

// ============================================================================
// Activation Stats Cache
// ============================================================================

/**
 * Get activation stats from cache or fetch from database
 */
export async function getCachedActivationStats(
  fetcher: () => Promise<ActivationStats>
): Promise<ActivationStats> {
  return cacheAside(CACHE_KEYS.ACTIVATION_STATS, CACHE_TTL.ACTIVATION_STATS, fetcher);
}

/**
 * Invalidate activation stats (called after status update)
 */
export async function invalidateActivationStats(): Promise<void> {
  await cacheDelete(CACHE_KEYS.ACTIVATION_STATS);
}

// ============================================================================
// User Profile Cache (for role checks)
// ============================================================================

/**
 * Get user profile from cache or fetch from database
 */
export async function getCachedUserProfile(
  userId: string,
  fetcher: () => Promise<UserProfile | null>
): Promise<UserProfile | null> {
  const key = `${CACHE_KEYS.USER_PROFILE}:${userId}`;
  return cacheAside(key, CACHE_TTL.USER_PROFILE, fetcher);
}

/**
 * Invalidate user profile cache
 */
export async function invalidateUserProfile(userId: string): Promise<void> {
  const key = `${CACHE_KEYS.USER_PROFILE}:${userId}`;
  await cacheDelete(key);
}

// ============================================================================
// Cache Stats and Monitoring
// ============================================================================

/**
 * Get cache status info
 */
export function getCacheStatus(): { enabled: boolean; connected: boolean } {
  return {
    enabled: process.env.CACHE_ENABLED !== 'false',
    connected: isRedisAvailable(),
  };
}

// ============================================================================
// Bulk Invalidation Helpers
// ============================================================================

/**
 * Invalidate all caches related to Stripe/subscription data
 * Called after major operations
 */
export async function invalidateStripeCaches(): Promise<void> {
  await Promise.all([
    invalidateDashboardStats(),
    invalidateAllSubscriptionStatuses(),
  ]);
}

/**
 * Invalidate caches after a webhook is processed
 */
export async function invalidateWebhookRelatedCaches(userId?: string): Promise<void> {
  const invalidations = [invalidateDashboardStats()];

  if (userId) {
    invalidations.push(invalidateSubscriptionStatus(userId));
  }

  await Promise.all(invalidations);
}
