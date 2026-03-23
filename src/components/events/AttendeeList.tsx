import { useEffect, useState } from 'react';
import { Users, User } from 'lucide-react';
import { getEventAttendees } from '../../services';
import type { RSVPStatus } from '../../types/database';

interface AttendeeListProps {
    eventId: string;
    filterStatus?: RSVPStatus | 'all';
}

interface Attendee {
    id: string;
    user_id: string;
    event_id: string;
    status: RSVPStatus;
    created_at: string;
    user?: {
        id: string;
        username: string;
        display_name: string;
        avatar_url?: string | null;
        is_online?: boolean;
    };
}

export default function AttendeeList({ eventId, filterStatus = 'all' }: AttendeeListProps) {
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<typeof filterStatus>(filterStatus);

    useEffect(() => {
        loadAttendees();
    }, [eventId]);

    const loadAttendees = async () => {
        try {
            setLoading(true);
            const data = await getEventAttendees(eventId);
            setAttendees(data as Attendee[]);
        } catch (err) {
            console.error('Error loading attendees:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredAttendees = activeFilter === 'all'
        ? attendees
        : attendees.filter(a => a.status === activeFilter);

    const statusCounts = {
        all: attendees.length,
        going: attendees.filter(a => a.status === 'going').length,
        maybe: attendees.filter(a => a.status === 'maybe').length,
        not_going: attendees.filter(a => a.status === 'not_going').length,
    };

    if (loading) {
        return (
            <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-surface-700 rounded-full" />
                        <div className="flex-1">
                            <div className="h-4 bg-gray-200 dark:bg-surface-700 rounded w-32 mb-1" />
                            <div className="h-3 bg-gray-200 dark:bg-surface-700 rounded w-24" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div>
            {/* Filter tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {[
                    { key: 'all', label: 'All', count: statusCounts.all },
                    { key: 'going', label: 'Going', count: statusCounts.going },
                    { key: 'maybe', label: 'Maybe', count: statusCounts.maybe },
                    { key: 'not_going', label: 'Can\'t Go', count: statusCounts.not_going },
                ].map(({ key, label, count }) => (
                    <button
                        key={key}
                        onClick={() => setActiveFilter(key as typeof activeFilter)}
                        className={`
                            px-4 py-2 rounded-lg text-sm font-medium transition-colors
                            ${activeFilter === key
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 dark:bg-surface-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-700'
                            }
                        `}
                    >
                        {label} ({count})
                    </button>
                ))}
            </div>

            {/* Attendee list */}
            {filteredAttendees.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Users size={48} className="mx-auto mb-2 opacity-20" />
                    <p>No attendees in this category yet</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredAttendees.map((attendee) => (
                        <div
                            key={attendee.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-surface-800 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
                        >
                            {/* Avatar */}
                            {attendee.user?.avatar_url ? (
                                <img
                                    src={attendee.user.avatar_url}
                                    alt={attendee.user.display_name}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                                    <User size={20} className="text-white" />
                                </div>
                            )}

                            {/* User info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {attendee.user?.display_name || 'Unknown User'}
                                    </p>
                                    {attendee.user?.is_online && (
                                        <div className="w-2 h-2 bg-green-500 rounded-full" title="Online" />
                                    )}
                                </div>
                                {attendee.user?.username && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        @{attendee.user.username}
                                    </p>
                                )}
                            </div>

                            {/* Status badge */}
                            <div className={`
                                px-2 py-1 rounded-full text-xs font-semibold
                                ${attendee.status === 'going' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : ''}
                                ${attendee.status === 'maybe' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : ''}
                                ${attendee.status === 'not_going' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : ''}
                            `}>
                                {attendee.status === 'going' && 'Going'}
                                {attendee.status === 'maybe' && 'Maybe'}
                                {attendee.status === 'not_going' && 'Can\'t Go'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
