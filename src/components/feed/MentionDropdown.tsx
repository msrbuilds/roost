import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { searchUsers, SearchResultUser } from '@/services/search';

interface MentionDropdownProps {
    query: string;
    onSelect: (user: SearchResultUser) => void;
    onClose: () => void;
}

export default function MentionDropdown({ query, onSelect, onClose }: MentionDropdownProps) {
    const [results, setResults] = useState<SearchResultUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const search = useCallback(async (q: string) => {
        if (q.length < 1) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const users = await searchUsers(q, 6);
            setResults(users);
            setSelectedIndex(0);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => search(query), 300);
        return () => clearTimeout(timer);
    }, [query, search]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter' && results.length > 0) {
                e.preventDefault();
                onSelect(results[selectedIndex]);
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [results, selectedIndex, onSelect, onClose]);

    if (query.length < 1 && !isLoading) return null;

    return (
        <div
            ref={dropdownRef}
            className="absolute bottom-full left-0 mb-1 w-72 bg-white dark:bg-surface-800 rounded-lg shadow-elevated dark:shadow-elevated-dark border border-surface-200 dark:border-surface-700 z-50 overflow-hidden"
        >
            {isLoading ? (
                <div className="flex items-center justify-center p-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
                </div>
            ) : results.length === 0 ? (
                <div className="p-3 text-sm text-surface-500 dark:text-surface-400 text-center">
                    No users found
                </div>
            ) : (
                <div className="py-1 max-h-48 overflow-y-auto">
                    {results.map((user, index) => (
                        <button
                            key={user.id}
                            onClick={() => onSelect(user)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                                index === selectedIndex
                                    ? 'bg-primary-50 dark:bg-primary-900/20'
                                    : 'hover:bg-surface-50 dark:hover:bg-surface-700'
                            }`}
                        >
                            {user.avatar_url ? (
                                <img
                                    src={user.avatar_url}
                                    alt={user.display_name}
                                    className="w-7 h-7 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-medium">
                                    {user.display_name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                                    {user.display_name}
                                </p>
                                <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                                    @{user.username}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
