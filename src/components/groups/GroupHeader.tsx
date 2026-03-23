import { Link } from 'react-router-dom';
import { Settings, Users, Lock, Globe, LogOut, UserPlus } from 'lucide-react';
import type { GroupWithDetails } from '@/services/group';
import { hasPermission } from '@/services/group';

interface GroupHeaderProps {
    group: GroupWithDetails;
    onJoin?: () => void;
    onLeave?: () => void;
    isJoining?: boolean;
    isLeaving?: boolean;
}

export default function GroupHeader({
    group,
    onJoin,
    onLeave,
    isJoining = false,
    isLeaving = false,
}: GroupHeaderProps) {
    const canEditSettings = hasPermission(group.user_role, 'edit_settings');

    return (
        <div className="card overflow-hidden">
            {/* Cover image */}
            <div className="relative h-48 bg-gradient-to-br from-primary-400 to-primary-600">
                {group.cover_url && (
                    <img
                        src={group.cover_url}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>

            {/* Content */}
            <div className="relative px-6 pb-6">
                {/* Avatar - positioned to overlap cover */}
                <div className="absolute -top-12 left-6">
                    {group.avatar_url ? (
                        <img
                            src={group.avatar_url}
                            alt={group.name}
                            className="w-24 h-24 rounded-xl object-cover border-4 border-white dark:border-surface-900 shadow-lg bg-white dark:bg-surface-800"
                        />
                    ) : (
                        <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-white dark:border-surface-900 shadow-lg">
                            {group.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Actions - top right */}
                <div className="flex justify-end pt-4 gap-2">
                    {group.is_member ? (
                        <>
                            {canEditSettings && (
                                <Link
                                    to={`/classrooms/${group.slug}/settings`}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors text-sm font-medium"
                                >
                                    <Settings className="w-4 h-4" />
                                    Settings
                                </Link>
                            )}
                            {group.user_role !== 'admin' && (
                                <button
                                    onClick={onLeave}
                                    disabled={isLeaving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    <LogOut className="w-4 h-4" />
                                    {isLeaving ? 'Leaving...' : 'Leave'}
                                </button>
                            )}
                        </>
                    ) : (
                        !group.is_private && (
                            <button
                                onClick={onJoin}
                                disabled={isJoining}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                <UserPlus className="w-4 h-4" />
                                {isJoining ? 'Joining...' : 'Join Classroom'}
                            </button>
                        )
                    )}
                </div>

                {/* Group info */}
                <div className="mt-8">
                    <div className="flex flex-col items-left gap-3">
                        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">
                            {group.name}
                        </h1>
                        {group.is_private ? (
                            <div className="flex items-center gap-1 text-surface-500 dark:text-surface-400">
                                <Lock className="w-4 h-4" />
                                <span className="text-sm">Private</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-surface-500 dark:text-surface-400">
                                <Globe className="w-4 h-4" />
                                <span className="text-sm">Public</span>
                            </div>
                        )}
                    </div>

                    {group.description && (
                        <p className="text-surface-600 dark:text-surface-400 mt-2 max-w-2xl">
                            {group.description}
                        </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-6 mt-4">
                        <div className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
                            <Users className="w-5 h-5" />
                            <span className="font-medium">{group.member_count}</span>
                            <span>members</span>
                        </div>
                        {group.is_member && group.user_role && (
                            <span className={`
                                text-sm px-3 py-1 rounded-full font-medium
                                ${group.user_role === 'admin' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' :
                                    group.user_role === 'moderator' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                        'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'}
                            `}>
                                {group.user_role.charAt(0).toUpperCase() + group.user_role.slice(1)}
                            </span>
                        )}
                    </div>

                    {/* Creator info */}
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-100 dark:border-surface-700">
                        <span className="text-sm text-surface-500 dark:text-surface-400">Created by</span>
                        <Link
                            to={`/profile/${group.creator.username}`}
                            className="flex items-center gap-2 group"
                        >
                            {group.creator.avatar_url ? (
                                <img
                                    src={group.creator.avatar_url}
                                    alt={group.creator.display_name}
                                    className="w-6 h-6 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-medium">
                                    {group.creator.display_name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <span className="text-sm font-medium text-surface-700 dark:text-surface-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                {group.creator.display_name}
                            </span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
