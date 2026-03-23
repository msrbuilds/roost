import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, Shield, SlidersHorizontal } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Category } from '@/types';

export type SortOption = 'newest' | 'popular' | 'trending';

interface CategoryFilterProps {
    categories: Category[];
    selectedCategoryId: string | null;
    onSelectCategory: (categoryId: string | null) => void;
    adminOnly?: boolean;
    onToggleAdminOnly?: () => void;
    sortBy?: SortOption;
    onSortChange?: (sort: SortOption) => void;
}

const SORT_LABELS: Record<SortOption, string> = {
    newest: 'Newest',
    popular: 'Popular',
    trending: 'Trending',
};

export default function CategoryFilter({
    categories,
    selectedCategoryId,
    onSelectCategory,
    adminOnly = false,
    onToggleAdminOnly,
    sortBy = 'newest',
    onSortChange,
}: CategoryFilterProps) {
    const [topicOpen, setTopicOpen] = useState(false);
    const [sortOpen, setSortOpen] = useState(false);
    const topicRef = useRef<HTMLDivElement>(null);
    const sortRef = useRef<HTMLDivElement>(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (topicRef.current && !topicRef.current.contains(e.target as Node)) {
                setTopicOpen(false);
            }
            if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
                setSortOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const selectedCategory = categories.find(c => c.id === selectedCategoryId);
    const topicLabel = selectedCategory ? selectedCategory.name : 'All Topics';

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Topics dropdown */}
            <div ref={topicRef} className="relative">
                <button
                    onClick={() => { setTopicOpen(!topicOpen); setSortOpen(false); }}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                        transition-all duration-200
                        ${selectedCategoryId
                            ? 'bg-primary-600 text-white shadow-md'
                            : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                        }
                    `}
                >
                    {selectedCategory?.icon && <span>{selectedCategory.icon}</span>}
                    {topicLabel}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${topicOpen ? 'rotate-180' : ''}`} />
                </button>

                {topicOpen && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-surface-800 rounded-xl shadow-elevated dark:shadow-elevated-dark border border-surface-200 dark:border-surface-700 z-50 overflow-hidden py-1">
                        <button
                            onClick={() => { onSelectCategory(null); setTopicOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                selectedCategoryId === null && !adminOnly
                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                                    : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700'
                            }`}
                        >
                            All Topics
                        </button>
                        {categories.map(category => (
                            <button
                                key={category.id}
                                onClick={() => { onSelectCategory(category.id); setTopicOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                                    selectedCategoryId === category.id && !adminOnly
                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                                        : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700'
                                }`}
                            >
                                {category.icon && <span>{category.icon}</span>}
                                <span>{category.name}</span>
                                {category.color && (
                                    <span
                                        className="w-2.5 h-2.5 rounded-full ml-auto flex-shrink-0"
                                        style={{ backgroundColor: category.color }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Sort dropdown */}
            {onSortChange && (
                <div ref={sortRef} className="relative">
                    <button
                        onClick={() => { setSortOpen(!sortOpen); setTopicOpen(false); }}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                            transition-all duration-200
                            ${sortBy !== 'newest'
                                ? 'bg-primary-600 text-white shadow-md'
                                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                            }
                        `}
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {SORT_LABELS[sortBy]}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {sortOpen && (
                        <div className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-surface-800 rounded-xl shadow-elevated dark:shadow-elevated-dark border border-surface-200 dark:border-surface-700 z-50 overflow-hidden py-1">
                            {(['newest', 'popular', 'trending'] as SortOption[]).map(option => (
                                <button
                                    key={option}
                                    onClick={() => { onSortChange(option); setSortOpen(false); }}
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                        sortBy === option
                                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                                            : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700'
                                    }`}
                                >
                                    {SORT_LABELS[option]}
                                    <span className="block text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                                        {option === 'newest' && 'Most recent posts'}
                                        {option === 'popular' && 'Most reactions'}
                                        {option === 'trending' && 'Most commented'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Admin Posts filter */}
            {onToggleAdminOnly && (
                <button
                    onClick={onToggleAdminOnly}
                    className={`
                        px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                        transition-all duration-200 flex items-center gap-1.5
                        ${adminOnly
                            ? 'bg-amber-500 text-white shadow-md'
                            : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                        }
                    `}
                >
                    <Shield className="w-3.5 h-3.5" />
                    Admin Posts
                </button>
            )}
        </div>
    );
}

// Helper to format relative time
export function formatRelativeTime(date: string): string {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
}
