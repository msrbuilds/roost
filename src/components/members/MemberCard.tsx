import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import type { Profile } from '@/types/database';
import { ProBadge } from '@/components/common/ProBadge';

interface MemberCardProps {
    member: Profile;
}

export function MemberCard({ member }: MemberCardProps) {
    const isOnline = member.is_online;
    const isPremium = member.membership_type === 'premium';

    return (
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl p-6 flex flex-col items-center text-center transition-all hover:border-primary-500/50 dark:hover:border-primary-400/50 hover:shadow-md dark:hover:shadow-none relative">
            {/* Header Section */}
            <div className="w-full flex flex-col items-center pb-4 border-b border-surface-200 dark:border-surface-700 mb-4">
                <div className="relative mb-3">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-100 dark:bg-surface-800 ring-2 ring-white dark:ring-surface-900">
                        {member.avatar_url ? (
                            <img
                                src={member.avatar_url}
                                alt={member.display_name || member.username}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-surface-400 dark:text-surface-500">
                                {(member.display_name || member.username || '?')[0].toUpperCase()}
                            </div>
                        )}
                    </div>
                    {isOnline && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-surface-900 rounded-full" title="Online" />
                    )}
                </div>

                <div className="flex flex-col items-center gap-1 mb-0.5 w-full">
                    <Link
                        to={`/profile/${member.username}`}
                        className="font-bold text-lg text-surface-900 dark:text-surface-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-center break-words w-full"
                    >
                        {member.display_name || member.username}
                    </Link>
                    {isPremium && <ProBadge size="xs" />}
                </div>
                <div className="text-sm text-surface-500 dark:text-surface-400 break-all text-center w-full">
                    @{member.username}
                </div>
            </div>

            {/* Content Section */}
            <div className="w-full flex-1 flex flex-col items-center justify-center mb-4">
                {member.bio ? (
                    <p className="text-sm text-surface-500 dark:text-surface-400 text-center line-clamp-3 px-2">
                        {member.bio}
                    </p>
                ) : (
                    <p className="text-sm text-surface-400 dark:text-surface-500 italic">
                        No bio available
                    </p>
                )}
            </div>

            {/* Actions Section */}
            <div className="w-full pt-4 border-t border-surface-200 dark:border-surface-700 grid grid-cols-2 gap-3 mt-auto">
                <Link
                    to={`/profile/${member.username}`}
                    className="flex items-center justify-center px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors text-xs font-medium"
                >
                    Profile
                </Link>
                <Link
                    to={`/messages/${member.id}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors text-xs font-medium dark:bg-black dark:hover:bg-black"
                >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Message
                </Link>
            </div>
        </div>
    );
}
