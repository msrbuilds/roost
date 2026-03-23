import { useState, useEffect, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { Users } from 'lucide-react';
import { searchMembers, getMembersCount, getOnlineUsersCount } from '@/services/profile';
import { MemberFilters } from '@/components/members/MemberFilters';
import { MembersGrid } from '@/components/members/MembersGrid';
import type { Profile } from '@/types/database';

export function Members() {
    const [members, setMembers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [onlineCount, setOnlineCount] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);

    // Filters
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'online'>('all');
    // const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'moderator' | 'member'>('all'); // Placeholder logic
    const roleFilter = 'all'; // Fixed to 'all' for now until role system is ready
    const [sort, setSort] = useState<'newest' | 'alphabetical' | 'last_active'>('newest');

    const LIMIT = 20;

    // Infinite scroll trigger
    const { ref, inView } = useInView();

    // Fetch initial stats
    useEffect(() => {
        getMembersCount().then(setTotalCount);
        getOnlineUsersCount().then(setOnlineCount);
    }, []);

    const fetchMembers = useCallback(async (isLoadMore = false) => {
        try {
            const currentOffset = isLoadMore ? offset : 0;
            if (!isLoadMore) setLoading(true);
            else setLoadingMore(true);

            const newMembers = await searchMembers({
                query,
                status: statusFilter,
                role: roleFilter,
                sort,
                limit: LIMIT,
                offset: currentOffset,
            });

            if (isLoadMore) {
                setMembers(prev => [...prev, ...newMembers]);
            } else {
                setMembers(newMembers);
                setOffset(0); // Reset offset on new filter search
            }

            setHasMore(newMembers.length === LIMIT);
            setOffset(prev => prev + LIMIT);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [query, statusFilter, roleFilter, sort, offset]);

    // Initial fetch and on filter changes
    useEffect(() => {
        // Reset state for new fetch
        setOffset(0);
        fetchMembers(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, statusFilter, roleFilter, sort]);

    // Load more when scrolling to bottom
    useEffect(() => {
        if (inView && hasMore && !loading && !loadingMore) {
            fetchMembers(true);
        }
    }, [inView, hasMore, loading, loadingMore, fetchMembers]);

    return (
        <div className="container max-w-5xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
                        <Users className="w-6 h-6" />
                    </div>
                    <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50">Members Directory</h1>
                </div>
                <div className="flex gap-4 text-surface-500 dark:text-surface-400 text-sm">
                    <p>Total Members: <span className="font-medium text-surface-900 dark:text-surface-100">{totalCount}</span></p>
                    <p>•</p>
                    <p>Online Now: <span className="font-medium text-green-500">{onlineCount}</span></p>
                </div>
            </div>

            {/* Filters */}
            <MemberFilters
                searchQuery={query}
                onSearchChange={setQuery}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                sortBy={sort}
                onSortChange={setSort}
            />

            {/* Grid */}
            <MembersGrid members={members} loading={loading} />

            {/* Infinite Scroll Loader */}
            {hasMore && !loading && (
                <div ref={ref} className="py-8 flex justify-center">
                    {loadingMore && (
                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    )}
                </div>
            )}
        </div>
    );
}

export default Members;
