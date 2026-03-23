import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Loader2 } from 'lucide-react';
import {
    getComments,
    createComment,
    getRecordingComments,
    createRecordingComment,
    updateComment,
    deleteComment,
    supabase,
    CommentWithAuthor,
} from '@/services';
import { ReactionType } from '@/types';
import type { VoteType } from '@/services/commentVote';
import { useAuth } from '@/contexts/AuthContext';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';

interface CommentSectionProps {
    postId?: string;
    recordingId?: string;
    commentCount: number;
    isExpanded?: boolean;
    onCommentCountChange?: (count: number) => void;
}

export default function CommentSection({
    postId,
    recordingId,
    commentCount: initialCount,
    isExpanded = false,
    onCommentCountChange,
}: CommentSectionProps) {
    const targetId = postId || recordingId || '';
    const targetType = recordingId ? 'recording' : 'post';
    const { user, profile } = useAuth();
    const [comments, setComments] = useState<CommentWithAuthor[]>([]);
    const [userReactions, setUserReactions] = useState<Map<string, ReactionType>>(new Map());
    const [userVotes, setUserVotes] = useState<Map<string, VoteType>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(isExpanded);
    const [commentCount, setCommentCount] = useState(initialCount);
    const [hasMoreComments, setHasMoreComments] = useState(false);

    // Fetch comments (with user reactions and votes in a single parallel call)
    const loadComments = useCallback(async (showLoading = true, limit?: number) => {
        if (!isOpen || !targetId) return;

        if (showLoading) {
            setIsLoading(true);
        }
        try {
            const fetchFn = targetType === 'recording' ? getRecordingComments : getComments;
            const { comments: fetchedComments, hasMore, userReactions: fetchedReactions, userVotes: fetchedVotes } =
                await fetchFn(targetId, limit, user?.id);
            setComments(fetchedComments);
            setHasMoreComments(hasMore);
            setUserReactions(fetchedReactions as Map<string, ReactionType>);
            setUserVotes(fetchedVotes as Map<string, VoteType>);
        } catch (error) {
            console.error('Error loading comments:', error);
        } finally {
            setIsLoading(false);
        }
    }, [targetId, targetType, isOpen, user]);

    // Load comments when section is opened
    useEffect(() => {
        if (isOpen) {
            loadComments();
        }
    }, [isOpen, loadComments]);

    // Debounced real-time subscription for comments
    const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const filterColumn = targetType === 'recording' ? 'recording_id' : 'post_id';
        const channel = supabase
            .channel(`comments-${targetType}-${targetId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'comments',
                    filter: `${filterColumn}=eq.${targetId}`,
                },
                () => {
                    // Debounce: if multiple changes fire rapidly, only reload once
                    if (realtimeDebounceRef.current) {
                        clearTimeout(realtimeDebounceRef.current);
                    }
                    realtimeDebounceRef.current = setTimeout(() => {
                        loadComments(false);
                    }, 200);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            if (realtimeDebounceRef.current) {
                clearTimeout(realtimeDebounceRef.current);
            }
        };
    }, [targetId, targetType, isOpen, loadComments]);

    // Handle creating a new comment
    const handleCreateComment = async (content: string, parentCommentId?: string) => {
        if (!user || !profile) return;

        // Build optimistic comment for instant feedback
        const tempId = `temp-${Date.now()}`;
        const optimisticComment: CommentWithAuthor = {
            id: tempId,
            post_id: postId || null,
            recording_id: recordingId || null,
            author_id: user.id,
            content,
            parent_comment_id: parentCommentId || null,
            is_edited: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            author: {
                id: user.id,
                username: profile.username || '',
                display_name: profile.display_name || '',
                avatar_url: profile.avatar_url || null,
                membership_type: profile.membership_type || null,
                role: profile.role || null,
            },
            replies: [],
            reaction_counts: { like: 0, love: 0, fire: 0, clap: 0, think: 0, haha: 0, total: 0 },
            vote_counts: { upvotes: 0, downvotes: 0, score: 0 },
        };

        // Optimistically insert into UI
        if (parentCommentId) {
            setComments(prev => addReplyToTree(prev, parentCommentId, optimisticComment));
        } else {
            setComments(prev => [...prev, optimisticComment]);
        }
        const newCount = commentCount + 1;
        setCommentCount(newCount);
        onCommentCountChange?.(newCount);

        try {
            if (targetType === 'recording' && recordingId) {
                await createRecordingComment(recordingId, user.id, content, parentCommentId);
            } else if (postId) {
                await createComment(postId, user.id, content, parentCommentId);
            }
            // Silent background refresh to reconcile real IDs
            loadComments(false);
            // Note: Mention notifications are automatically handled by the database trigger 'notify_on_mention'
        } catch (error) {
            // Revert optimistic insert
            setComments(prev => removeFromTree(prev, tempId));
            setCommentCount(prev => Math.max(0, prev - 1));
            onCommentCountChange?.(Math.max(0, commentCount));
            console.error('Error creating comment:', error);
            throw error;
        }
    };

    // Helper: insert a reply into the nested comment tree
    const addReplyToTree = (
        tree: CommentWithAuthor[],
        parentId: string,
        newReply: CommentWithAuthor
    ): CommentWithAuthor[] => {
        return tree.map(c => {
            if (c.id === parentId) {
                return { ...c, replies: [...(c.replies || []), newReply] };
            }
            if (c.replies && c.replies.length > 0) {
                return { ...c, replies: addReplyToTree(c.replies, parentId, newReply) };
            }
            return c;
        });
    };

    // Helper: remove a comment (by id) from the nested tree
    const removeFromTree = (
        tree: CommentWithAuthor[],
        targetId: string
    ): CommentWithAuthor[] => {
        return tree
            .filter(c => c.id !== targetId)
            .map(c => {
                if (c.replies && c.replies.length > 0) {
                    return { ...c, replies: removeFromTree(c.replies, targetId) };
                }
                return c;
            });
    };

    // Handle editing a comment
    const handleEditComment = async (commentId: string, content: string) => {
        try {
            await updateComment(commentId, content, targetId);
            // Immediately reload comments for instant feedback (no loading spinner)
            await loadComments(false);
        } catch (error) {
            console.error('Error updating comment:', error);
            throw error;
        }
    };

    // Handle deleting a comment
    const handleDeleteComment = async (commentId: string) => {
        try {
            await deleteComment(commentId, targetId);
            const newCount = Math.max(0, commentCount - 1);
            setCommentCount(newCount);
            onCommentCountChange?.(newCount);
            // Immediately reload comments for instant feedback (no loading spinner)
            await loadComments(false);
        } catch (error) {
            console.error('Error deleting comment:', error);
            throw error;
        }
    };

    // Handle reply (creates a nested comment)
    const handleReply = async (content: string, parentId: string) => {
        await handleCreateComment(content, parentId);
    };

    return (
        <div className="border-t border-surface-100 dark:border-surface-800 mt-4 pt-4">
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 transition-colors mb-4"
            >
                <MessageCircle className="w-5 h-5" />
                <span>
                    {commentCount > 0
                        ? `${commentCount} ${commentCount === 1 ? 'Comment' : 'Comments'}`
                        : 'Add a comment'}
                </span>
            </button>

            {isOpen && (
                <div className="space-y-4">
                    {/* New Comment Form */}
                    {user && (
                        <div className="flex gap-3">
                            {profile?.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt={profile.display_name}
                                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                                    {profile?.display_name?.charAt(0).toUpperCase() || '?'}
                                </div>
                            )}
                            <div className="flex-1">
                                <CommentForm
                                    onSubmit={(content) => handleCreateComment(content)}
                                    placeholder="Write a comment..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                        </div>
                    )}

                    {/* Comments List */}
                    {!isLoading && comments.length === 0 && (
                        <div className="text-center py-8 text-surface-400 dark:text-surface-500">
                            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No comments yet. Be the first to comment!</p>
                        </div>
                    )}

                    {!isLoading && comments.length > 0 && (
                        <div className="space-y-2">
                            {comments.map((comment) => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    postId={targetId}
                                    userReaction={userReactions.get(comment.id) as ReactionType | undefined}
                                    userVote={userVotes.get(comment.id) as VoteType | undefined}
                                    onReply={handleReply}
                                    onEdit={handleEditComment}
                                    onDelete={handleDeleteComment}
                                    userReactionsMap={userReactions as Map<string, ReactionType>}
                                    userVotesMap={userVotes as Map<string, VoteType>}
                                />
                            ))}
                            {hasMoreComments && (
                                <button
                                    onClick={() => loadComments(false, 0)}
                                    className="w-full py-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
                                >
                                    Load all comments
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
