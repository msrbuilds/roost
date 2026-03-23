import { useState } from 'react';
import { Check, X, HelpCircle } from 'lucide-react';
import type { RSVPStatus } from '../../types/database';

interface RSVPButtonProps {
    eventId: string;
    currentStatus: RSVPStatus | null;
    onRSVP: (status: RSVPStatus) => Promise<void>;
    attendeeCounts?: {
        going: number;
        maybe: number;
        not_going: number;
    };
    disabled?: boolean;
}

export default function RSVPButton({
    currentStatus,
    onRSVP,
    attendeeCounts,
    disabled = false,
}: RSVPButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleRSVP = async (status: RSVPStatus) => {
        if (loading || disabled) return;

        try {
            setLoading(true);
            await onRSVP(status);
        } catch (err) {
            console.error('RSVP error:', err);
        } finally {
            setLoading(false);
        }
    };

    const buttons = [
        {
            status: 'going' as RSVPStatus,
            icon: Check,
            label: 'Going',
            color: 'green',
            count: attendeeCounts?.going || 0,
        },
        {
            status: 'maybe' as RSVPStatus,
            icon: HelpCircle,
            label: 'Maybe',
            color: 'yellow',
            count: attendeeCounts?.maybe || 0,
        },
        {
            status: 'not_going' as RSVPStatus,
            icon: X,
            label: 'Can\'t Go',
            color: 'red',
            count: attendeeCounts?.not_going || 0,
        },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {buttons.map(({ status, icon: Icon, label, color, count }) => {
                const isActive = currentStatus === status;
                const colorClasses = {
                    green: isActive
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white dark:bg-surface-800 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20',
                    yellow: isActive
                        ? 'bg-yellow-600 text-white border-yellow-600'
                        : 'bg-white dark:bg-surface-800 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
                    red: isActive
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white dark:bg-surface-800 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20',
                };

                return (
                    <button
                        key={status}
                        onClick={() => handleRSVP(status)}
                        disabled={loading || disabled}
                        className={`
                            flex items-center gap-2 px-4 py-2 border-2 rounded-lg font-medium
                            transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                            ${colorClasses[color as keyof typeof colorClasses]}
                        `}
                    >
                        <Icon size={18} />
                        <span>{label}</span>
                        {count > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-black bg-opacity-10 dark:bg-white dark:bg-opacity-10 rounded-full text-xs font-semibold">
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
