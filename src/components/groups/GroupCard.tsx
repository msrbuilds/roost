import { Link } from 'react-router-dom';
import { Users, Lock, Globe, Crown } from 'lucide-react';
import type { GroupWithDetails } from '@/services/group';

interface GroupCardProps {
    group: GroupWithDetails;
    onJoin?: (groupId: string) => void;
    onLeave?: (groupId: string) => void;
    userIsPremium?: boolean;
}

export default function GroupCard({ group, onJoin, onLeave, userIsPremium = true }: GroupCardProps) {
    const isPremiumGroup = group.is_premium ?? false;
    const canAccess = !isPremiumGroup || userIsPremium;

    const handleAction = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Don't allow joining premium groups if user is not premium
        if (isPremiumGroup && !userIsPremium) {
            return;
        }

        if (group.is_member) {
            onLeave?.(group.id);
        } else {
            onJoin?.(group.id);
        }
    };

    // Link destination: upgrade page if premium group and user not premium
    const linkTo = canAccess ? `/classrooms/${group.slug}` : '/upgrade';

    return (
        <Link
            to={linkTo}
            className={`card p-6 hover:shadow-elevated transition-all duration-200 group block relative ${!canAccess ? 'opacity-90' : ''}`}
        >
            {/* Premium badge */}
            {isPremiumGroup && (
                <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                    <Crown className="w-3 h-3" />
                    <span className="font-medium">Premium</span>
                </div>
            )}

            {/* Premium lock overlay for free users */}
            {isPremiumGroup && !userIsPremium && (
                <div className="absolute inset-0 bg-surface-900/40 dark:bg-surface-900/60 rounded-xl flex items-center justify-center z-10">
                    <div className="text-center text-white bg-surface-900/80 px-4 py-3 rounded-lg">
                        <Crown className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                        <p className="text-sm font-medium">Premium Only</p>
                        <p className="text-xs text-surface-300 mt-1">Upgrade to access</p>
                    </div>
                </div>
            )}

            {/* Cover image */}
            {group.cover_url && (
                <div className="relative -mx-6 -mt-6 mb-4 h-24 overflow-hidden rounded-t-xl">
                    <img
                        src={group.cover_url}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
            )}

            <div className="flex items-start gap-4">
                {/* Avatar */}
                {group.avatar_url ? (
                    <img
                        src={group.avatar_url}
                        alt={group.name}
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                ) : (
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0 ${isPremiumGroup ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-primary-400 to-primary-600'}`}>
                        {group.name.charAt(0).toUpperCase()}
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    {/* Name and privacy indicator */}
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-surface-900 dark:text-surface-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {group.name}
                        </h3>
                        {group.is_private ? (
                            <Lock className="w-4 h-4 text-surface-400 dark:text-surface-500 flex-shrink-0" />
                        ) : (
                            <Globe className="w-4 h-4 text-surface-400 dark:text-surface-500 flex-shrink-0" />
                        )}
                    </div>

                    {/* Description */}
                    {group.description && (
                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">
                            {group.description}
                        </p>
                    )}

                    {/* Member count and role */}
                    <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-1 text-sm text-surface-500 dark:text-surface-400">
                            <Users className="w-4 h-4" />
                            <span>{group.member_count} members</span>
                        </div>
                        {group.is_member && group.user_role && (
                            <span className={`
                                text-xs px-2 py-0.5 rounded-full font-medium
                                ${group.user_role === 'admin' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' :
                                    group.user_role === 'moderator' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                        'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'}
                            `}>
                                {group.user_role.charAt(0).toUpperCase() + group.user_role.slice(1)}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Join/Leave button */}
            {!group.is_private && canAccess && (
                <button
                    onClick={handleAction}
                    className={`
                        w-full mt-4 py-2 px-4 rounded-lg font-medium text-sm transition-colors
                        ${group.is_member
                            ? 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
                            : 'bg-primary-600 text-white hover:bg-primary-700'}
                    `}
                >
                    {group.is_member ? 'Leave Classroom' : 'Join Classroom'}
                </button>
            )}

            {/* Upgrade button for premium groups */}
            {isPremiumGroup && !userIsPremium && (
                <div className="mt-4 py-2 px-4 rounded-lg font-medium text-sm text-center bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                    Upgrade to Join
                </div>
            )}
        </Link>
    );
}
