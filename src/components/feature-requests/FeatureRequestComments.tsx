import { useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
    MessageSquare,
    Send,
    Loader2,
    MoreHorizontal,
    Pencil,
    Trash2,
    Reply,
    X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
    getFeatureRequestComments,
    createFeatureRequestComment,
    updateFeatureRequestComment,
    deleteFeatureRequestComment,
} from '@/services/feature-request';
import type { FeatureRequestCommentWithAuthor } from '@/types/feature-request';

interface FeatureRequestCommentsProps {
    requestId: string;
    comments: FeatureRequestCommentWithAuthor[];
    onCommentsChange: (comments: FeatureRequestCommentWithAuthor[]) => void;
}

function CommentItem({
    comment,
    requestId,
    onRefresh,
    depth = 0,
}: {
    comment: FeatureRequestCommentWithAuthor;
    requestId: string;
    onRefresh: () => void;
    depth?: number;
}) {
    const { user, isPlatformAdmin } = useAuth();
    const [isReplying, setIsReplying] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [editContent, setEditContent] = useState(comment.content);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const isAuthor = user?.id === comment.author_id;
    const canDelete = isAuthor || isPlatformAdmin;
    const canEdit = isAuthor;

    const handleReply = async () => {
        if (!user || !replyContent.trim()) return;
        setIsSubmitting(true);
        try {
            await createFeatureRequestComment(requestId, user.id, replyContent.trim(), comment.id);
            setReplyContent('');
            setIsReplying(false);
            onRefresh();
        } catch (err) {
            console.error('Error replying:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = async () => {
        if (!editContent.trim()) return;
        setIsSubmitting(true);
        try {
            await updateFeatureRequestComment(comment.id, editContent.trim());
            setIsEditing(false);
            onRefresh();
        } catch (err) {
            console.error('Error editing:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this comment?')) return;
        try {
            await deleteFeatureRequestComment(comment.id);
            onRefresh();
        } catch (err) {
            console.error('Error deleting:', err);
        }
    };

    return (
        <div className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-surface-200 dark:border-surface-700' : ''}`}>
            <div className="py-3">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                    <img
                        src={comment.author.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author.display_name || 'U')}&background=random`}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover"
                    />
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                        {comment.author.display_name || comment.author.username}
                    </span>
                    {comment.author.role && comment.author.role !== 'user' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                            {comment.author.role}
                        </span>
                    )}
                    <span className="text-xs text-surface-400">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                    {comment.is_edited && (
                        <span className="text-[10px] text-surface-400">(edited)</span>
                    )}

                    {/* Actions menu */}
                    {(canEdit || canDelete) && (
                        <div className="relative ml-auto">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400"
                            >
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg py-1 min-w-[120px]">
                                        {canEdit && (
                                            <button
                                                onClick={() => { setIsEditing(true); setShowMenu(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                                Edit
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button
                                                onClick={() => { handleDelete(); setShowMenu(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Content */}
                {isEditing ? (
                    <div className="mt-2">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm resize-none"
                            rows={3}
                        />
                        <div className="flex items-center gap-2 mt-2">
                            <button
                                onClick={handleEdit}
                                disabled={isSubmitting || !editContent.trim()}
                                className="px-3 py-1 rounded text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                onClick={() => { setIsEditing(false); setEditContent(comment.content); }}
                                className="px-3 py-1 rounded text-xs font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap">
                        {comment.content}
                    </p>
                )}

                {/* Reply button */}
                {!isEditing && depth < 2 && (
                    <button
                        onClick={() => setIsReplying(!isReplying)}
                        className="flex items-center gap-1 mt-1.5 text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                    >
                        <Reply className="w-3 h-3" />
                        Reply
                    </button>
                )}

                {/* Reply form */}
                {isReplying && (
                    <div className="mt-2 flex items-start gap-2">
                        <textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm resize-none placeholder-surface-400"
                            rows={2}
                        />
                        <div className="flex flex-col gap-1">
                            <button
                                onClick={handleReply}
                                disabled={isSubmitting || !replyContent.trim()}
                                className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => { setIsReplying(false); setReplyContent(''); }}
                                className="p-2 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
                <div>
                    {comment.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            requestId={requestId}
                            onRefresh={onRefresh}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function FeatureRequestComments({
    requestId,
    comments,
    onCommentsChange,
}: FeatureRequestCommentsProps) {
    const { user } = useAuth();
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const refreshComments = useCallback(async () => {
        try {
            const updated = await getFeatureRequestComments(requestId);
            onCommentsChange(updated);
        } catch (err) {
            console.error('Error refreshing comments:', err);
        }
    }, [requestId, onCommentsChange]);

    const handleSubmit = async () => {
        if (!user || !newComment.trim()) return;
        setIsSubmitting(true);
        try {
            await createFeatureRequestComment(requestId, user.id, newComment.trim());
            setNewComment('');
            await refreshComments();
        } catch (err) {
            console.error('Error creating comment:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalComments = comments.reduce((count, c) => {
        return count + 1 + (c.replies?.length || 0);
    }, 0);

    return (
        <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-surface-900 dark:text-surface-100 mb-4">
                <MessageSquare className="w-5 h-5" />
                Discussion ({totalComments})
            </h3>

            {/* New comment form */}
            {user && (
                <div className="flex items-start gap-3 mb-6">
                    <img
                        src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.display_name || 'U')}&background=random`}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Share your thoughts..."
                            className="w-full px-3 py-2.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm resize-none placeholder-surface-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            rows={3}
                        />
                        <div className="flex justify-end mt-2">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !newComment.trim()}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Posting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Comment
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Comments list */}
            {comments.length === 0 ? (
                <div className="text-center py-8">
                    <MessageSquare className="w-10 h-10 mx-auto text-surface-300 dark:text-surface-600 mb-2" />
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                        No comments yet. Be the first to share your thoughts!
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-surface-100 dark:divide-surface-800">
                    {comments.map((comment) => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            requestId={requestId}
                            onRefresh={refreshComments}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
