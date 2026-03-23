import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Ban, LogOut, Clock, AlertCircle } from 'lucide-react';

export default function Banned() {
    const { isAuthenticated, isBanned, banInfo, signOut, isLoading } = useAuth();
    const navigate = useNavigate();

    // Redirect if not authenticated or not banned
    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                navigate('/login', { replace: true });
            } else if (!isBanned) {
                navigate('/', { replace: true });
            }
        }
    }, [isAuthenticated, isBanned, isLoading, navigate]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };

    // Format expiration date
    const formatExpirationDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            dateStyle: 'full',
            timeStyle: 'short',
        }).format(date);
    };

    // Calculate time remaining
    const getTimeRemaining = (expiresAt: Date) => {
        const now = new Date();
        const diff = expiresAt.getTime() - now.getTime();

        if (diff <= 0) return 'Expired';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''}`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}, ${minutes} minute${minutes > 1 ? 's' : ''}`;
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
                <p className="text-surface-500 dark:text-surface-400">Loading...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 px-4">
            <div className="max-w-md w-full">
                <div className="bg-white dark:bg-surface-900 rounded-xl shadow-lg dark:shadow-none border border-surface-200 dark:border-surface-700 overflow-hidden">
                    {/* Header */}
                    <div className="bg-red-500 px-6 py-8 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
                            <Ban className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Account Suspended</h1>
                        <p className="text-red-100 mt-2">Your access to the community has been restricted</p>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Reason */}
                        {banInfo?.reason && (
                            <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-surface-400 dark:text-surface-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Reason</p>
                                        <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{banInfo.reason}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Duration */}
                        <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <Clock className="w-5 h-5 text-surface-400 dark:text-surface-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Duration</p>
                                    {banInfo?.isPermanent ? (
                                        <p className="text-sm text-red-600 dark:text-red-400 mt-1 font-medium">
                                            This suspension is permanent
                                        </p>
                                    ) : banInfo?.expiresAt ? (
                                        <div className="mt-1 space-y-1">
                                            <p className="text-sm text-surface-600 dark:text-surface-400">
                                                Expires: {formatExpirationDate(banInfo.expiresAt)}
                                            </p>
                                            <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                                                Time remaining: {getTimeRemaining(banInfo.expiresAt)}
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {/* Help text */}
                        <p className="text-sm text-surface-500 dark:text-surface-400 text-center">
                            If you believe this was a mistake, please contact support for assistance.
                        </p>

                        {/* Sign out button */}
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-lg font-medium transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
