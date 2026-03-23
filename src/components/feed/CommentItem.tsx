import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
    MoreHorizontal,
    Edit2,
    Trash2,
    MessageCircle,
    ChevronDown,
    ChevronUp,
    Heart,
    ThumbsUp,
    Flame,
    Hand,
    Brain,
    Laugh,
} from 'lucide-react';
import { CommentWithAuthor } from '@/services';
import { ReactionType } from '@/types';
import type { ReactionCounts } from '@/services/reaction';
import type { VoteType, VoteCounts } from '@/services/commentVote';
import { useAuth } from '@/contexts/AuthContext';
import { toggleReaction } from '@/services/reaction';
import { toggleCommentVote } from '@/services/commentVote';
import CommentForm from './CommentForm';
import ReactorListModal from './ReactorListModal';
import { ProBadge, RoleBadge } from '@/components/common/ProBadge';
import { getRtlClass } from '@/lib/rtl';

interface CommentItemProps {
    comment: CommentWithAuthor;
    postId: string;
    userReaction?: ReactionType | null;
    userVote?: VoteType | null;
    onReply: (content: string, parentId: string) => Promise<void>;
    onEdit: (commentId: string, content: string) => Promise<void>;
    onDelete: (commentId: string) => Promise<void>;
    depth?: number;
    userReactionsMap?: Map<string, ReactionType>;
    userVotesMap?: Map<string, VoteType>;
}

