import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Crown, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getGroupBySlug, joinGroup, leaveGroup } from '@/services/group';
import type { GroupWithDetails } from '@/services/group';
import { DefaultGroupLayout, SidebarGroupLayout, LearnGroupLayout } from '@/components/groups';
import type { TabValue } from '@/components/groups/GroupTabs';

export default function GroupDetail() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { user, isPremium } = useAuth();
    const [group, setGroup] = useState<GroupWithDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabValue>('feed');

    const fetchGroup = useCallback(async () => {
        if (!slug) return;

        try {
            setIsLoading(true);
            setError(null);
            const data = await getGroupBySlug(slug, user?.id);
            if (!data) {
                setError('Classroom not found');
            } else {
                setGroup(data);
            }
        } catch (err) {
            console.error('Error fetching group:', err);
            setError('Failed to load classroom');
        } finally {
            setIsLoading(false);
        }
    }, [slug, user?.id]);

    useEffect(() => {
        fetchGroup();
    }, [fetchGroup]);

    const handleJoin = async () => {
        if (!user || !group) return;

        try {
            setIsJoining(true);
            const membership = await joinGroup(group.id, user.id);
            // Update state locally instead of full refetch
            setGroup(prev => prev ? {
                ...prev,
                is_member: true,
                user_role: membership.role,
                member_count: prev.member_count + 1,
            } : null);
        } catch (err) {
            console.error('Error joining group:', err);
            alert('Failed to join classroom');
        } finally {
            setIsJoining(false);
        }
    };

    const handleLeave = async () => {
        if (!user || !group) return;

        if (!confirm('Are you sure you want to leave this classroom?')) return;

        try {
            setIsLeaving(true);
            await leaveGroup(group.id, user.id);
            // Update state locally instead of full refetch
            setGroup(prev => prev ? {
                ...prev,
                is_member: false,
                user_role: null,
                member_count: Math.max(0, prev.member_count - 1),
            } : null);
        } catch (err) {
            console.error('Error leaving group:', err);
            alert(err instanceof Error ? err.message : 'Failed to leave classroom');
        } finally {
            setIsLeaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
        );
    }

    if (error || !group) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center py-12">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-50 mb-2">
                        {error || 'Classroom not found'}
                    </h2>
                    <p className="text-surface-500 dark:text-surface-400 mb-4">
                        The classroom you're looking for doesn't exist or you don't have access.
                    </p>
                    <button
                        onClick={() => navigate('/classrooms')}
                        className="px-4 py-2 text-primary-600 dark:text-primary-400 font-medium hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    >
                        Browse Classrooms
                    </button>
                </div>
            </div>
        );
    }

    // Check if premium group requires upgrade
    const isPremiumGroup = group.is_premium ?? false;
    const requiresUpgrade = isPremiumGroup && !isPremium;

    // Show upgrade page for premium groups when user is not premium
    if (requiresUpgrade) {
        return (
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="card p-8 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Crown className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
                        Premium Classroom
                    </h1>
                    <p className="text-surface-500 dark:text-surface-400 mb-2">
                        <span className="font-semibold text-surface-700 dark:text-surface-300">{group.name}</span> is a premium-only classroom.
                    </p>
                    <p className="text-surface-500 dark:text-surface-400 mb-6">
                        Upgrade to premium to access this classroom and all its content.
                    </p>

                    {group.description && (
                        <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 mb-6 text-left">
                            <p className="text-sm text-surface-600 dark:text-surface-400">
                                {group.description}
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            to="/upgrade"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all"
                        >
                            <Crown className="w-5 h-5" />
                            <span>Upgrade to Premium</span>
                        </Link>
                        <button
                            onClick={() => navigate('/classrooms')}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 font-medium rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back to Classrooms</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Check if user can view content (member of private group or public group)
    const canViewContent = !group.is_private || group.is_member;

    // Shared props for both layouts
    const layoutProps = {
        group,
        canViewContent,
        activeTab,
        onTabChange: setActiveTab,
        onJoin: handleJoin,
        onLeave: handleLeave,
        isJoining,
        isLeaving,
        onMemberChange: fetchGroup,
    };

    // Render layout based on group preference
    if (group.layout_mode === 'default') {
        return <DefaultGroupLayout {...layoutProps} />;
    }

    if (group.layout_mode === 'learn') {
        return <LearnGroupLayout {...layoutProps} />;
    }

    return <SidebarGroupLayout {...layoutProps} />;
}
