import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getGroups, getUserGroups, joinGroup, leaveGroup } from '@/services/group';
import type { GroupWithDetails } from '@/services/group';
import { GroupCard, CreateGroupModal } from '@/components/groups';

const GROUPS_PER_PAGE = 12;

export default function Groups() {
    const { user, isPlatformAdmin, isPremium } = useAuth();
    const [allGroups, setAllGroups] = useState<GroupWithDetails[]>([]);
    const [myGroups, setMyGroups] = useState<GroupWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'discover' | 'my-groups'>('discover');
    const observerTarget = useRef<HTMLDivElement>(null);

    const fetchGroups = useCallback(async (reset = false) => {
        if (!user) return;

        const currentOffset = reset ? 0 : offset;

        try {
            if (reset) {
                setIsLoading(true);
                setOffset(0);
            }

            const [{ groups, hasMore: more }, userGroups] = await Promise.all([
                getGroups({
                    userId: user.id,
                    search: searchQuery || undefined,
                    limit: GROUPS_PER_PAGE,
                    offset: currentOffset,
                }),
                reset ? getUserGroups(user.id) : Promise.resolve(myGroups),
            ]);

            if (reset) {
                setAllGroups(groups);
                setMyGroups(userGroups);
            } else {
                setAllGroups(prev => [...prev, ...groups]);
            }
            setHasMore(more);
        } catch (error) {
            console.error('Error fetching groups:', error);
        } finally {
            setIsLoading(false);
            setLoadingMore(false);
        }
    }, [user, searchQuery, offset, myGroups]);

    // Initial load and search changes
    useEffect(() => {
        setAllGroups([]);
        setOffset(0);
        setHasMore(true);
        fetchGroups(true);
    }, [user, searchQuery]);

    // Infinite scroll observer
    useEffect(() => {
        if (activeTab !== 'discover') return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore && !isLoading) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loadingMore, isLoading, activeTab]);

    const loadMore = async () => {
        if (!hasMore || loadingMore || !user) return;

        setLoadingMore(true);
        const newOffset = offset + GROUPS_PER_PAGE;
        setOffset(newOffset);

        try {
            const { groups, hasMore: more } = await getGroups({
                userId: user.id,
                search: searchQuery || undefined,
                limit: GROUPS_PER_PAGE,
                offset: newOffset,
            });

            setAllGroups(prev => [...prev, ...groups]);
            setHasMore(more);
        } catch (error) {
            console.error('Error loading more groups:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleJoin = async (groupId: string) => {
        if (!user) return;

        try {
            await joinGroup(groupId, user.id);
            fetchGroups(true);
        } catch (error) {
            console.error('Error joining group:', error);
            alert('Failed to join classroom');
        }
    };

    const handleLeave = async (groupId: string) => {
        if (!user) return;

        if (!confirm('Are you sure you want to leave this classroom?')) return;

        try {
            await leaveGroup(groupId, user.id);
            fetchGroups(true);
        } catch (error) {
            console.error('Error leaving group:', error);
            alert(error instanceof Error ? error.message : 'Failed to leave classroom');
        }
    };

    const displayedGroups = activeTab === 'my-groups' ? myGroups : allGroups;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Classrooms</h1>
                    <p className="text-surface-500 dark:text-surface-400 mt-1">
                        Join classrooms and connect with like-minded learners
                    </p>
                </div>
                {isPlatformAdmin && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Create Classroom
                    </button>
                )}
            </div>

            {/* Search and tabs */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400 dark:text-surface-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search classrooms..."
                        className="w-full pl-10 pr-4 py-2.5 border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                </div>

                {/* Tabs */}
                <div className="flex bg-surface-100 dark:bg-surface-800 rounded-lg p-1">
                    <button
                        onClick={() => setActiveTab('discover')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'discover'
                            ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
                            : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
                            }`}
                    >
                        Discover
                    </button>
                    <button
                        onClick={() => setActiveTab('my-groups')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'my-groups'
                            ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
                            : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
                            }`}
                    >
                        My Classrooms ({myGroups.length})
                    </button>
                </div>
            </div>

            {/* Groups grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                </div>
            ) : displayedGroups.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
                        <Search className="w-8 h-8 text-surface-400 dark:text-surface-500" />
                    </div>
                    <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-1">
                        {activeTab === 'my-groups' ? 'No classrooms yet' : 'No classrooms found'}
                    </h3>
                    <p className="text-surface-500 dark:text-surface-400">
                        {activeTab === 'my-groups'
                            ? "You haven't joined any classrooms yet. Discover classrooms to get started!"
                            : searchQuery
                                ? 'Try adjusting your search query'
                                : 'Be the first to create a classroom!'}
                    </p>
                    {activeTab === 'my-groups' && (
                        <button
                            onClick={() => setActiveTab('discover')}
                            className="mt-4 px-4 py-2 text-primary-600 dark:text-primary-400 font-medium hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                        >
                            Discover Classrooms
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayedGroups.map((group) => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                onJoin={handleJoin}
                                onLeave={handleLeave}
                                userIsPremium={isPremium}
                            />
                        ))}
                    </div>

                    {/* Infinite scroll trigger for Discover tab */}
                    {activeTab === 'discover' && hasMore && (
                        <div ref={observerTarget} className="py-8 text-center">
                            {loadingMore ? (
                                <div className="flex items-center justify-center gap-2 text-surface-500 dark:text-surface-400">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="text-sm">Loading more classrooms...</span>
                                </div>
                            ) : (
                                <span className="text-sm text-surface-400 dark:text-surface-500">
                                    Scroll for more
                                </span>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Create Group Modal */}
            <CreateGroupModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={() => {
                    setShowCreateModal(false);
                    fetchGroups(true);
                }}
            />
        </div>
    );
}
