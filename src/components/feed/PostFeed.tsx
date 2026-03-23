import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { PostWithDetails, getPosts, getCategories, getUserReactionsForItems, deletePost as deletePostService, togglePinPost, getPostById, supabase } from '@/services';
import { toggleFollow, getFollowedUserIds, getFollowStatusForUsers } from '@/services/follow';
import { cacheInvalidate } from '@/lib/cache';
import { Category, ReactionType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import PostCard from './PostCard';
import CategoryFilter, { SortOption } from './CategoryFilter';
import CreatePostModal from './CreatePostModal';
import { Loader2, Compass, UserPlus, ChevronUp, ChevronLeft, ChevronRight, Pin } from 'lucide-react';

// ── Module-level feed state cache ──
// Persists feed data across component unmounts during SPA navigation
// so navigating away and back doesn't trigger a full reload.
interface FeedCacheEntry {
    posts: PostWithDetails[];
    userReactions: Map<string, ReactionType>;
    followedAuthors: Set<string>;
    offset: number;
    hasMore: boolean;
    timestamp: number;
}

const feedCache = new Map<string, FeedCacheEntry>();
const FEED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getFeedCacheKey(feedMode: string, groupId?: string | null): string {
    return `feed:${feedMode}:${groupId ?? 'general'}`;
}

// Lightweight offscreen wrapper: unmounts PostCard when far off-screen to reduce DOM size
function OffscreenPostCard(props: React.ComponentProps<typeof PostCard>) {
    const { ref, inView } = useInView({
        rootMargin: '400px',
        triggerOnce: false,
    });

    return (
        <div ref={ref} style={!inView ? { minHeight: '200px' } : undefined}>
            {inView ? <PostCard {...props} /> : null}
        </div>
    );
}

interface PostFeedProps {
    groupId?: string | null;
    feedMode?: 'home' | 'explore' | 'group';
}

const POSTS_PER_PAGE = 10;

export default function PostFeed({
    groupId,
    feedMode = 'group',
}: PostFeedProps) {
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    // Check for cached feed state on initial render
    const cacheKey = getFeedCacheKey(feedMode, groupId);
    const cachedFeed = feedCache.get(cacheKey);
    const hasFreshCache = cachedFeed && (Date.now() - cachedFeed.timestamp < FEED_CACHE_TTL);

    const [posts, setPosts] = useState<PostWithDetails[]>(hasFreshCache ? cachedFeed.posts : []);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [adminOnly, setAdminOnly] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const [userReactions, setUserReactions] = useState<Map<string, ReactionType>>(hasFreshCache ? cachedFeed.userReactions : new Map());
    const [isLoading, setIsLoading] = useState(!hasFreshCache);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(hasFreshCache ? cachedFeed.hasMore : true);
    const [offset, setOffset] = useState(hasFreshCache ? cachedFeed.offset : 0);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const [followedAuthors, setFollowedAuthors] = useState<Set<string>>(hasFreshCache ? cachedFeed.followedAuthors : new Set());

    // Pending posts buffer: real-time new posts accumulate here instead of auto-prepending
    const [pendingPosts, setPendingPosts] = useState<PostWithDetails[]>([]);

    // Pinned carousel state
    const [pinnedSlide, setPinnedSlide] = useState(0);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<PostWithDetails | null>(null);

    // Fetch categories on mount
    useEffect(() => {
        const loadCategories = async () => {
            const cats = await getCategories(groupId ?? undefined);
            setCategories(cats);
        };
        loadCategories();
    }, [groupId]);

    // Fetch posts
    const loadPosts = useCallback(async (reset = false) => {
        const newOffset = reset ? 0 : offset;

        if (reset) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }

        try {
            // For home feed, get followed user IDs to filter posts
            let followedUserIds: string[] | undefined;
            if (feedMode === 'home' && user) {
                const followed = await getFollowedUserIds(user.id);
                // Include current user's own posts
                followedUserIds = [...followed, user.id];
            }

            const { posts: newPosts, hasMore: more } = await getPosts(groupId, {
                limit: POSTS_PER_PAGE,
                offset: newOffset,
                categoryId: selectedCategoryId || undefined,
                adminOnly,
                sortBy,
                followedUserIds,
                pinnedFirst: feedMode !== 'explore',
            });

            if (reset) {
                setPosts(newPosts);
                setOffset(POSTS_PER_PAGE);
            } else {
                setPosts((prev) => [...prev, ...newPosts]);
                setOffset((prev) => prev + POSTS_PER_PAGE);
            }
            setHasMore(more);

            // Fetch user reactions and follow statuses for these posts
            if (user && newPosts.length > 0) {
                const postIds = newPosts.map((p) => p.id);
                const reactions = await getUserReactionsForItems(user.id, 'post', postIds);
                setUserReactions((prev) => {
                    const updated = new Map(prev);
                    reactions.forEach((value, key) => updated.set(key, value));
                    return updated;
                });

                // Batch fetch follow statuses for all unique authors
                const authorIds = [...new Set(newPosts.map(p => p.author.id).filter(id => id !== user.id))];
                if (authorIds.length > 0) {
                    const followStatuses = await getFollowStatusForUsers(user.id, authorIds);
                    setFollowedAuthors(prev => {
                        const updated = new Set(prev);
                        // Add followed authors
                        followStatuses.forEach(id => updated.add(id));
                        // Remove unfollowed authors that were in this batch
                        authorIds.forEach(id => {
                            if (!followStatuses.has(id)) {
                                updated.delete(id);
                            }
                        });
                        return updated;
                    });
                }
            }
        } catch (error) {
            console.error('Error loading posts:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [groupId, feedMode, offset, selectedCategoryId, adminOnly, sortBy, user]);

    // Track whether this is the initial mount (to skip reload if cache is fresh)
    const isInitialMount = useRef<boolean>(true);

    // Load posts on mount and when filters change
    useEffect(() => {
        // On first mount with a fresh cache and default filters, skip the fetch
        if (isInitialMount.current && hasFreshCache && !selectedCategoryId && !adminOnly && sortBy === 'newest') {
            isInitialMount.current = false;
            return;
        }
        isInitialMount.current = false;
        // Clear pending posts when filters change or fresh load
        setPendingPosts([]);
        loadPosts(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId, selectedCategoryId, adminOnly, sortBy]);

    // Real-time subscription
    useEffect(() => {
        // Channel name and filter setup
        // undefined groupId = all posts (home feed)
        // null groupId = general posts only (no group)
        // string groupId = specific group posts
        let channelName: string;
        let filter: string | undefined;

        if (groupId === undefined) {
            channelName = 'posts-all';
            filter = undefined; // No filter - listen to all posts
        } else if (groupId === null) {
            channelName = 'posts-general';
            filter = 'group_id=is.null';
        } else {
            channelName = `posts-group-${groupId}`;
            filter = `group_id=eq.${groupId}`;
        }

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'posts',
                    ...(filter && { filter }),
                },
                async (payload) => {
                    const newPostId = payload.new.id;
                    // Fetch full post details (with author, counts, etc.)
                    const post = await getPostById(newPostId);
                    if (post) {
                        // For home feed, only show posts from followed users, admin/mods, or self
                        if (feedMode === 'home' && user) {
                            const authorRole = post.author.role;
                            const isAdminMod = authorRole && ['admin', 'superadmin', 'moderator'].includes(authorRole);
                            const isFollowed = followedAuthors.has(post.author.id);
                            const isOwnPost = post.author_id === user.id;
                            if (!isFollowed && !isAdminMod && !isOwnPost) return;
                        }
                        // Own posts: prepend immediately. Others: buffer for "Show X new posts" banner
                        if (post.author_id === user?.id) {
                            setPosts((prev) => [post, ...prev]);
                        } else {
                            setPendingPosts((prev) => {
                                // Deduplicate
                                if (prev.some(p => p.id === post.id)) return prev;
                                return [post, ...prev];
                            });
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'posts',
                    ...(filter && { filter }),
                },
                async (payload) => {
                    const updatedPostId = payload.new.id;
                    const updatedPost = await getPostById(updatedPostId);
                    if (updatedPost) {
                        setPosts((prev) =>
                            prev.map((p) => (p.id === updatedPostId ? updatedPost : p))
                        );
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'posts',
                    ...(filter && { filter }),
                },
                (payload) => {
                    const deletedId = payload.old.id;
                    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
                    // Also remove from pending buffer if it was there
                    setPendingPosts((prev) => prev.filter((p) => p.id !== deletedId));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId, feedMode, user?.id]);

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
                    loadPosts(false);
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, isLoading, loadPosts]);

    const handleCategoryChange = (categoryId: string | null) => {
        setAdminOnly(false);
        setSelectedCategoryId(categoryId);
    };

    const handleToggleAdminOnly = () => {
        setAdminOnly((prev) => !prev);
        setSelectedCategoryId(null);
    };

    const handleSortChange = (sort: SortOption) => {
        setSortBy(sort);
    };

    const handleEditPost = useCallback((post: PostWithDetails) => {
        setEditingPost(post);
        setIsModalOpen(true);
    }, []);

    const handleDeletePost = useCallback(async (postId: string) => {
        if (!window.confirm('Are you sure you want to delete this post?')) return;

        try {
            await deletePostService(postId);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
        } catch (error) {
            console.error('Error deleting post:', error);
            alert('Failed to delete post. Please try again.');
        }
    }, []);

    const handlePinPost = useCallback(async (postId: string) => {
        try {
            const updatedPost = await togglePinPost(postId);
            setPosts((prev) =>
                prev.map((p) => (p.id === postId ? { ...p, is_pinned: updatedPost.is_pinned } : p))
            );
            loadPosts(true);
        } catch (error) {
            console.error('Error toggling pin:', error);
            alert('Failed to pin/unpin post. Please try again.');
        }
    }, [loadPosts]);

    const handleFollowToggle = useCallback(async (authorId: string) => {
        if (!user) return;

        const wasFollowing = followedAuthors.has(authorId);

        // Optimistic update
        setFollowedAuthors(prev => {
            const updated = new Set(prev);
            if (wasFollowing) {
                updated.delete(authorId);
            } else {
                updated.add(authorId);
            }
            return updated;
        });

        try {
            await toggleFollow(user.id, authorId);
            cacheInvalidate(`follows:${user.id}`);
        } catch (error) {
            // Revert on failure
            setFollowedAuthors(prev => {
                const reverted = new Set(prev);
                if (wasFollowing) {
                    reverted.add(authorId);
                } else {
                    reverted.delete(authorId);
                }
                return reverted;
            });
            console.error('Error toggling follow:', error);
        }
    }, [user, followedAuthors]);

    // Merge pending posts into the feed when user clicks the banner
    const showPendingPosts = useCallback(() => {
        setPosts((prev) => {
            const existingIds = new Set(prev.map(p => p.id));
            const newPosts = pendingPosts.filter(p => !existingIds.has(p.id));
            return [...newPosts, ...prev];
        });
        setPendingPosts([]);
        // Scroll to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [pendingPosts]);

    // Save feed state to module-level cache on unmount
    useEffect(() => {
        return () => {
            // Only cache if we have posts (don't cache empty states)
            if (posts.length > 0) {
                feedCache.set(cacheKey, {
                    posts,
                    userReactions,
                    followedAuthors,
                    offset,
                    hasMore,
                    timestamp: Date.now(),
                });
            }
        };
    // Save on unmount only — we capture latest values via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [posts, userReactions, followedAuthors, offset, hasMore, cacheKey]);

    const handleSuccess = () => {
        loadPosts(true);
    };

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="space-y-6">
                <CategoryFilter
                    categories={categories}
                    selectedCategoryId={selectedCategoryId}
                    onSelectCategory={handleCategoryChange}
                    adminOnly={adminOnly}
                    onToggleAdminOnly={handleToggleAdminOnly}
                    sortBy={sortBy}
                    onSortChange={handleSortChange}
                />
                {[1, 2, 3].map((i) => (
                    <div key={i} className="card p-6 animate-pulse shadow-none">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-surface-200 rounded-full" />
                            <div className="space-y-2">
                                <div className="w-24 h-4 bg-surface-200 rounded" />
                                <div className="w-16 h-3 bg-surface-200 rounded" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="w-full h-4 bg-surface-200 rounded" />
                            <div className="w-3/4 h-4 bg-surface-200 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Create post trigger */}
            <div className="card p-4 shadow-none">
                <div className="flex items-center gap-3">
                    {profile?.avatar_url ? (
                        <img
                            src={profile.avatar_url}
                            alt={profile.display_name}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                    ) : null}
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium ${profile?.avatar_url ? 'hidden' : ''}`}>
                        {profile?.display_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex-1 text-left px-4 py-2.5 bg-surface-100 dark:bg-surface-800 rounded-lg text-surface-400 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                    >
                        Write something...
                    </button>
                </div>
            </div>

            {/* Category filter */}
            {categories.length > 0 && (
                <CategoryFilter
                    categories={categories}
                    selectedCategoryId={selectedCategoryId}
                    onSelectCategory={handleCategoryChange}
                    adminOnly={adminOnly}
                    onToggleAdminOnly={handleToggleAdminOnly}
                    sortBy={sortBy}
                    onSortChange={handleSortChange}
                />
            )}

            {/* "Show new posts" banner — Twitter-style */}
            {pendingPosts.length > 0 && (
                <button
                    onClick={showPendingPosts}
                    className="w-full py-3 px-4 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400
                        text-sm font-medium rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30
                        transition-colors flex items-center justify-center gap-2 border border-primary-200 dark:border-primary-800"
                >
                    <ChevronUp className="w-4 h-4" />
                    Show {pendingPosts.length} new {pendingPosts.length === 1 ? 'post' : 'posts'}
                </button>
            )}

            {/* Posts list */}
            {(() => {
                // Separate pinned posts for carousel on home/group feeds
                const showPinnedCarousel = feedMode !== 'explore';
                const pinnedPosts = showPinnedCarousel
                    ? posts.filter(p => p.is_pinned).sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
                    : [];
                const regularPosts = showPinnedCarousel ? posts.filter(p => !p.is_pinned) : posts;
                const totalSlides = Math.ceil(pinnedPosts.length / 2);

                // Clamp slide index if pinned posts change
                const currentSlide = Math.min(pinnedSlide, Math.max(0, totalSlides - 1));

                const allEmpty = posts.length === 0;

                return (
                    <>
                        {/* Pinned posts carousel */}
                        {pinnedPosts.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-medium text-surface-500 dark:text-surface-400">
                                        <Pin className="w-4 h-4" />
                                        <span>Pinned Posts</span>
                                    </div>
                                    {totalSlides > 1 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setPinnedSlide(Math.max(0, currentSlide - 1))}
                                                disabled={currentSlide === 0}
                                                className="p-1 rounded-full border border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <span className="text-xs text-surface-400 dark:text-surface-500 tabular-nums">
                                                {currentSlide + 1} / {totalSlides}
                                            </span>
                                            <button
                                                onClick={() => setPinnedSlide(Math.min(totalSlides - 1, currentSlide + 1))}
                                                disabled={currentSlide >= totalSlides - 1}
                                                className="p-1 rounded-full border border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="overflow-hidden">
                                    <div
                                        className="flex transition-transform duration-300 ease-in-out"
                                        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                                    >
                                        {Array.from({ length: totalSlides }).map((_, slideIdx) => {
                                            const slidePosts = pinnedPosts.slice(slideIdx * 2, slideIdx * 2 + 2);
                                            return (
                                                <div key={slideIdx} className="w-full flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {slidePosts.map((post) => (
                                                        <PostCard
                                                            key={post.id}
                                                            post={post}
                                                            userReaction={userReactions.get(post.id)}
                                                            isFollowingAuthor={followedAuthors.has(post.author.id)}
                                                            onFollowToggle={handleFollowToggle}
                                                            onEdit={handleEditPost}
                                                            onDelete={handleDeletePost}
                                                            onPin={handlePinPost}
                                                            onClick={() => navigate(`/post/${post.id}`)}
                                                        />
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Regular posts */}
                        {allEmpty ? (
                            feedMode === 'home' ? (
                                <div className="card p-12 text-center shadow-none">
                                    <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <UserPlus className="w-8 h-8 text-primary-500" />
                                    </div>
                                    <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">Your feed is empty</h3>
                                    <p className="text-surface-500 dark:text-surface-400 mb-4">
                                        Follow community members to see their posts here. Admin and moderator posts will always appear.
                                    </p>
                                    <Link
                                        to="/explore"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                                    >
                                        <Compass className="w-4 h-4" />
                                        Explore Posts
                                    </Link>
                                </div>
                            ) : (
                                <div className="card p-12 text-center shadow-none">
                                    <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg
                                            className="w-8 h-8 text-surface-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                            />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-surface-900 mb-2">No posts yet</h3>
                                    <p className="text-surface-500 mb-4">
                                        Be the first to share something with the community!
                                    </p>
                                </div>
                            )
                        ) : regularPosts.length > 0 ? (
                            <div className="space-y-4">
                                {regularPosts.map((post, index) => {
                                    // First 3 posts render eagerly (above the fold), rest use offscreen pattern
                                    const Card = index < 3 ? PostCard : OffscreenPostCard;
                                    return (
                                        <Card
                                            key={post.id}
                                            post={post}
                                            userReaction={userReactions.get(post.id)}
                                            isFollowingAuthor={followedAuthors.has(post.author.id)}
                                            onFollowToggle={handleFollowToggle}
                                            onEdit={handleEditPost}
                                            onDelete={handleDeletePost}
                                            onPin={handlePinPost}
                                            onClick={() => navigate(`/post/${post.id}`)}
                                        />
                                    );
                                })}
                            </div>
                        ) : null}
                    </>
                );
            })()}

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="py-4">
                {isLoadingMore && (
                    <div className="flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <CreatePostModal
                isOpen={isModalOpen}
                groupId={groupId}
                editingPost={editingPost}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingPost(null);
                }}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
