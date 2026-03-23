import { Link } from 'react-router-dom';
import { Settings, Users } from 'lucide-react';
import type { GroupWithDetails } from '@/services/group';
import { hasPermission } from '@/services/group';

interface CompactGroupHeaderProps {
    group: GroupWithDetails;
}

export default function CompactGroupHeader({ group }: CompactGroupHeaderProps) {
    const canEditSettings = hasPermission(group.user_role, 'edit_settings');

    return (
        <div className="flex items-center gap-4 px-6 py-4 border-b border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
            {/* Avatar */}
            {group.avatar_url ? (
                <img
                    src={group.avatar_url}
                    alt={group.name}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
            ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                    {group.name.charAt(0).toUpperCase()}
                </div>
            )}

            {/* Name & Description */}
            <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50 truncate">
                    {group.name}
                </h1>
                {group.description && (
                    <p className="text-sm text-surface-500 dark:text-surface-400 truncate">
                        {group.description}
                    </p>
                )}
            </div>

            {/* Stats & Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-sm text-surface-500 dark:text-surface-400">
                    <Users className="w-4 h-4" />
                    <span>{group.member_count}</span>
                </div>

                {canEditSettings && (
                    <Link
                        to={`/classrooms/${group.slug}/settings`}
                        className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                        title="Classroom settings"
                    >
                        <Settings className="w-5 h-5" />
                    </Link>
                )}
            </div>
        </div>
    );
}
