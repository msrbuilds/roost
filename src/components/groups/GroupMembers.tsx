import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Users, Crown, Shield, ChevronRight, MoreVertical, UserMinus, ShieldPlus, ShieldMinus, Loader2 } from 'lucide-react';
import { getGroupMembers, updateMemberRole, removeMember } from '@/services/group';
import type { GroupMemberWithProfile } from '@/services/group';
import type { GroupRole } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface GroupMembersProps {
    groupId: string;
    userRole: GroupRole | null;
    compact?: boolean;
    limit?: number;
    onMemberChange?: () => void;
}

const MEMBERS_PER_PAGE = 20;

export default function GroupMembers({
    groupId,
    userRole,
    compact = true,
    limit = 5,
    onMemberChange,
}: GroupMembersProps) {
    const { user } = useAuth();
    const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const observerTarget = useRef<HTMLDivElement>(null);

    const canManageMembers = userRole === 'admin' || userRole === 'moderator';
    const canPromote = userRole === 'admin';

    // Use different page size for compact vs full view
    const pageSize = compact ? limit : MEMBERS_PER_PAGE;

    const fetchMembers = useCallback(async (reset = false) => {
        const currentOffset = reset ? 0 : offset;

        try {
            if (reset) {
                setIsLoading(true);
                setOffset(0);
            }

            const { members: data, hasMore: more } = await getGroupMembers(groupId, {
                limit: pageSize,
                offset: currentOffset,
            });

            if (reset) {
                setMembers(data);
            } else {
                setMembers(prev => [...prev, ...data]);
            }
            setHasMore(more);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setIsLoading(false);
            setLoadingMore(false);
        }
    }, [groupId, pageSize, offset]);

    useEffect(() => {
        setMembers([]);
        setOffset(0);
        setHasMore(false);
        fetchMembers(true);
    }, [groupId, compact]);

    // Infinite scroll observer (only for non-compact view)
    useEffect(() => {
        if (compact) return;

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
    }, [compact, hasMore, loadingMore, isLoading]);

    const loadMore = async () => {
        if (!hasMore || loadingMore) return;

        setLoadingMore(true);
        const newOffset = offset + pageSize;
        setOffset(newOffset);

        try {
            const { members: data, hasMore: more } = await getGroupMembers(groupId, {
                limit: pageSize,
                offset: newOffset,
            });

            setMembers(prev => [...prev, ...data]);
            setHasMore(more);
        } catch (error) {
            console.error('Error loading more members:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: GroupRole) => {
        try {
            await updateMemberRole(groupId, memberId, newRole);
            setMenuOpen(null);
            fetchMembers(true);
            onMemberChange?.();
        } catch (error) {
            console.error('Error updating role:', error);
            alert(error instanceof Error ? error.message : 'Failed to update role');
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Are you sure you want to remove this member?')) return;

        try {
            await removeMember(groupId, memberId);
            setMenuOpen(null);
            // Remove from local state and refetch
            setMembers(prev => prev.filter(m => m.user_id !== memberId));
            onMemberChange?.();
        } catch (error) {
            console.error('Error removing member:', error);
            alert(error instanceof Error ? error.message : 'Failed to remove member');
        }
    };

    const getRoleIcon = (role: GroupRole) => {
        switch (role) {
            case 'admin':
                return <Crown className="w-3.5 h-3.5 text-primary-500" />;
            case 'moderator':
                return <Shield className="w-3.5 h-3.5 text-amber-500" />;
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className="card p-6">
                <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Members
                </h3>
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                            <div className="w-8 h-8 rounded-full bg-surface-200 dark:bg-surface-700" />
                            <div className="flex-1">
                                <div className="h-4 w-24 bg-surface-200 dark:bg-surface-700 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (compact) {
        return (
            <div className="card p-6">
                <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Members
                </h3>
                <div className="space-y-3">
                    {members.map((member) => (
                        <Link
                            key={member.id}
                            to={`/profile/${member.profile.username}`}
                            className="flex items-center gap-3 group"
                        >
                            {member.profile.avatar_url ? (
                                <img
                                    src={member.profile.avatar_url}
                                    alt={member.profile.display_name}
                                    className="w-8 h-8 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-medium">
                                    {member.profile.display_name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium text-surface-700 dark:text-surface-300 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                        {member.profile.display_name}
                                    </span>
                                    {member.role && getRoleIcon(member.role)}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
                {hasMore && (
                    <Link
                        to={`/classrooms/${groupId}/members`}
                        className="flex items-center justify-center gap-1 mt-4 pt-4 border-t border-surface-100 dark:border-surface-700 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                    >
                        View all members
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                )}
            </div>
        );
    }

    // Full member list view
    return (
        <div className="card">
            <div className="p-6 border-b border-surface-100 dark:border-surface-700">
                <h3 className="font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Members ({members.length}{hasMore ? '+' : ''})
                </h3>
            </div>
            <div className="divide-y divide-surface-100 dark:divide-surface-700">
                {members.map((member) => (
                    <div
                        key={member.id}
                        className="flex items-center gap-4 p-4 hover:bg-surface-50 dark:hover:bg-surface-800"
                    >
                        <Link
                            to={`/profile/${member.profile.username}`}
                            className="flex items-center gap-3 flex-1 min-w-0 group"
                        >
                            {member.profile.avatar_url ? (
                                <img
                                    src={member.profile.avatar_url}
                                    alt={member.profile.display_name}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium">
                                    {member.profile.display_name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-surface-900 dark:text-surface-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                        {member.profile.display_name}
                                    </span>
                                    {member.role && getRoleIcon(member.role)}
                                </div>
                                <span className="text-sm text-surface-500 dark:text-surface-400">
                                    @{member.profile.username}
                                </span>
                            </div>
                        </Link>

                        {/* Role badge */}
                        <span className={`
                            text-xs px-2 py-1 rounded-full font-medium
                            ${member.role === 'admin' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' :
                                member.role === 'moderator' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                    'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'}
                        `}>
                            {member.role && (member.role.charAt(0).toUpperCase() + member.role.slice(1))}
                        </span>

                        {/* Actions menu */}
                        {canManageMembers && member.user_id !== user?.id && member.role !== 'admin' && (
                            <div className="relative">
                                <button
                                    onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                                    className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                                >
                                    <MoreVertical className="w-4 h-4 text-surface-400 dark:text-surface-500" />
                                </button>

                                {menuOpen === member.id && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-surface-800 rounded-lg shadow-lg border border-surface-200 dark:border-surface-700 py-1 z-10">
                                        {canPromote && member.role === 'member' && (
                                            <button
                                                onClick={() => handleRoleChange(member.user_id, 'moderator')}
                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700"
                                            >
                                                <ShieldPlus className="w-4 h-4" />
                                                Make Moderator
                                            </button>
                                        )}
                                        {canPromote && member.role === 'moderator' && (
                                            <>
                                                <button
                                                    onClick={() => handleRoleChange(member.user_id, 'admin')}
                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700"
                                                >
                                                    <Crown className="w-4 h-4" />
                                                    Make Admin
                                                </button>
                                                <button
                                                    onClick={() => handleRoleChange(member.user_id, 'member')}
                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700"
                                                >
                                                    <ShieldMinus className="w-4 h-4" />
                                                    Remove Moderator
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleRemoveMember(member.user_id)}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            <UserMinus className="w-4 h-4" />
                                            Remove from Classroom
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {/* Infinite scroll trigger */}
                {hasMore && (
                    <div ref={observerTarget} className="py-6 text-center">
                        {loadingMore ? (
                            <div className="flex items-center justify-center gap-2 text-surface-500 dark:text-surface-400">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-sm">Loading more members...</span>
                            </div>
                        ) : (
                            <span className="text-sm text-surface-400 dark:text-surface-500">
                                Scroll for more
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
