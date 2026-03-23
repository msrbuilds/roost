import type { Profile } from '@/types/database';
import { MemberCard } from './MemberCard';

interface MembersGridProps {
    members: Profile[];
    loading: boolean;
}

export function MembersGrid({ members, loading }: MembersGridProps) {
    if (loading && members.length === 0) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl p-6 h-[320px] animate-pulse">
                        <div className="w-24 h-24 rounded-full bg-surface-200 dark:bg-surface-700 mx-auto mb-4" />
                        <div className="h-6 w-32 bg-surface-200 dark:bg-surface-700 mx-auto mb-2 rounded" />
                        <div className="h-4 w-24 bg-surface-200 dark:bg-surface-700 mx-auto mb-6 rounded" />
                        <div className="h-10 w-full bg-surface-200 dark:bg-surface-700 rounded mb-2" />
                        <div className="grid grid-cols-2 gap-3 mt-auto">
                            <div className="h-9 bg-surface-200 dark:bg-surface-700 rounded" />
                            <div className="h-9 bg-surface-200 dark:bg-surface-700 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (members.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-100 dark:bg-surface-800 mb-4">
                    <span className="text-2xl">👥</span>
                </div>
                <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-1">No members found</h3>
                <p className="text-surface-500 dark:text-surface-400">Try adjusting your filters or search query.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {members.map((member) => (
                <MemberCard key={member.id} member={member} />
            ))}
        </div>
    );
}
