import { useState, useEffect, useCallback } from 'react';
import { stripeAdminService, StripeStats, WebhookLog } from '@/services/subscription';
import {
    RefreshCw,
    Users,
    CreditCard,
    AlertCircle,
    CheckCircle,
    XCircle,
    Trash2,
    ExternalLink,
} from 'lucide-react';

// Helper to format event type for display
function formatEventType(eventType: string): { label: string; color: string } {
    const map: Record<string, { label: string; color: string }> = {
        'checkout.session.completed': { label: 'Checkout', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
        'customer.subscription.created': { label: 'New Sub', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
        'customer.subscription.updated': { label: 'Updated', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
        'customer.subscription.deleted': { label: 'Cancelled', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
        'invoice.payment_succeeded': { label: 'Payment OK', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
        'invoice.payment_failed': { label: 'Payment Failed', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
    };

    return map[eventType] || { label: eventType, color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400' };
}

// Webhook log item component
function WebhookLogItem({ webhook }: { webhook: WebhookLog }) {
    const { label, color } = formatEventType(webhook.event_type);

    return (
        <div
            className={`p-4 rounded-lg border ${
                webhook.processed
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
            }`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                    {webhook.processed ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                                {label}
                            </span>
                            {webhook.email && (
                                <span className="text-sm text-surface-600 dark:text-surface-400 truncate">
                                    {webhook.email}
                                </span>
                            )}
                        </div>
                        {webhook.error_message && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                                {webhook.error_message}
                            </p>
                        )}
                        {webhook.stripe_event_id && (
                            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 font-mono truncate">
                                {webhook.stripe_event_id}
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap">
                    {new Date(webhook.created_at).toLocaleString()}
                </div>
            </div>
        </div>
    );
}

export default function AdminSubscriptions() {
    const [stats, setStats] = useState<StripeStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isCleaningUp, setIsCleaningUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            setError(null);
            const data = await stripeAdminService.getStats();
            setStats(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch stats');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchStats();
    };

    const handleCleanup = async () => {
        if (!confirm('This will expire cancelled subscriptions past their period end and downgrade affected users. Continue?')) {
            return;
        }

        setIsCleaningUp(true);
        setCleanupMessage(null);
        try {
            const result = await stripeAdminService.runCleanup();
            setCleanupMessage(result.message);
            await fetchStats();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Cleanup failed');
        } finally {
            setIsCleaningUp(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Subscriptions</h1>
                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                        Manage Stripe subscription payments and view webhook activity
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href="https://dashboard.stripe.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-lg transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Stripe Dashboard
                    </a>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{stats.customers}</p>
                                <p className="text-xs text-surface-500 dark:text-surface-400">Customers</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{stats.subscriptions.active}</p>
                                <p className="text-xs text-surface-500 dark:text-surface-400">Active</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{stats.subscriptions.cancelled}</p>
                                <p className="text-xs text-surface-500 dark:text-surface-400">Cancelled</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{stats.webhooks.total}</p>
                                <p className="text-xs text-surface-500 dark:text-surface-400">Webhooks ({stats.webhooks.failed} failed)</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="card p-4">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">Actions</h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleCleanup}
                        disabled={isCleaningUp}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Trash2 className={`w-4 h-4 ${isCleaningUp ? 'animate-spin' : ''}`} />
                        {isCleaningUp ? 'Running...' : 'Cleanup Expired'}
                    </button>
                </div>
                {cleanupMessage && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2">{cleanupMessage}</p>
                )}
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">
                    Products and prices are managed in the{' '}
                    <a
                        href="https://dashboard.stripe.com/products"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-500 hover:text-primary-600 underline"
                    >
                        Stripe Dashboard
                    </a>.
                </p>
            </div>

            {/* Recent Webhooks */}
            {stats && stats.webhooks.recent.length > 0 && (
                <div className="card p-4">
                    <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">Recent Webhooks</h2>
                    <div className="space-y-3">
                        {stats.webhooks.recent.map((webhook) => (
                            <WebhookLogItem key={webhook.id} webhook={webhook} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
