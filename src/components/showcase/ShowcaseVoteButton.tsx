import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toggleVote } from '@/services/showcase';

interface ShowcaseVoteButtonProps {
    showcaseId: string;
    voteCount: number;
    hasVoted: boolean;
    onVoteChange?: (newCount: number, hasVoted: boolean) => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export default function ShowcaseVoteButton({
    showcaseId,
    voteCount,
    hasVoted,
    onVoteChange,
    size = 'md',
    className = '',
}: ShowcaseVoteButtonProps) {
    const { user } = useAuth();
    const [isVoting, setIsVoting] = useState(false);
    const [localVoteCount, setLocalVoteCount] = useState(voteCount);
    const [localHasVoted, setLocalHasVoted] = useState(hasVoted);

    const handleVote = async () => {
        if (!user || isVoting) return;

        setIsVoting(true);

        // Optimistic update
        const wasVoted = localHasVoted;
        const newVoteCount = wasVoted ? localVoteCount - 1 : localVoteCount + 1;
        setLocalHasVoted(!wasVoted);
        setLocalVoteCount(newVoteCount);

        try {
            const voted = await toggleVote(showcaseId, user.id);
            // Sync with server response
            setLocalHasVoted(voted);
            setLocalVoteCount(wasVoted ? voteCount - 1 : voteCount + 1);
            onVoteChange?.(voted ? voteCount + 1 : voteCount - 1, voted);
        } catch (error) {
            // Revert on error
            console.error('Error toggling vote:', error);
            setLocalHasVoted(wasVoted);
            setLocalVoteCount(voteCount);
        } finally {
            setIsVoting(false);
        }
    };

    // Large ProductHunt-style button - horizontal with icon, label, and count
    if (size === 'lg') {
        return (
            <button
                onClick={handleVote}
                disabled={!user || isVoting}
                className={`
                    flex items-center w-full justify-center gap-2 px-8 py-3 rounded-lg font-medium transition-all whitespace-nowrap
                    ${localHasVoted
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    }
                    ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}
                    ${!user ? 'opacity-50 cursor-not-allowed' : ''}
                    ${className}
                `}
                title={!user ? 'Sign in to vote' : localHasVoted ? 'Remove vote' : 'Upvote'}
            >
                <ChevronUp className="w-5 h-5 flex-shrink-0" />
                <span className="font-semibold">{localHasVoted ? 'Upvoted' : 'Upvote'}</span>
                <span className="font-semibold">·</span>
                <span className="font-semibold">{localVoteCount}</span>
            </button>
        );
    }

    // Standard horizontal button for sm and md
    const sizeClasses = {
        sm: 'px-2 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
    };

    const iconSizes = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
    };

    return (
        <button
            onClick={handleVote}
            disabled={!user || isVoting}
            className={`
                flex items-center w-full gap-2 rounded-lg border font-medium transition-all
                ${sizeClasses[size]}
                ${localHasVoted
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400'
                    : 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400'
                }
                ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}
                ${!user ? 'opacity-50 cursor-not-allowed' : ''}
                ${className}
            `}
            title={!user ? 'Sign in to vote' : localHasVoted ? 'Remove vote' : 'Upvote'}
        >
            <ChevronUp className={`${iconSizes[size]} ${localHasVoted ? 'text-primary-600 dark:text-primary-400' : ''}`} />
            <span className="font-semibold">{localVoteCount}</span>
        </button>
    );
}
