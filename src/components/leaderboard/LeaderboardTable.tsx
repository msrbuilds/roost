import { useEffect, useState, useRef } from 'react';
import { Trophy } from 'lucide-react';
import { getGlobalLeaderboard, getGroupLeaderboard, subscribeToLeaderboardChanges } from '../../services';
import { useAuth } from '../../contexts/AuthContext';
import type { LeaderboardRank } from '../../types';
import UserRankBadge from './UserRankBadge';
import { ProBadge } from '../common/ProBadge';

interface LeaderboardTableProps {
    groupId?: string;
    period: 7 | 30 | 365;
}

export default function LeaderboardTable({ groupId, period }: LeaderboardTableProps) {
    const { user } = useAuth();
    const [leaderboard, setLeaderboard] = useState<LeaderboardRank[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const observerTarget = useRef<HTMLDivElement>(null);

    const ITEMS_PER_PAGE = 50;

    useEffect(() => {
        // Reset state when groupId or period changes
        setLeaderboard([]);
        setOffset(0);
        setHasMore(true);
        loadLeaderboard(true, 0);

        // Subscribe to real-time updates
        const channel = subscribeToLeaderboardChanges(groupId || null, () => {
            // On real-time update, reload from beginning
            setLeaderboard([]);
            setOffset(0);
            setHasMore(true);
            loadLeaderboard(false, 0);
        });

        return () => {
            channel.unsubscribe();
        };
    }, [groupId, period]);

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loadingMore, loading]);

    const loadLeaderboard = async (showLoading = true, currentOffset = offset) => {
        try {
            if (showLoading) setLoading(true);

            const result = groupId
                ? await getGroupLeaderboard(groupId, period, ITEMS_PER_PAGE, currentOffset)
                : await getGlobalLeaderboard(period, ITEMS_PER_PAGE, currentOffset);

            if (currentOffset === 0) {
                setLeaderboard(result.entries);
            } else {
                setLeaderboard(prev => [...prev, ...result.entries]);
            }
            setHasMore(result.hasMore);
        } catch (err) {
            console.error('Error loading leaderboard:', err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const loadMore = async () => {
        if (!hasMore || loadingMore) return;

        try {
            setLoadingMore(true);
            const newOffset = offset + ITEMS_PER_PAGE;
            setOffset(newOffset);

            const result = groupId
                ? await getGroupLeaderboard(groupId, period, ITEMS_PER_PAGE, newOffset)
                : await getGlobalLeaderboard(period, ITEMS_PER_PAGE, newOffset);

            setLeaderboard(prev => [...prev, ...result.entries]);
            setHasMore(result.hasMore);
        } catch (err) {
            console.error('Error loading more:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    // Get medal icon for top 3
    const getMedalElement = (rank: number) => {
        if (rank === 1) return <span className="text-2xl">🥇</span>;
        if (rank === 2) return <span className="text-2xl">🥈</span>;
        if (rank === 3) return <span className="text-2xl">🥉</span>;
        return null;
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-surface-900 rounded-lg border border-gray-200 dark:border-surface-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-surface-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                                    Rank
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                                    Points
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-surface-700">
                            {[...Array(10)].map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-6 py-4">
                                        <div className="w-8 h-8 bg-gray-200 dark:bg-surface-700 rounded-full" />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-200 dark:bg-surface-700 rounded-full" />
                                            <div className="flex-1">
                                                <div className="h-4 bg-gray-200 dark:bg-surface-700 rounded w-32 mb-2" />
                                                <div className="h-3 bg-gray-200 dark:bg-surface-700 rounded w-24" />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="h-5 bg-gray-200 dark:bg-surface-700 rounded w-16 ml-auto" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    if (leaderboard.length === 0) {
        return (
            <div className="bg-white dark:bg-surface-900 rounded-lg border border-gray-200 dark:border-surface-700 p-12 text-center">
                <Trophy size={64} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Data Yet</h3>
                <p className="text-gray-500 dark:text-gray-400">
                    The leaderboard will populate once users start earning points!
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-surface-900 rounded-lg border border-gray-200 dark:border-surface-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-gray-200 dark:border-surface-700">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">
                                Rank
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                User
                            </th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-32">
                                Points
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-surface-800">
                        {leaderboard.map((entry) => {
                            const isCurrentUser = entry.user_id === user?.id;

                            return (
                                <tr
                                    key={entry.id}
                                    className={`
                                        group hover:bg-gray-50 dark:hover:bg-surface-800 transition-colors
                                        ${isCurrentUser ? 'bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30' : ''}
                                    `}
                                >
                                    {/* Rank */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center">
                                            {entry.rank <= 3 ? (
                                                getMedalElement(entry.rank)
                                            ) : (
                                                <UserRankBadge rank={entry.rank} size="sm" />
                                            )}
                                        </div>
                                    </td>

                                    {/* User */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {/* Avatar */}
                                            {entry.user?.avatar_url ? (
                                                <img
                                                    src={entry.user.avatar_url}
                                                    alt={entry.user.display_name}
                                                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-surface-800"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold ring-2 ring-white dark:ring-surface-800">
                                                    {entry.user?.display_name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                            )}

                                            {/* Name and location */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                        {entry.user?.display_name || 'Unknown'}
                                                    </p>
                                                    {entry.user?.membership_type === 'premium' && <ProBadge size="xs" />}
                                                    {isCurrentUser && (
                                                        <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-medium rounded">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                {entry.user?.username && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        @{entry.user.username}
                                                    </p>
                                                )}
                                                {entry.user?.location && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                                        {entry.user.location}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Points */}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                                {(entry.total_points || 0).toLocaleString()}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">points</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Infinite scroll trigger */}
            {hasMore && (
                <div ref={observerTarget} className="py-4 text-center">
                    {loadingMore ? (
                        <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                            <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Loading more...</span>
                        </div>
                    ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">Scroll for more</span>
                    )}
                </div>
            )}
        </div>
    );
}
