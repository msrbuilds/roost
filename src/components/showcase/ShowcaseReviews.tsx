import { useState } from 'react';
import { Star, Send, Loader2, Edit2, Trash2, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    createReview,
    updateReview,
    deleteReview,
    addMakerReply,
} from '@/services/showcase';
import type { ShowcaseReviewWithAuthor } from '@/types/showcase';

interface ShowcaseReviewsProps {
    showcaseId: string;
    reviews: ShowcaseReviewWithAuthor[];
    makerId: string;
    onReviewAdded: (review: ShowcaseReviewWithAuthor) => void;
    onReviewUpdated: (review: ShowcaseReviewWithAuthor) => void;
    onReviewDeleted: (reviewId: string) => void;
}

function StarRating({
    rating,
    onChange,
    readonly = false,
    size = 'md',
}: {
    rating: number;
    onChange?: (rating: number) => void;
    readonly?: boolean;
    size?: 'sm' | 'md' | 'lg';
}) {
    const [hoverRating, setHoverRating] = useState(0);

    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
    };

    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={readonly}
                    onClick={() => onChange?.(star)}
                    onMouseEnter={() => !readonly && setHoverRating(star)}
                    onMouseLeave={() => !readonly && setHoverRating(0)}
                    className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}`}
                >
                    <Star
                        className={`${sizeClasses[size]} ${
                            star <= (hoverRating || rating)
                                ? 'text-amber-400 fill-current'
                                : 'text-surface-300 dark:text-surface-600'
                        }`}
                    />
                </button>
            ))}
        </div>
    );
}

function ReviewItem({
    review,
    makerId,
    currentUserId,
    onUpdate,
    onDelete,
    onMakerReply,
}: {
    review: ShowcaseReviewWithAuthor;
    makerId: string;
    currentUserId?: string;
    onUpdate: (reviewId: string, content: string, rating: number) => Promise<void>;
    onDelete: (reviewId: string) => Promise<void>;
    onMakerReply: (reviewId: string, reply: string) => Promise<void>;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const [editContent, setEditContent] = useState(review.content);
    const [editRating, setEditRating] = useState(review.rating);
    const [replyContent, setReplyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isAuthor = currentUserId === review.author_id;
    const isMaker = currentUserId === makerId;

    const handleSaveEdit = async () => {
        if (!editContent.trim()) return;

        setIsSubmitting(true);
        try {
            await onUpdate(review.id, editContent, editRating);
            setIsEditing(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this review?')) return;

        setIsSubmitting(true);
        try {
            await onDelete(review.id);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitReply = async () => {
        if (!replyContent.trim()) return;

        setIsSubmitting(true);
        try {
            await onMakerReply(review.id, replyContent);
            setIsReplying(false);
            setReplyContent('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="border-b border-surface-100 dark:border-surface-800 last:border-0 py-6 first:pt-0">
            <div className="flex items-start gap-4">
                {/* Avatar */}
                <Link to={`/profile/${review.author.username}`}>
                    {review.author.avatar_url ? (
                        <img
                            src={review.author.avatar_url}
                            alt={review.author.display_name}
                            className="w-10 h-10 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                            {review.author.display_name?.charAt(0) || '?'}
                        </div>
                    )}
                </Link>

                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                        <Link
                            to={`/profile/${review.author.username}`}
                            className="font-medium text-surface-900 dark:text-surface-100 hover:text-primary-600 dark:hover:text-primary-400"
                        >
                            {review.author.display_name}
                        </Link>
                        <StarRating rating={isEditing ? editRating : review.rating} onChange={isEditing ? setEditRating : undefined} readonly={!isEditing} size="sm" />
                        <span className="text-xs text-surface-500 dark:text-surface-400">
                            {new Date(review.created_at).toLocaleDateString()}
                        </span>
                        {review.is_edited && (
                            <span className="text-xs text-surface-400">(edited)</span>
                        )}
                    </div>

                    {/* Content */}
                    {isEditing ? (
                        <div className="space-y-3">
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={isSubmitting}
                                    className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setEditContent(review.content);
                                        setEditRating(review.rating);
                                    }}
                                    className="px-3 py-1.5 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-surface-700 dark:text-surface-300 text-sm">
                            {review.content}
                        </p>
                    )}

                    {/* Actions */}
                    {!isEditing && (isAuthor || isMaker) && (
                        <div className="flex gap-2 mt-3">
                            {isAuthor && (
                                <>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={isSubmitting}
                                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Delete
                                    </button>
                                </>
                            )}
                            {isMaker && !review.maker_reply && (
                                <button
                                    onClick={() => setIsReplying(true)}
                                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                                >
                                    <MessageSquare className="w-3 h-3" />
                                    Reply
                                </button>
                            )}
                        </div>
                    )}

                    {/* Maker Reply */}
                    {review.maker_reply && (
                        <div className="mt-4 ml-4 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
                            <p className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
                                Maker Response
                            </p>
                            <p className="text-sm text-surface-700 dark:text-surface-300">
                                {review.maker_reply}
                            </p>
                        </div>
                    )}

                    {/* Reply form */}
                    {isReplying && (
                        <div className="mt-4 ml-4 pl-4 border-l-2 border-surface-200 dark:border-surface-700 space-y-3">
                            <textarea
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder="Write your reply..."
                                rows={2}
                                className="w-full px-3 py-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSubmitReply}
                                    disabled={isSubmitting || !replyContent.trim()}
                                    className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reply'}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsReplying(false);
                                        setReplyContent('');
                                    }}
                                    className="px-3 py-1.5 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ShowcaseReviews({
    showcaseId,
    reviews,
    makerId,
    onReviewAdded,
    onReviewUpdated,
    onReviewDeleted,
}: ShowcaseReviewsProps) {
    const { user, profile } = useAuth();
    const [newReviewContent, setNewReviewContent] = useState('');
    const [newReviewRating, setNewReviewRating] = useState(5);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const userHasReviewed = reviews.some((r) => r.author_id === user?.id);
    const canReview = user && !userHasReviewed && user.id !== makerId;

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newReviewContent.trim()) return;

        setIsSubmitting(true);
        try {
            const review = await createReview(
                showcaseId,
                user.id,
                newReviewContent,
                newReviewRating
            );

            // Add author info to the review
            const reviewWithAuthor: ShowcaseReviewWithAuthor = {
                ...review,
                author: {
                    id: user.id,
                    username: profile?.username || '',
                    display_name: profile?.display_name || '',
                    avatar_url: profile?.avatar_url || null,
                },
            };

            onReviewAdded(reviewWithAuthor);
            setNewReviewContent('');
            setNewReviewRating(5);
        } catch (error) {
            console.error('Error submitting review:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateReview = async (reviewId: string, content: string, rating: number) => {
        const updatedReview = await updateReview(reviewId, content, rating);
        const existingReview = reviews.find((r) => r.id === reviewId);
        if (existingReview) {
            onReviewUpdated({
                ...updatedReview,
                author: existingReview.author,
            });
        }
    };

    const handleDeleteReview = async (reviewId: string) => {
        await deleteReview(reviewId);
        onReviewDeleted(reviewId);
    };

    const handleMakerReply = async (reviewId: string, reply: string) => {
        const updatedReview = await addMakerReply(reviewId, reply);
        const existingReview = reviews.find((r) => r.id === reviewId);
        if (existingReview) {
            onReviewUpdated({
                ...updatedReview,
                author: existingReview.author,
            });
        }
    };

    return (
        <div className="card shadow-none p-6">
            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">
                Reviews ({reviews.length})
            </h2>

            {/* New review form */}
            {canReview && (
                <form onSubmit={handleSubmitReview} className="mb-8 pb-8 border-b border-surface-100 dark:border-surface-800">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Your Rating
                        </label>
                        <StarRating rating={newReviewRating} onChange={setNewReviewRating} size="lg" />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                            Your Review
                        </label>
                        <textarea
                            value={newReviewContent}
                            onChange={(e) => setNewReviewContent(e.target.value)}
                            placeholder="Share your experience with this project..."
                            rows={4}
                            className="w-full px-4 py-3 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !newReviewContent.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Submit Review
                    </button>
                </form>
            )}

            {!user && (
                <p className="text-sm text-surface-500 dark:text-surface-400 mb-6">
                    <Link to="/login" className="text-primary-600 hover:text-primary-700">
                        Sign in
                    </Link>{' '}
                    to leave a review.
                </p>
            )}

            {user && user.id === makerId && (
                <p className="text-sm text-surface-500 dark:text-surface-400 mb-6">
                    You cannot review your own project.
                </p>
            )}

            {user && userHasReviewed && (
                <p className="text-sm text-surface-500 dark:text-surface-400 mb-6">
                    You've already reviewed this project.
                </p>
            )}

            {/* Reviews list */}
            {reviews.length === 0 ? (
                <p className="text-center text-surface-500 dark:text-surface-400 py-8">
                    No reviews yet. Be the first to review!
                </p>
            ) : (
                <div>
                    {reviews.map((review) => (
                        <ReviewItem
                            key={review.id}
                            review={review}
                            makerId={makerId}
                            currentUserId={user?.id}
                            onUpdate={handleUpdateReview}
                            onDelete={handleDeleteReview}
                            onMakerReply={handleMakerReply}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
