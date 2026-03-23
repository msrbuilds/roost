import { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { searchUsers } from '../../services/message';
import type { Profile } from '../../types/database';
import debounce from 'lodash/debounce';
import OnlineIndicator from '../common/OnlineIndicator';

interface UserSearchInputProps {
  onUserSelect: (user: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'membership_type'>) => void;
  placeholder?: string;
}

export default function UserSearchInput({ onUserSelect, placeholder = 'Search users...' }: UserSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'membership_type'>[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (searchQuery: string) => {
        if (searchQuery.trim().length < 2) {
          setResults([]);
          setIsSearching(false);
          return;
        }

        setIsSearching(true);
        try {
          const users = await searchUsers(searchQuery);
          setResults(users);
        } catch (error) {
          console.error('Error searching users:', error);
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300),
    []
  );

  useEffect(() => {
    if (query) {
      debouncedSearch(query);
    } else {
      setResults([]);
      setIsSearching(false);
    }

    return () => {
      debouncedSearch.cancel();
    };
  }, [query, debouncedSearch]);

  const handleUserSelect = (user: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'membership_type'>) => {
    onUserSelect(user);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 bg-surface-50 border border-surface-200 rounded-lg text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search results dropdown */}
      {showResults && (query.length >= 2 || isSearching) && (
        <>
          {/* Backdrop to close dropdown */}
          <div className="fixed inset-0 z-10" onClick={() => setShowResults(false)} />

          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-elevated z-20 max-h-80 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-sm text-surface-500">
                {query.length < 2 ? 'Type at least 2 characters to search' : 'No users found'}
              </div>
            ) : (
              <div className="py-1">
                {results.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-surface-50 transition-colors text-left"
                  >
                    <div className="relative flex-shrink-0">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.display_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-semibold">
                          {user.display_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0">
                        <OnlineIndicator isOnline={user.is_online ?? false} size="sm" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-surface-900 truncate">
                        {user.display_name}
                      </p>
                      <p className="text-sm text-surface-500 truncate">
                        @{user.username}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
