import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MessageCircle, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getPostById, PostWithDetails, getUserReactionsForItems } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { PostCard } from '@/components/feed';
import { LeaderboardCard } from '@/components/leaderboard';
import { CommunityMembersWidget } from '@/components/members/CommunityMembersWidget';
import { ReactionType } from '@/types';

export default function PostDetail() {
    const { postId } = useParams<{ postId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [post, setPost] = useState<PostWithDetails | null>(null);
    const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPost = useCallback(async () => {
        if (!postId) {
            setError('Post not found');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const [fetchedPost, reactions] = await Promise.all([
                getPostById(postId),
                user ? getUserReactionsForItems(user.id, 'post', [postId]) : Promise.resolve(new Map<string, ReactionType>()),
            ]);

            if (!fetchedPost) {
                setError('Post not found');
                return;
            }

            setPost(fetchedPost);
            setUserReaction(reactions.get(postId) || null);
        } catch (err) {
            console.error('Error fetching post:', err);
            setError('Failed to load post');
        } finally {
            setLoading(false);
        }
    }, [postId, user]);

    useEffect(() => {
        fetchPost();
    }, [fetchPost]);

    const handleReactionChange = () => {
        // Refetch post to get updated reaction counts
        fetchPost();
    };

    if (loading) {
        return (
            <div className="lg:mr-80">
                <div className="py-8 px-4 sm:px-6 lg:px-8">
                    <div className="animate-pulse space-y-6">
                        <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-32" />
                        <div className="card p-6 shadow-none space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-surface-200 dark:bg-surface-700 rounded-full" />
                                <div className="space-y-2">
                                    <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-32" />
                                    <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded w-24" />
                                </div>
                            </div>
                            <div className="h-6 bg-surface-200 dark:bg-surface-700 rounded w-3/4" />
                            <div className="space-y-2">
                                <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-full" />
                                <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-full" />
                                <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-2/3" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="lg:mr-80">
                <div className="py-8 px-4 sm:px-6 lg:px-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 mb-6 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Go back</span>
                    </button>
                    <div className="card p-8 shadow-none text-center">
                        <p className="text-surface-500 dark:text-surface-400 text-lg">
                            {error || 'Post not found'}
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-4 text-primary-600 dark:text-primary-400 hover:underline"
                        >
                            Return to feed
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Fixed Right Sidebar - hidden on mobile */}
            <div className="hidden lg:block fixed top-16 right-0 w-80 h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin p-4 space-y-6 bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-800">
                {/* Author card */}
                <div className="card p-6 shadow-none">
                    <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">Posted by</h3>
                    <Link
                        to={`/profile/${post.author.username}`}
                        className="flex items-center gap-3 group"
                    >
                        {post.author.avatar_url ? (
                            <img
                                src={post.author.avatar_url}
                                alt={post.author.display_name}
                                className="w-12 h-12 rounded-full object-cover ring-2 ring-transparent group-hover:ring-primary-200 dark:group-hover:ring-primary-700 transition-all"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium text-lg">
                                {post.author.display_name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <p className="font-medium text-surface-900 dark:text-surface-50 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                {post.author.display_name}
                            </p>
                            <p className="text-sm text-surface-500 dark:text-surface-400">
                                @{post.author.username}
                            </p>
                        </div>
                    </Link>
                    <Link
                        to={`/profile/${post.author.username}`}
                        className="mt-4 block w-full text-center px-4 py-2 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors text-sm font-medium"
                    >
                        View Profile
                    </Link>
                </div>

                {/* Post info card */}
                <div className="card p-6 shadow-none">
                    <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">Post Info</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
                            <Calendar className="w-4 h-4" />
                            <span>
                                {formatDistanceToNow(new Date(post.created_at || Date.now()), { addSuffix: true })}
                            </span>
                        </div>
                        {post.category && (
                            <div className="flex items-center gap-2">
                                <span
                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                                    style={{ backgroundColor: post.category.color ?? '#gray' }}
                                >
                                    {post.category.name}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
                            <MessageCircle className="w-4 h-4" />
                            <span>{post.comment_count} {post.comment_count === 1 ? 'comment' : 'comments'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
                            <Users className="w-4 h-4" />
                            <span>{post.reaction_counts.total} {post.reaction_counts.total === 1 ? 'reaction' : 'reactions'}</span>
                        </div>
                    </div>
                </div>

                {/* Leaderboard card */}
                <LeaderboardCard period={30} limit={5} title="Top Contributors" />

                {/* Community Members Widget */}
                <CommunityMembersWidget />
            </div>

            {/* Main content area - leaves space for fixed right sidebar on desktop */}
            <div className="lg:mr-80">
                <div className="py-8 px-4 sm:px-6 lg:px-8 space-y-6">
                    {/* Back navigation */}
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back</span>
                    </button>

                    {/* Post card with comments expanded by default */}
                    <PostCard
                        post={post}
                        userReaction={userReaction}
                        onReactionChange={handleReactionChange}
                    />
                </div>
            </div>
        </>
    );
}
