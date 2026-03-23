import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import {
    MessageCircle,
    MoreHorizontal,
    Pin,
    Edit2,
    Trash2,
    Heart,
    Flame,
    ThumbsUp,
    Hand,
    Brain,
    Laugh,
    Expand,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import DOMPurify from 'dompurify';
import { PostWithDetails, getPostAssets } from '@/services';
import { ReactionType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toggleReaction } from '@/services/reaction';
import { Asset } from '@/services/asset';
import { MediaGallery, VideoEmbed, detectVideoLinks } from './';
import CommentSection from './CommentSection';
import ReactorListModal from './ReactorListModal';
import { ProBadge, RoleBadge } from '@/components/common/ProBadge';
import { getRtlClass } from '@/lib/rtl';

// Configure DOMPurify for safe HTML rendering
const ALLOWED_TAGS = [
    'p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'strike',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'span', 'div',
];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];
const FORBID_TAGS = ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'];
const FORBID_ATTR = ['onerror', 'onclick', 'onload', 'onmouseover'];

interface PostCardProps {
    post: PostWithDetails;
    userReaction?: ReactionType | null;
    onReactionChange?: () => void;
    onEdit?: (post: PostWithDetails) => void;
    onDelete?: (postId: string) => void;
    onPin?: (postId: string) => void;
    onClick?: () => void;
    isFollowingAuthor?: boolean;
    onFollowToggle?: (authorId: string) => void;
}

