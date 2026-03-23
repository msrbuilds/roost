import { useState, useEffect } from 'react';
import { Search, Filter, X } from 'lucide-react';
import type { ShowcaseCategory, ShowcaseTag } from '@/types/database';
import type { ShowcaseFilters as Filters } from '@/types/showcase';
import { SHOWCASE_CATEGORY_INFO } from '@/types/showcase';
import { getAllTags } from '@/services/showcase';

interface ShowcaseFiltersProps {
    filters: Filters;
    onFiltersChange: (filters: Filters) => void;
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

export default function ShowcaseFilters({ filters, onFiltersChange }: ShowcaseFiltersProps) {
    const [tags, setTags] = useState<ShowcaseTag[]>([]);
    const [isTagsOpen, setIsTagsOpen] = useState(false);
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

    return (
        <div className="space-y-4">
            {/* Search and Sort Row */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Search showcases..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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

                {/* Sort */}
                <select
                    value={filters.sortBy || 'newest'}
                    onChange={(e) => handleSortChange(e.target.value as Filters['sortBy'])}
                    className="px-4 py-2.5 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                {/* Tags filter toggle */}
                <button
                    onClick={() => setIsTagsOpen(!isTagsOpen)}
                    className={`
                        flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors
                        ${isTagsOpen || (filters.tagIds && filters.tagIds.length > 0)
                            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400'
                            : 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-surface-300'
                        }
                    `}
                >
                    <Filter className="w-4 h-4" />
                    <span>Tags</span>
                    {filters.tagIds && filters.tagIds.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                            {filters.tagIds.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => handleCategoryChange(undefined)}
                    className={`
                        px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                        ${!filters.category
                            ? 'bg-primary-600 text-white'
                            : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                        }
                    `}
                >
                    All
                </button>
                {CATEGORY_OPTIONS.map((category) => (
                    <button
                        key={category.value}
                        onClick={() => handleCategoryChange(category.value)}
                        className={`
                            px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                            ${filters.category === category.value
                                ? 'text-white'
                                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                            }
                        `}
                        style={filters.category === category.value ? { backgroundColor: category.color } : undefined}
                    >
                        {category.label}
                    </button>
                ))}
            </div>

            {/* Tags Dropdown */}
            {isTagsOpen && tags.length > 0 && (
                <div className="p-4 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg">
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => {
                            const isSelected = filters.tagIds?.includes(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    onClick={() => handleTagToggle(tag.id)}
                                    className={`
                                        px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                                        ${isSelected
                                            ? 'text-white'
                                            : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:opacity-80'
                                        }
                                    `}
                                    style={isSelected ? { backgroundColor: tag.color } : { borderColor: tag.color, borderWidth: 1 }}
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
                    className="flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                >
                    <X className="w-4 h-4" />
                    Clear all filters
                </button>
            )}
        </div>
    );
}
