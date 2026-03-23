/**
 * Cache Service
 *
 * High-level caching operations for specific data types.
 * Provides domain-specific cache management with proper key generation and invalidation.
 */
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
/**
 * Get subscription status from cache or fetch from database
 */
export declare function getCachedSubscriptionStatus(userId: string, fetcher: () => Promise<SubscriptionStatus>): Promise<SubscriptionStatus>;
/**
 * Invalidate subscription status for a user
 */
export declare function invalidateSubscriptionStatus(userId: string): Promise<void>;
/**
 * Invalidate all subscription statuses (e.g., after bulk operations)
 */
export declare function invalidateAllSubscriptionStatuses(): Promise<void>;
/**
 * Get dashboard stats from cache or fetch from database
 */
export declare function getCachedDashboardStats(fetcher: () => Promise<DashboardStats>): Promise<DashboardStats>;
/**
 * Invalidate dashboard stats (called after webhook processing, subscription changes, etc.)
 */
export declare function invalidateDashboardStats(): Promise<void>;
/**
 * Get activation stats from cache or fetch from database
 */
export declare function getCachedActivationStats(fetcher: () => Promise<ActivationStats>): Promise<ActivationStats>;
/**
 * Invalidate activation stats (called after status update)
 */
export declare function invalidateActivationStats(): Promise<void>;
/**
 * Get user profile from cache or fetch from database
 */
export declare function getCachedUserProfile(userId: string, fetcher: () => Promise<UserProfile | null>): Promise<UserProfile | null>;
/**
 * Invalidate user profile cache
 */
export declare function invalidateUserProfile(userId: string): Promise<void>;
/**
 * Get cache status info
 */
export declare function getCacheStatus(): {
    enabled: boolean;
    connected: boolean;
};
/**
 * Invalidate all caches related to Stripe/subscription data
 * Called after major operations
 */
export declare function invalidateStripeCaches(): Promise<void>;
/**
 * Invalidate caches after a webhook is processed
 */
export declare function invalidateWebhookRelatedCaches(userId?: string): Promise<void>;
//# sourceMappingURL=cache.d.ts.map