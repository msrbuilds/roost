import { useState, useEffect } from 'react';
import { Search, X, SlidersHorizontal, ChevronLeft } from 'lucide-react';
import type { ShowcaseCategory, ShowcaseTag } from '@/types/database';
import type { ShowcaseFilters as Filters } from '@/types/showcase';
import { SHOWCASE_CATEGORY_INFO } from '@/types/showcase';
import { getAllTags } from '@/services/showcase';

interface ShowcaseFilterSidebarProps {
    filters: Filters;
    onFiltersChange: (filters: Filters) => void;
    isOpen: boolean;
    onToggle: () => void;
}

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest' },
    { value: 'votes', label: 'Most Votes' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'featured', label: 'Featured' },
] as const;

const CATEGORY_OPTIONS = Object.entries(SHOWCASE_CATEGORY_INFO).map(([value, info]) => ({
    value: value as ShowcaseCategory,
    label: info.label,
    color: info.color,
}));

export default function ShowcaseFilterSidebar({
    filters,
    onFiltersChange,
    isOpen,
    onToggle,
}: ShowcaseFilterSidebarProps) {
    const [tags, setTags] = useState<ShowcaseTag[]>([]);
    const [searchInput, setSearchInput] = useState(filters.search || '');

    useEffect(() => {
        getAllTags().then(setTags);
    }, []);

    // Debounced search
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (searchInput !== filters.search) {
                onFiltersChange({ ...filters, search: searchInput || undefined });
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    const handleCategoryChange = (category: ShowcaseCategory | undefined) => {
        onFiltersChange({ ...filters, category });
    };

    const handleSortChange = (sortBy: Filters['sortBy']) => {
        onFiltersChange({ ...filters, sortBy });
    };

    const handleTagToggle = (tagId: string) => {
        const currentTags = filters.tagIds || [];
        const newTags = currentTags.includes(tagId)
            ? currentTags.filter((id) => id !== tagId)
            : [...currentTags, tagId];
        onFiltersChange({ ...filters, tagIds: newTags.length > 0 ? newTags : undefined });
    };

    const clearFilters = () => {
        setSearchInput('');
        onFiltersChange({ sortBy: 'newest' });
    };

    const hasActiveFilters = filters.category || filters.search || (filters.tagIds && filters.tagIds.length > 0);
    const activeFilterCount = (filters.category ? 1 : 0) + (filters.tagIds?.length || 0);

    return (
        <>
            {/* Mobile overlay backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 md:hidden"
                    onClick={onToggle}
                />
            )}
            <aside
                className={`
                    bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700
                    transition-all duration-300 overflow-y-auto flex-shrink-0
                    ${isOpen
                        ? 'fixed inset-y-0 right-0 w-72 z-50 md:relative md:z-auto md:w-64 md:sticky md:top-0 md:h-[calc(100vh-64px)]'
                        : 'hidden md:block md:sticky md:top-0 md:h-[calc(100vh-64px)] w-12'
                    }
                `}
            >
                {/* Collapsed state - just toggle button (desktop only) */}
                {!isOpen && (
                    <div className="p-2">
                        <button
                            onClick={onToggle}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400 relative"
                            title="Show filters"
                        >
                            <SlidersHorizontal className="w-5 h-5" />
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    </div>
                )}

                {/* Expanded state - full sidebar */}
                {isOpen && (
                    <div className="p-4 space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-surface-900 dark:text-surface-100">Filters</h3>
                            <button
                                onClick={onToggle}
                                className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded"
                                title="Hide filters"
                            >
                                <ChevronLeft className="w-5 h-5 text-surface-500 rotate-180" />
                            </button>
                        </div>

                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Search
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            {searchInput && (
                                <button
                                    onClick={() => setSearchInput('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Sort */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Sort By
                        </label>
                        <select
                            value={filters.sortBy || 'newest'}
                            onChange={(e) => handleSortChange(e.target.value as Filters['sortBy'])}
                            className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            {SORT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Categories */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Category
                        </label>
                        <select
                            value={filters.category || ''}
                            onChange={(e) => handleCategoryChange(e.target.value as ShowcaseCategory || undefined)}
                            className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">All Categories</option>
                            {CATEGORY_OPTIONS.map((category) => (
                                <option key={category.value} value={category.value}>
                                    {category.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                Tags
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag) => {
                                    const isSelected = filters.tagIds?.includes(tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => handleTagToggle(tag.id)}
                                            className={`
                                                px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                                                ${isSelected
                                                    ? 'text-white'
                                                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:opacity-80'
                                                }
                                            `}
                                            style={
                                                isSelected
                                                    ? { backgroundColor: tag.color }
                                                    : { borderColor: tag.color, borderWidth: 1 }
                                            }
                                        >
                                            {tag.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Clear filters */}
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 border border-surface-200 dark:border-surface-700 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                        >
                            <X className="w-4 h-4" />
                            Clear all filters
                        </button>
                    )}
                </div>
            )}
        </aside>
        </>
    );
}
