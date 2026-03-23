import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { BAN_DURATIONS, banUser } from '../../services';
import type { Profile } from '../../types/database';

interface BanUserModalProps {
    user: Profile;
    adminUserId: string;
    onClose: () => void;
    onBanned: () => void;
}

export default function BanUserModal({
    user,
    adminUserId,
    onClose,
    onBanned,
}: BanUserModalProps) {
    const [reason, setReason] = useState('');
    const [duration, setDuration] = useState<string | null>('1 day');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleBan = async () => {
        setLoading(true);
        setError(null);

        try {
            await banUser(user.id, adminUserId, reason || undefined, duration);
            onBanned();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to ban user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 dark:bg-black/70"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-surface-900 rounded-xl shadow-xl max-w-md w-full p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Ban User</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* User info */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-surface-800 rounded-lg mb-6">
                    <img
                        src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}`}
                        alt={user.display_name}
                        className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{user.display_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                    </div>
                </div>

                {/* Form */}
                <div className="space-y-4">
                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Ban Duration
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {BAN_DURATIONS.map(({ label, value }) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => setDuration(value)}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${duration === value
                                            ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                                            : 'bg-white dark:bg-surface-800 border-gray-200 dark:border-surface-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Reason (optional)
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Provide a reason for the ban..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Warning */}
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 text-sm rounded-lg">
                        <strong>Warning:</strong> This will prevent the user from accessing the platform
                        {duration ? ` for ${BAN_DURATIONS.find(d => d.value === duration)?.label.toLowerCase()}` : ' permanently'}.
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-surface-800 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-surface-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleBan}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 text-white bg-red-600 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Banning...' : 'Ban User'}
                    </button>
                </div>
            </div>
        </div>
    );
}
