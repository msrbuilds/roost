import { Search } from 'lucide-react';

interface MemberFiltersProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    statusFilter: 'all' | 'online';
    onStatusChange: (status: 'all' | 'online') => void;
    sortBy: 'newest' | 'alphabetical' | 'last_active';
    onSortChange: (sort: 'newest' | 'alphabetical' | 'last_active') => void;
}

export function MemberFilters({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusChange,
    sortBy,
    onSortChange
}: MemberFiltersProps) {
    return (
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl p-4 mb-6 sticky top-[73px] z-10 shadow-sm dark:shadow-none">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 dark:text-surface-500" />
                    <input
                        type="text"
                        placeholder="Search members..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    <select
                        value={statusFilter}
                        onChange={(e) => onStatusChange(e.target.value as 'all' | 'online')}
                        className="px-3 py-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    >
                        <option value="all">All Status</option>
                        <option value="online">Online Now</option>
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => onSortChange(e.target.value as any)}
                        className="px-3 py-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    >
                        <option value="newest">Newest Members</option>
                        <option value="last_active">Recently Active</option>
                        <option value="alphabetical">Alphabetical</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