const reactionIcons: Record<ReactionType, { icon: typeof Heart; label: string; color: string; bgColor: string }> = {
    like: { icon: ThumbsUp, label: 'Like', color: 'text-blue-500', bgColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/30' },
    love: { icon: Heart, label: 'Love', color: 'text-red-500', bgColor: 'hover:bg-red-50 dark:hover:bg-red-900/30' },
    fire: { icon: Flame, label: 'Fire', color: 'text-orange-500', bgColor: 'hover:bg-orange-50 dark:hover:bg-orange-900/30' },
    clap: { icon: Hand, label: 'Clap', color: 'text-yellow-500', bgColor: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/30' },
    think: { icon: Brain, label: 'Think', color: 'text-purple-500', bgColor: 'hover:bg-purple-50 dark:hover:bg-purple-900/30' },
    haha: { icon: Laugh, label: 'Haha', color: 'text-green-500', bgColor: 'hover:bg-green-50 dark:hover:bg-green-900/30' },
};

const DEFAULT_REACTION_COUNTS: ReactionCounts = { like: 0, love: 0, fire: 0, clap: 0, think: 0, haha: 0, total: 0 };

const MAX_DEPTH = 3;

function CommentItem({
    comment,
    postId,
    userReaction,
    userVote,
    onReply,
    onEdit,
    onDelete,
    depth = 0,
    userReactionsMap,
    userVotesMap,
}: CommentItemProps) {
    const { user } = useAuth();
    const [showMenu, setShowMenu] = useState(false);
    const [showReplies, setShowReplies] = useState(true);
    const [isReplying, setIsReplying] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentReaction, setCurrentReaction] = useState<ReactionType | null>(userReaction || null);
    const [reactionCounts, setReactionCounts] = useState<ReactionCounts>(comment.reaction_counts || DEFAULT_REACTION_COUNTS);
    const [isReacting, setIsReacting] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const [showReactorList, setShowReactorList] = useState(false);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isLongPress, setIsLongPress] = useState(false);

    // Vote state
    const [currentVote, setCurrentVote] = useState<VoteType | null>(userVote || null);
    const [voteCounts, setVoteCounts] = useState<VoteCounts>(comment.vote_counts || { upvotes: 0, downvotes: 0, score: 0 });
    const [isVoting, setIsVoting] = useState(false);

    const isAuthor = user?.id === comment.author_id;
    const hasReplies = comment.replies && comment.replies.length > 0;
    const canReply = depth < MAX_DEPTH;

    // Clean up timeouts on unmount
    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
        };
    }, []);

    // Reaction picker hover handlers
    const handleShowReactions = () => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setShowReactions(true);
    };

    const handleHideReactions = () => {
        hideTimeoutRef.current = setTimeout(() => {
            setShowReactions(false);
        }, 200);
    };

    // Mobile long-press
    const handleTouchStart = () => {
        setIsLongPress(false);
        longPressTimeoutRef.current = setTimeout(() => {
            setIsLongPress(true);
            setShowReactions(true);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    };

    const handleTouchEnd = () => {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
    };

    const handleButtonClick = () => {
        if (isLongPress) {
            setIsLongPress(false);
            return;
        }
        handleReaction(currentReaction || 'like');
    };

    const handleReaction = async (type: ReactionType) => {
        if (!user || isReacting) return;

        setIsReacting(true);
        setShowReactions(false);

        const prevReaction = currentReaction;
        const prevCounts = { ...reactionCounts };

        // Optimistic update
        const newCounts = { ...reactionCounts };
        if (currentReaction) {
            newCounts[currentReaction]--;
            newCounts.total--;
        }

        let optimisticReaction: ReactionType | null;
        if (currentReaction === type) {
            optimisticReaction = null;
        } else {
            newCounts[type]++;
            newCounts.total++;
            optimisticReaction = type;
        }

        setReactionCounts(newCounts);
        setCurrentReaction(optimisticReaction);

        try {
            await toggleReaction(user.id, 'comment', comment.id, type);
        } catch (error) {
            setReactionCounts(prevCounts);
            setCurrentReaction(prevReaction);
            console.error('Error toggling reaction:', error);
        } finally {
            setIsReacting(false);
        }
    };

    const handleVote = async (type: VoteType) => {
        if (!user || isVoting) return;

        setIsVoting(true);

        const prevVote = currentVote;
        const prevCounts = { ...voteCounts };

        // Optimistic update
        const newCounts = { ...voteCounts };
        if (currentVote === type) {
            // Remove vote
            if (type === 'up') newCounts.upvotes--;
            else newCounts.downvotes--;
            setCurrentVote(null);
        } else {
            // Remove old vote if exists
            if (currentVote === 'up') newCounts.upvotes--;
            else if (currentVote === 'down') newCounts.downvotes--;
            // Add new vote
            if (type === 'up') newCounts.upvotes++;
            else newCounts.downvotes++;
            setCurrentVote(type);
        }
        newCounts.score = newCounts.upvotes - newCounts.downvotes;
        setVoteCounts(newCounts);

        try {
            await toggleCommentVote(user.id, comment.id, type);
        } catch (error) {
            setCurrentVote(prevVote);
            setVoteCounts(prevCounts);
            console.error('Error toggling vote:', error);
        } finally {
            setIsVoting(false);
        }
    };

    const handleReplySubmit = async (content: string) => {
        await onReply(content, comment.id);
        setIsReplying(false);
    };

    const handleEditSubmit = async (content: string) => {
        await onEdit(comment.id, content);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this comment?')) {
            await onDelete(comment.id);
        }
    };

    const ReactionIcon = currentReaction ? reactionIcons[currentReaction].icon : ThumbsUp;

    // Parse @mentions
    const renderContentWithMentions = useMemo(() => (text: string) => {
        const parts = text.split(/(@\w+)/g);
        return parts.map((part, index) => {
            const mentionMatch = part.match(/^@(\w+)$/);
            if (mentionMatch) {
                const username = mentionMatch[1];
                return (
                    <Link
                        key={index}
                        to={`/profile/${username}`}
                        className="mention-link"
                        onClick={(e) => e.stopPropagation()}
                    >
                        @{username}
                    </Link>
                );
            }
            return part;
        });
    }, []);

    return (
        <div className={`${depth > 0 ? 'ml-8 pl-4 border-l-2 border-surface-100 dark:border-surface-800' : ''}`}>
            <div className="py-3">
                {/* Comment Header */}
                <div className="flex items-start justify-between">
                    <Link
                        to={`/profile/${comment.author.username}`}
                        className="flex items-center gap-2 group"
                    >
                        {comment.author.avatar_url ? (
                            <img
                                src={comment.author.avatar_url}
                                alt={comment.author.display_name}
                                loading="lazy"
                                decoding="async"
                                className="w-8 h-8 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-medium">
                                {comment.author.display_name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <span className="font-medium text-surface-900 dark:text-surface-50 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors text-sm">
                                {comment.author.display_name}
                            </span>
                            {comment.author.role && ['admin', 'superadmin', 'moderator'].includes(comment.author.role)
                                ? <RoleBadge role={comment.author.role} size="xs" className="ml-1.5" />
                                : comment.author.membership_type === 'premium' && <ProBadge size="xs" className="ml-1.5" />
                            }
                            <span className="text-xs text-surface-400 dark:text-surface-500 ml-2">
                                {formatDistanceToNow(new Date(comment.created_at || Date.now()), { addSuffix: true })}
                                {comment.is_edited && <span className="ml-1">(edited)</span>}
                            </span>
                        </div>
                    </Link>

                    {/* Menu */}
                    {isAuthor && (
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors"
                            >
                                <MoreHorizontal className="w-4 h-4 text-surface-400" />
                            </button>

                            {showMenu && (
                                <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-surface-800 rounded-lg shadow-lg border border-surface-200 dark:border-surface-700 py-1 z-10">
                                    <button
                                        onClick={() => {
                                            setIsEditing(true);
                                            setShowMenu(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleDelete();
                                            setShowMenu(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Comment Content */}
                {isEditing ? (
                    <div className="mt-2">
                        <CommentForm
                            onSubmit={handleEditSubmit}
                            initialValue={comment.content}
                            submitLabel="Save"
                            onCancel={() => setIsEditing(false)}
                            autoFocus
                            isReply
                        />
                    </div>
                ) : (
                    <p className={`mt-2 text-surface-700 dark:text-surface-300 text-sm whitespace-pre-wrap ${getRtlClass(comment.content)}`}>
                        {renderContentWithMentions(comment.content)}
                    </p>
                )}

                {/* Reaction Summary */}
                {reactionCounts.total > 0 && !isEditing && (
                    <button
                        onClick={() => setShowReactorList(true)}
                        className="flex items-center gap-1.5 mt-2 group cursor-pointer"
                    >
                        <div className="flex -space-x-1">
                            {(Object.keys(reactionIcons) as ReactionType[]).map((type) => {
                                if (reactionCounts[type] === 0) return null;
                                const { icon: Icon, color } = reactionIcons[type];
                                return (
                                    <div
                                        key={type}
                                        className="w-5 h-5 rounded-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center"
                                    >
                                        <Icon className={`w-3 h-3 ${color}`} />
                                    </div>
                                );
                            })}
                        </div>
                        <span className="text-xs text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300 transition-colors">
                            {reactionCounts.total}
                        </span>
                    </button>
                )}

                {/* Actions */}
                {!isEditing && (
                    <div className="flex items-center gap-3 mt-2">
                        {/* Reaction button with picker */}
                        <div
                            className="relative"
                            onMouseEnter={handleShowReactions}
                            onMouseLeave={handleHideReactions}
                        >
                            <button
                                onClick={handleButtonClick}
                                onTouchStart={handleTouchStart}
                                onTouchEnd={handleTouchEnd}
                                onTouchCancel={handleTouchEnd}
                                disabled={isReacting}
                                className={`flex items-center gap-1 text-xs transition-colors
                                    ${currentReaction
                                        ? `${reactionIcons[currentReaction].color}`
                                        : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                                    }`}
                            >
                                <ReactionIcon className="w-4 h-4" />
                                <span>{currentReaction ? reactionIcons[currentReaction].label : 'React'}</span>
                            </button>

                            {/* Reaction picker popup */}
                            {showReactions && (
                                <div className="absolute bottom-full left-0 mb-0 pb-1 z-20">
                                    <div className="flex gap-0.5 bg-white dark:bg-surface-800 rounded-full shadow-xl border border-surface-200 dark:border-surface-700 p-1.5">
                                        {(Object.entries(reactionIcons) as [ReactionType, typeof reactionIcons[ReactionType]][]).map(([type, { icon: Icon, label, color, bgColor }]) => {
                                            const count = reactionCounts[type] || 0;
                                            return (
                                                <button
                                                    key={type}
                                                    onClick={() => handleReaction(type)}
                                                    title={`${label}${count > 0 ? ` (${count})` : ''}`}
                                                    className={`
                                                        relative p-1 rounded-full transition-all duration-200
                                                        hover:scale-125 ${color} ${bgColor}
                                                    `}
                                                >
                                                    <Icon className="w-4 h-4" />
                                                    {count > 0 && (
                                                        <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                                                            {count > 9 ? '9+' : count}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Upvote/Downvote */}
                        <div className="flex items-center gap-0">
                            <button
                                onClick={() => handleVote('up')}
                                disabled={isVoting}
                                className={`p-0.5 rounded transition-colors ${
                                    currentVote === 'up'
                                        ? 'text-green-500'
                                        : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300'
                                }`}
                                title="Upvote"
                            >
                                <ChevronUp className="w-4 h-4" />
                            </button>
                            {(voteCounts.score !== 0) && (
                                <span className={`text-xs font-medium min-w-[1rem] text-center ${
                                    voteCounts.score > 0 ? 'text-green-600 dark:text-green-400' :
                                    voteCounts.score < 0 ? 'text-red-500 dark:text-red-400' :
                                    'text-surface-400'
                                }`}>
                                    {voteCounts.score}
                                </span>
                            )}
                            <button
                                onClick={() => handleVote('down')}
                                disabled={isVoting}
                                className={`p-0.5 rounded transition-colors ${
                                    currentVote === 'down'
                                        ? 'text-red-500'
                                        : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300'
                                }`}
                                title="Downvote"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        </div>

                        {canReply && (
                            <button
                                onClick={() => setIsReplying(!isReplying)}
                                className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
                            >
                                <MessageCircle className="w-4 h-4" />
                                Reply
                            </button>
                        )}

                        {hasReplies && (
                            <button
                                onClick={() => setShowReplies(!showReplies)}
                                className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                            >
                                {showReplies ? (
                                    <>
                                        <ChevronUp className="w-4 h-4" />
                                        Hide {comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="w-4 h-4" />
                                        Show {comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}

                {/* Reply Form */}
                {isReplying && (
                    <div className="mt-3">
                        <CommentForm
                            onSubmit={handleReplySubmit}
                            placeholder={`Reply to ${comment.author.display_name}...`}
                            onCancel={() => setIsReplying(false)}
                            autoFocus
                            isReply
                        />
                    </div>
                )}
            </div>

            {/* Reactor List Modal */}
            {showReactorList && (
                <ReactorListModal
                    onClose={() => setShowReactorList(false)}
                    reactableType="comment"
                    reactableId={comment.id}
                    reactionCounts={reactionCounts}
                />
            )}

            {/* Nested Replies */}
            {hasReplies && showReplies && (
                <div className="mt-1">
                    {comment.replies!.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            postId={postId}
                            userReaction={userReactionsMap?.get(reply.id) || null}
                            userVote={userVotesMap?.get(reply.id) || null}
                            onReply={onReply}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            depth={depth + 1}
                            userReactionsMap={userReactionsMap}
                            userVotesMap={userVotesMap}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default memo(CommentItem, (prev, next) => {
    return (
        prev.comment.id === next.comment.id &&
        prev.comment.content === next.comment.content &&
        prev.comment.is_edited === next.comment.is_edited &&
        prev.comment.reaction_counts?.total === next.comment.reaction_counts?.total &&
        prev.comment.vote_counts?.score === next.comment.vote_counts?.score &&
        prev.comment.replies?.length === next.comment.replies?.length &&
        prev.userReaction === next.userReaction &&
        prev.userVote === next.userVote &&
        prev.depth === next.depth
    );
});