const reactionIcons: Record<ReactionType, { icon: typeof Heart; label: string; color: string; bgColor: string }> = {
    like: { icon: ThumbsUp, label: 'Like', color: 'text-blue-500', bgColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/30' },
    love: { icon: Heart, label: 'Love', color: 'text-red-500', bgColor: 'hover:bg-red-50 dark:hover:bg-red-900/30' },
    fire: { icon: Flame, label: 'Fire', color: 'text-orange-500', bgColor: 'hover:bg-orange-50 dark:hover:bg-orange-900/30' },
    clap: { icon: Hand, label: 'Clap', color: 'text-yellow-500', bgColor: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/30' },
    think: { icon: Brain, label: 'Think', color: 'text-purple-500', bgColor: 'hover:bg-purple-50 dark:hover:bg-purple-900/30' },
    haha: { icon: Laugh, label: 'Haha', color: 'text-green-500', bgColor: 'hover:bg-green-50 dark:hover:bg-green-900/30' },
};

function PostCard({
    post,
    userReaction,
    onReactionChange,
    onEdit,
    onDelete,
    onPin,
    onClick,
    isFollowingAuthor,
    onFollowToggle,
}: PostCardProps) {
    const { user, profile } = useAuth();
    const [showMenu, setShowMenu] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const [currentReaction, setCurrentReaction] = useState<ReactionType | null>(userReaction || null);
    const [reactionCounts, setReactionCounts] = useState(post.reaction_counts);
    const [isReacting, setIsReacting] = useState(false);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [showComments, setShowComments] = useState(false);
    const [commentCount, setCommentCount] = useState(post.comment_count);
    const [isContentExpanded, setIsContentExpanded] = useState(false);
    const [isContentOverflowing, setIsContentOverflowing] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isLongPress, setIsLongPress] = useState(false);
    const [showReactorList, setShowReactorList] = useState(false);

    const isAuthor = user?.id === post.author_id;
    const isAdmin = !!profile?.role && ['admin', 'superadmin', 'moderator'].includes(profile.role);

    // Sanitize post content to prevent XSS attacks
    const sanitizedContent = useMemo(() => {
        let clean = DOMPurify.sanitize(post.content, {
            ALLOWED_TAGS,
            ALLOWED_ATTR,
            ALLOW_DATA_ATTR: false,
            FORBID_TAGS,
            FORBID_ATTR,
        });
        // Replace &nbsp; with regular spaces so the browser has normal word-break opportunities
        clean = clean.replace(/&nbsp;/g, ' ');
        // Remove <br> line breaks after dashes (unintentional from rich text editor)
        clean = clean.replace(/([-–—])\s*<br\s*\/?>\s*/gi, '$1 ');
        // Merge paragraph breaks that occur right after dashes
        clean = clean.replace(/([-–—])\s*<\/p>\s*<p[^>]*>\s*/gi, '$1 ');
        // Insert Word Joiner (U+2060) after dashes to prevent CSS line-break-after
        clean = clean.replace(/([–—])/g, '$1\u2060');
        return clean;
    }, [post.content]);

    // Video link detection
    const videoLinks = detectVideoLinks(post.content);

    // Fetch assets on mount or when post is updated
    useEffect(() => {
        getPostAssets(post.id).then(fetched => {
            setAssets(fetched);
        });
    }, [post.id, post.updated_at]);


    // Detect if content overflows the collapsed height
    const COLLAPSED_HEIGHT = 160; // ~6-7 lines
    useEffect(() => {
        if (contentRef.current) {
            setIsContentOverflowing(contentRef.current.scrollHeight > COLLAPSED_HEIGHT);
        }
    }, [sanitizedContent]);

    // Handle showing reaction picker with delay for hiding
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
        }, 200); // 200ms delay before hiding
    };

    // Long-press handlers for mobile
    const handleTouchStart = () => {
        setIsLongPress(false);
        longPressTimeoutRef.current = setTimeout(() => {
            setIsLongPress(true);
            setShowReactions(true);
            // Haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 500); // 500ms long-press duration
    };

    const handleTouchEnd = () => {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
    };

    const handleButtonClick = () => {
        // Prevent click action if it was a long-press
        if (isLongPress) {
            setIsLongPress(false);
            return;
        }
        handleReaction(currentReaction || 'like');
    };

    // Clean up timeouts on unmount
    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
            if (longPressTimeoutRef.current) {
                clearTimeout(longPressTimeoutRef.current);
            }
        };
    }, []);

    const handleReaction = async (type: ReactionType) => {
        if (!user || isReacting) return;

        setIsReacting(true);
        setShowReactions(false);

        // Capture previous state for rollback
        const prevReaction = currentReaction;
        const prevCounts = { ...reactionCounts };

        // Optimistically compute and apply new state immediately
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
            await toggleReaction(user.id, 'post', post.id, type);
            onReactionChange?.();
        } catch (error) {
            // Rollback on failure
            setReactionCounts(prevCounts);
            setCurrentReaction(prevReaction);
            console.error('Error toggling reaction:', error);
        } finally {
            setIsReacting(false);
        }
    };

    const ReactionIcon = currentReaction ? reactionIcons[currentReaction].icon : ThumbsUp;

    return (
        <article className="card p-6 shadow-none hover:shadow-elevated transition-shadow duration-200 relative">
            {/* Pinned indicator */}
            {post.is_pinned && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-3">
                    <Pin className="w-3 h-3" />
                    <span className="font-medium">Pinned</span>
                </div>
            )}

            {/* Header: Author info */}
            <div className="flex items-start justify-between gap-2 mb-4">
                <Link
                    to={`/profile/${post.author.username}`}
                    className="flex items-start gap-2 sm:gap-3 group min-w-0 flex-1"
                >
                    {post.author.avatar_url ? (
                        <img
                            src={post.author.avatar_url}
                            alt={post.author.display_name}
                            loading="lazy"
                            decoding="async"
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-transparent group-hover:ring-primary-200 dark:group-hover:ring-primary-700 transition-all flex-shrink-0"
                            onError={(e) => {
                                // Fallback to initial if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                    ) : null}
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium flex-shrink-0 ${post.author.avatar_url ? 'hidden' : ''}`}>
                        {post.author.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-sm sm:text-base text-surface-900 dark:text-surface-50 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                                {post.author.display_name}
                            </p>
                            {post.author.role && ['admin', 'superadmin', 'moderator'].includes(post.author.role)
                                ? <RoleBadge role={post.author.role} size="xs" />
                                : post.author.membership_type === 'premium' && <ProBadge size="xs" />
                            }
                            {!isAuthor && onFollowToggle && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onFollowToggle(post.author.id);
                                    }}
                                    className={`ml-0.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                                        isFollowingAuthor
                                            ? 'text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                                            : 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-800/40'
                                    }`}
                                >
                                    {isFollowingAuthor ? 'Following' : 'Follow'}
                                </button>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 text-xs text-surface-500 dark:text-surface-400">
                            <span className="truncate">@{post.author.username}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="whitespace-nowrap">
                                {formatDistanceToNow(new Date(post.created_at || Date.now()), { addSuffix: true })}
                                {post.is_edited && <span className="text-surface-400 dark:text-surface-500"> (edited)</span>}
                            </span>
                        </div>
                    </div>
                </Link>

                {/* Actions: View details and Menu */}
                <div className="absolute top-2 right-2 md:relative flex items-center gap-1 flex-shrink-0">
                    {/* View post details button */}
                    {onClick && (
                        <button
                            onClick={onClick}
                            className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors"
                            title="View post"
                        >
                            <Expand className="w-5 h-5 text-surface-400" />
                        </button>
                    )}

                    {/* Menu */}
                    {(isAuthor || isAdmin) && (
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors"
                            >
                                <MoreHorizontal className="w-5 h-5 text-surface-400" />
                            </button>

                            {showMenu && (
                                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-surface-800 rounded-lg shadow-lg border border-surface-200 dark:border-surface-700 py-1 z-10">
                                    {isAdmin && (
                                        <button
                                            onClick={() => {
                                                onPin?.(post.id);
                                                setShowMenu(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700"
                                        >
                                            <Pin className="w-4 h-4" />
                                            {post.is_pinned ? 'Unpin' : 'Pin'}
                                        </button>
                                    )}
                                    {isAuthor && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    onEdit?.(post);
                                                    setShowMenu(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => {
                                                    onDelete?.(post.id);
                                                    setShowMenu(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Category badge */}
            {post.category && (
                <div className="mb-3">
                    <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: post.category.color ?? '#gray' }}
                    >
                        {post.category.name}
                    </span>
                </div>
            )}

            {/* Content */}
            <div className="prose prose-surface dark:prose-invert max-w-none mb-4">
                {post.title && (
                    <h3 className={`text-lg font-semibold text-surface-900 dark:text-surface-50 mb-2 ${getRtlClass(post.title)}`}>{post.title}</h3>
                )}
                <div className="relative">
                    <div
                        ref={contentRef}
                        className={`text-surface-700 dark:text-surface-300 post-content text-[16px] md:text-base ${getRtlClass(post.content)} ${!isContentExpanded && isContentOverflowing ? 'overflow-hidden' : ''}`}
                        style={!isContentExpanded && isContentOverflowing ? { maxHeight: COLLAPSED_HEIGHT } : undefined}
                        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                    />
                    {isContentOverflowing && !isContentExpanded && (
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-surface-900 to-transparent pointer-events-none" />
                    )}
                </div>
                {isContentOverflowing && (
                    <button
                        onClick={() => setIsContentExpanded(!isContentExpanded)}
                        className="mt-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                    >
                        {isContentExpanded ? 'See less' : 'See more'}
                    </button>
                )}
            </div>

            {/* Video Embeds */}
            {videoLinks.map((link) => (
                <VideoEmbed key={link} url={link} />
            ))}

            {/* Media Gallery */}
            <MediaGallery assets={assets} />

            {/* Reaction Summary */}
            {reactionCounts.total > 0 && (
                <button
                    onClick={() => setShowReactorList(true)}
                    className="flex items-center gap-2 mt-3 pb-2 group cursor-pointer"
                >
                    <div className="flex -space-x-1">
                        {Object.entries(reactionIcons).map(([type, { icon: Icon, color }]) => {
                            const count = reactionCounts[type as ReactionType];
                            if (count === 0) return null;
                            return (
                                <div
                                    key={type}
                                    className="w-6 h-6 rounded-full bg-white dark:bg-surface-800 border-2 border-white dark:border-surface-900 flex items-center justify-center"
                                    title={`${reactionIcons[type as ReactionType].label}: ${count}`}
                                >
                                    <Icon className={`w-4 h-4 ${color}`} />
                                </div>
                            );
                        })}
                    </div>
                    <span className="text-sm text-surface-500 dark:text-surface-400 group-hover:text-surface-700 dark:group-hover:text-surface-200 transition-colors">
                        {reactionCounts.total} {reactionCounts.total === 1 ? 'reaction' : 'reactions'}
                    </span>
                </button>
            )}

            {/* Actions bar */}
            <div className="flex items-center gap-4 pt-4 border-t border-surface-100 dark:border-surface-800 mt-4">
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
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                            transition-all duration-200 border
                            ${currentReaction
                                ? `${reactionIcons[currentReaction].color} bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700`
                                : 'text-surface-500 border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                            }
                        `}
                        disabled={isReacting}
                    >
                        <ReactionIcon className="w-5 h-5" />
                        <span>{reactionCounts.total > 0 ? reactionCounts.total : 'React'}</span>
                    </button>

                    {/* Reaction picker popup */}
                    {showReactions && (
                        <div className="absolute bottom-full left-0 mb-0 pb-2">
                            <div className="flex gap-1 bg-white dark:bg-surface-800 rounded-full shadow-xl border border-surface-200 dark:border-surface-700 p-2">
                                {Object.entries(reactionIcons).map(([type, { icon: Icon, label, color, bgColor }]) => {
                                    const count = reactionCounts[type as ReactionType] || 0;
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => handleReaction(type as ReactionType)}
                                            title={`${label}${count > 0 ? ` (${count})` : ''}`}
                                            className={`
                                                relative p-1.5 rounded-full transition-all duration-200
                                                hover:scale-125 ${color} ${bgColor}
                                            `}
                                        >
                                            <Icon className="w-5 h-5" />
                                            {count > 0 && (
                                                <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
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

                {/* Comment button */}
                <button
                    onClick={() => setShowComments(!showComments)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors
                        ${showComments
                            ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800'
                            : 'text-surface-500 border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                        }`}
                >
                    <MessageCircle className="w-5 h-5" />
                    <span>{commentCount > 0 ? commentCount : 'Comment'}</span>
                </button>
            </div>

            {/* Comment Section */}
            {showComments && (
                <CommentSection
                    postId={post.id}
                    commentCount={commentCount}
                    isExpanded={true}
                    onCommentCountChange={setCommentCount}
                />
            )}

            {/* Reactor List Modal */}
            {showReactorList && (
                <ReactorListModal
                    onClose={() => setShowReactorList(false)}
                    reactableType="post"
                    reactableId={post.id}
                    reactionCounts={reactionCounts}
                />
            )}

            <style>{`
                .post-content h1 { font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; }
                .post-content h2 { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.5rem; }
                .post-content p { margin-bottom: 0.5rem; }
                .post-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.5rem; }
                .post-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.5rem; }
                .post-content a { color: #2563eb; text-decoration: underline; }
                .dark .post-content a { color: #60a5fa; }
            `}</style>
        </article>
    );
}

export default memo(PostCard, (prev, next) => {
    return (
        prev.post.id === next.post.id &&
        prev.post.updated_at === next.post.updated_at &&
        prev.post.is_pinned === next.post.is_pinned &&
        prev.post.comment_count === next.post.comment_count &&
        prev.post.reaction_counts.total === next.post.reaction_counts.total &&
        prev.userReaction === next.userReaction &&
        prev.isFollowingAuthor === next.isFollowingAuthor
    );
});
