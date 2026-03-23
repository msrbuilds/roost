import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { searchMembers } from '@/services/profile';
import type { Profile } from '@/types/database';

export function CommunityMembersWidget() {
    const [activeTab, setActiveTab] = useState<'active' | 'newest'>('active');
    const [members, setMembers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMembers = async () => {
            setLoading(true);
            try {
                await searchMembers({
                    sort: activeTab === 'active' ? 'last_active' : 'newest',
                    limit: 5,
                    status: activeTab === 'active' ? 'online' : 'all' // Optimization: for "Active", maybe prioritize online or just sort by last_seen
                });

                // If "active" tab and no online users, maybe fallback to just last_active sorted?
                // For now, let's just stick to the requested logic.
                // Re-reading request: "Active" usually means recently active.
                // My searchMembers has `sort='last_active'`.
                // Let's use that.

                // Actually, for "Active" tab, let's fetch sorted by 'last_active'. 
                // For 'Newest', sort by 'newest'.

                // Let's refine the call based on tab
                const sortType = activeTab === 'active' ? 'last_active' : 'newest';

                // Make the call
                const results = await searchMembers({
                    sort: sortType,
                    limit: 5
                });

                setMembers(results);
            } catch (error) {
                console.error('Error fetching widget members:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMembers();
    }, [activeTab]);

    return (
        <div className="card bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden shadow-none">
            <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
                <h3 className="font-semibold text-surface-900 dark:text-surface-100">Community Members</h3>
                <Link to="/members" className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
                    View All
                </Link>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-surface-200 dark:border-surface-700">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'active'
                        ? 'text-primary-600 dark:text-primary-400 bg-surface-100 dark:bg-surface-800'
                        : 'text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800/50'
                        }`}
                >
                    Active
                </button>
                <button
                    onClick={() => setActiveTab('newest')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'newest'
                        ? 'text-primary-600 dark:text-primary-400 bg-surface-100 dark:bg-surface-800'
                        : 'text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800/50'
                        }`}
                >
                    Newest
                </button>
            </div>

            {/* List */}
            <div className="p-4 space-y-4">
                {loading ? (
                    // Skeleton
                    [...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                            <div className="w-10 h-10 rounded-full bg-surface-200 dark:bg-surface-700" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-20 bg-surface-200 dark:bg-surface-700 rounded" />
                                <div className="h-3 w-12 bg-surface-200 dark:bg-surface-700 rounded" />
                            </div>
                        </div>
                    ))
                ) : (
                    members.map((member) => (
                        <Link
                            key={member.id}
                            to={`/profile/${member.username}`}
                            className="flex items-center gap-3 group"
                        >
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-100 dark:bg-surface-800 ring-1 ring-surface-200 dark:ring-surface-700 group-hover:ring-primary-500/50 dark:group-hover:ring-primary-400/50 transition-all">
                                    {member.avatar_url ? (
                                        <img
                                            src={member.avatar_url}
                                            alt={member.display_name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-sm font-bold text-surface-500 dark:text-surface-400">
                                            {(member.display_name || member.username || '?')[0].toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                {member.is_online && (
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-surface-900 rounded-full" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                    {member.display_name || member.username}
                                </p>
                                <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                                    @{member.username}
                                </p>
                            </div>
                        </Link>
                    ))
                )}

                {!loading && members.length === 0 && (
                    <div className="text-center py-4 text-surface-500 dark:text-surface-400 text-sm">
                        No members found.
                    </div>
                )}
            </div>
        </div>
    );
}
