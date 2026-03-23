import { Lock } from 'lucide-react';
import { GroupHeader, GroupMembers, GroupTabs, GroupAssets, GroupRecordings } from '@/components/groups';
import type { TabValue } from '@/components/groups/GroupTabs';
import type { GroupWithDetails } from '@/services/group';
import { PostFeed } from '@/components/feed';

interface SidebarGroupLayoutProps {
    group: GroupWithDetails;
    canViewContent: boolean;
    activeTab: TabValue;
    onTabChange: (tab: TabValue) => void;
    onJoin: () => void;
    onLeave: () => void;
    isJoining: boolean;
    isLeaving: boolean;
    onMemberChange: () => void;
}

export default function SidebarGroupLayout({
    group,
    canViewContent,
    activeTab,
    onTabChange,
    onJoin,
    onLeave,
    isJoining,
    isLeaving,
    onMemberChange,
}: SidebarGroupLayoutProps) {
    if (!canViewContent) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="card p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
                        <Lock className="w-8 h-8 text-surface-400 dark:text-surface-500" />
                    </div>
                    <h3 className="text-lg font-medium text-surface-900 dark:text-surface-50 mb-2">
                        This is a private classroom
                    </h3>
                    <p className="text-surface-500 dark:text-surface-400 max-w-md mx-auto">
                        You need to be a member to see the content of this classroom.
                        Request to join or contact the classroom admin.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main content area - Left side */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Tabs */}
                    <div className="bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700">
                        <div className="border-b border-surface-200 dark:border-surface-700 px-4">
                            <GroupTabs
                                activeTab={activeTab}
                                onTabChange={onTabChange}
                                variant="inline"
                            />
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            {activeTab === 'feed' && <PostFeed groupId={group.id} />}
                            {activeTab === 'assets' && (
                                <GroupAssets groupId={group.id} userRole={group.user_role} />
                            )}
                            {activeTab === 'recordings' && (
                                <GroupRecordings groupId={group.id} userRole={group.user_role} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar - Right side */}
                <div className="space-y-6">
                    {/* Group Header */}
                    <div className="bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
                        <GroupHeader
                            group={group}
                            onJoin={onJoin}
                            onLeave={onLeave}
                            isJoining={isJoining}
                            isLeaving={isLeaving}
                        />
                    </div>

                    {/* Members */}
                    <GroupMembers
                        groupId={group.id}
                        userRole={group.user_role}
                        compact={true}
                        limit={5}
                        onMemberChange={onMemberChange}
                    />
                </div>
            </div>
        </div>
    );
}
