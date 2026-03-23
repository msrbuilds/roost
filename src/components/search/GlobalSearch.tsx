import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, User, FileText, Users, Crown, Loader2 } from 'lucide-react';
import { debounce } from 'lodash';
import { useAuth } from '@/contexts/AuthContext';
import {
    globalSearch,
    truncateText,
    type SearchResults,
    type SearchResultUser,
    type SearchResultPost,
    type SearchResultGroup,
} from '@/services/search';

interface GlobalSearchProps {
    className?: string;
    placeholder?: string;
    onClose?: () => void;
    autoFocus?: boolean;
}

export default function GlobalSearch({
    className = '',
    placeholder = 'Search...',
    onClose,
    autoFocus = false,
}: GlobalSearchProps) {
    const { user, isPremium } = useAuth();
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults>({ users: [], posts: [], groups: [] });
    const [isSearching, setIsSearching] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Calculate if we have any results
    const hasResults = results.users.length > 0 || results.posts.length > 0 || results.groups.length > 0;

    // Debounced search function
    const debouncedSearch = useMemo(
        () =>
            debounce(async (searchQuery: string) => {
                if (searchQuery.trim().length < 2) {
                    setResults({ users: [], posts: [], groups: [] });
                    setIsSearching(false);
                    return;
                }

                if (!user) {
                    setIsSearching(false);
                    return;
                }

                setIsSearching(true);
                try {
                    const searchResults = await globalSearch(searchQuery, user.id, isPremium);
                    setResults(searchResults);
                    setIsDropdownOpen(true);
                } catch (error) {
                    console.error('Search error:', error);
                    setResults({ users: [], posts: [], groups: [] });
                } finally {
                    setIsSearching(false);
                }
            }, 300),
        [user, isPremium]
    );

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        if (value.trim().length >= 2) {
            setIsSearching(true);
        }
        debouncedSearch(value);
    };

    // Clear search
    const handleClear = () => {
        setQuery('');
        setResults({ users: [], posts: [], groups: [] });
        setIsDropdownOpen(false);
        inputRef.current?.focus();
    };

    // Handle result click
    const handleResultClick = useCallback(
        (result: SearchResultUser | SearchResultPost | SearchResultGroup) => {
            setQuery('');
            setResults({ users: [], posts: [], groups: [] });
            setIsDropdownOpen(false);
            onClose?.();

            if (result.type === 'user') {
                navigate(`/profile/${result.username}`);
            } else if (result.type === 'post') {
                // Navigate to post detail page
                navigate(`/post/${result.id}`);
            } else if (result.type === 'group') {
                // Check premium access
                if (result.is_premium && !isPremium) {
                    navigate('/upgrade');
                } else {
                    navigate(`/classrooms/${result.slug}`);
                }
            }
        },
        [navigate, isPremium, onClose]
    );

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsDropdownOpen(false);
                inputRef.current?.blur();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            debouncedSearch.cancel();
        };
    }, [debouncedSearch]);

    // Auto focus if requested
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    return (
        <div className={`relative ${className}`}>
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 dark:text-surface-500" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => query.trim().length >= 2 && setIsDropdownOpen(true)}
                    placeholder={placeholder}
                    className="w-full pl-10 pr-10 py-2 bg-surface-100 dark:bg-surface-800 border-0 rounded-lg text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:bg-white dark:focus:bg-surface-700 focus:ring-2 focus:ring-primary-500"
                    autoFocus={autoFocus}
                    name='global-search'
                />
                {/* Loading indicator or clear button */}
                {isSearching ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 animate-spin" />
                ) : query.length > 0 ? (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                    >
                        <X className="w-4 h-4" />
                    </button>
                ) : null}
            </div>

            {/* Search Results Dropdown */}
            {isDropdownOpen && query.trim().length >= 2 && (
                <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-elevated z-50 max-h-[70vh] overflow-y-auto"
                >
                    {isSearching && !hasResults ? (
                        <div className="p-4 text-center text-surface-500">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                            <span className="text-sm">Searching...</span>
                        </div>
                    ) : !hasResults ? (
                        <div className="p-4 text-center text-surface-500 text-sm">
                            No results found for "{query}"
                        </div>
                    ) : (
                        <div className="py-2">
                            {/* Users Section */}
                            {results.users.length > 0 && (
                                <div>
                                    <div className="px-3 py-1.5 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                                        Members
                                    </div>
                                    {results.users.map((user) => (
                                        <UserResult
                                            key={user.id}
                                            user={user}
                                            onClick={() => handleResultClick(user)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Posts Section */}
                            {results.posts.length > 0 && (
                                <div>
                                    {results.users.length > 0 && (
                                        <div className="border-t border-surface-100 dark:border-surface-700 my-1" />
                                    )}
                                    <div className="px-3 py-1.5 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                                        Posts
                                    </div>
                                    {results.posts.map((post) => (
                                        <PostResult
                                            key={post.id}
                                            post={post}
                                            onClick={() => handleResultClick(post)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Groups Section */}
                            {results.groups.length > 0 && (
                                <div>
                                    {(results.users.length > 0 || results.posts.length > 0) && (
                                        <div className="border-t border-surface-100 dark:border-surface-700 my-1" />
                                    )}
                                    <div className="px-3 py-1.5 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                                        Classrooms
                                    </div>
                                    {results.groups.map((group) => (
                                        <GroupResult
                                            key={group.id}
                                            group={group}
                                            isPremium={isPremium}
                                            onClick={() => handleResultClick(group)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// User Result Item
function UserResult({
    user,
    onClick,
}: {
    user: SearchResultUser;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors text-left"
        >
            <div className="relative flex-shrink-0">
                {user.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt={user.display_name}
                        className="w-8 h-8 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                )}
                {user.is_online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-surface-800 rounded-full" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                    {user.display_name}
                </div>
                <div className="text-xs text-surface-500 dark:text-surface-400 truncate">
                    @{user.username}
                </div>
            </div>
        </button>
    );
}

// Post Result Item
function PostResult({
    post,
    onClick,
}: {
    post: SearchResultPost;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-start gap-3 px-3 py-2 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors text-left"
        >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
                <FileText className="w-4 h-4 text-surface-500 dark:text-surface-400" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                    {post.title || truncateText(post.content, 50)}
                </div>
                <div className="text-xs text-surface-500 dark:text-surface-400 truncate flex items-center gap-1">
                    <span>by {post.author.display_name}</span>
                    {post.group_name && (
                        <>
                            <span>in</span>
                            <span className="font-medium">{post.group_name}</span>
                            {post.group_is_premium && (
                                <Crown className="w-3 h-3 text-amber-500" />
                            )}
                        </>
                    )}
                </div>
            </div>
        </button>
    );
}

// Group Result Item
function GroupResult({
    group,
    isPremium,
    onClick,
}: {
    group: SearchResultGroup;
    isPremium: boolean;
    onClick: () => void;
}) {
    const isLocked = group.is_premium && !isPremium;

    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors text-left"
        >
            <div className="relative flex-shrink-0">
                {group.avatar_url ? (
                    <img
                        src={group.avatar_url}
                        alt={group.name}
                        className="w-8 h-8 rounded-lg object-cover"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                )}
                {group.is_premium && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                        <Crown className="w-2.5 h-2.5 text-white" />
                    </span>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate flex items-center gap-1.5">
                    {group.name}
                    {isLocked && (
                        <span className="text-xs font-normal text-amber-600 dark:text-amber-400">
                            (Premium)
                        </span>
                    )}
                </div>
                <div className="text-xs text-surface-500 dark:text-surface-400 truncate">
                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                    {group.description && ` • ${truncateText(group.description, 40)}`}
                </div>
            </div>
        </button>
    );
}
