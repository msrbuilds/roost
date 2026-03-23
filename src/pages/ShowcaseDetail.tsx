import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ExternalLink,
    Star,
    MessageSquare,
    Calendar,
    Loader2,
    ChevronLeft,
    ChevronRight,
    X,
    Share2,
    Globe,
    Rocket,
    Edit,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ShowcaseVoteButton } from '@/components/showcase';
import ShowcaseReviews from '@/components/showcase/ShowcaseReviews';
import { getShowcaseById, getShowcaseReviews } from '@/services/showcase';
import type { ShowcaseWithDetails, ShowcaseReviewWithAuthor } from '@/types/showcase';
import { SHOWCASE_CATEGORY_INFO, SHOWCASE_STATUS_INFO } from '@/types/showcase';
import DOMPurify from 'dompurify';

export default function ShowcaseDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    const [showcase, setShowcase] = useState<ShowcaseWithDetails | null>(null);
    const [reviews, setReviews] = useState<ShowcaseReviewWithAuthor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'reviews'>('overview');

    // Gallery state
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Fetch showcase
    const fetchShowcase = useCallback(async () => {
        if (!id) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await getShowcaseById(id, user?.id);
            if (!data) {
                setError('Showcase not found');
                return;
            }
            setShowcase(data);

            // Fetch reviews
            const reviewData = await getShowcaseReviews(id);
            setReviews(reviewData);
        } catch (err) {
            console.error('Error fetching showcase:', err);
            setError('Failed to load showcase');
        } finally {
            setIsLoading(false);
        }
    }, [id, user?.id]);

    useEffect(() => {
        fetchShowcase();
    }, [fetchShowcase]);

    // Handle vote change
    const handleVoteChange = (newCount: number, hasVoted: boolean) => {
        if (showcase) {
            setShowcase({
                ...showcase,
                vote_count: newCount,
                user_has_voted: hasVoted,
            });
        }
    };

    // Handle review added
    const handleReviewAdded = (review: ShowcaseReviewWithAuthor) => {
        setReviews((prev) => [review, ...prev]);
        if (showcase) {
            setShowcase({
                ...showcase,
                review_count: showcase.review_count + 1,
            });
        }
    };

    // Handle review updated
    const handleReviewUpdated = (updatedReview: ShowcaseReviewWithAuthor) => {
        setReviews((prev) =>
            prev.map((r) => (r.id === updatedReview.id ? updatedReview : r))
        );
    };

    // Handle review deleted
    const handleReviewDeleted = (reviewId: string) => {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        if (showcase) {
            setShowcase({
                ...showcase,
                review_count: Math.max(0, showcase.review_count - 1),
            });
        }
    };

    // Gallery navigation
    const allImages = showcase ? [showcase.thumbnail_url, ...showcase.images.map((i) => i.image_url)].filter(Boolean) as string[] : [];

    const openLightbox = (index: number) => {
        setCurrentImageIndex(index);
        setLightboxOpen(true);
    };

    const closeLightbox = () => {
        setLightboxOpen(false);
    };

    const nextImage = () => {
        setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    };

    const prevImage = () => {
        setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    };

    // Share functionality
    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: showcase?.title,
                    text: showcase?.tagline,
                    url: window.location.href,
                });
            } catch (err) {
                // User cancelled or error
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
        }
    };

    // Keyboard navigation for lightbox
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!lightboxOpen) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') prevImage();
            if (e.key === 'ArrowRight') nextImage();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxOpen]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    if (error || !showcase) {
        return (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
                <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">
                    {error || 'Showcase not found'}
                </h2>
                <Link
                    to="/showcase"
                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                    Back to Showcase
                </Link>
            </div>
        );
    }

    const categoryInfo = SHOWCASE_CATEGORY_INFO[showcase.category];
    const isMaker = user?.id === showcase.author_id;
    const isAdmin = profile?.role && ['admin', 'superadmin', 'moderator'].includes(profile.role);

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Back button */}
            <Link
                to="/showcase"
                className="inline-flex items-center gap-2 text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 text-sm mb-6"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Showcase
            </Link>

            {/* Main Layout - Content + Sidebar */}
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left: Main Content */}
                <div className="flex-1 min-w-0">
                    {/* Hero Section */}
                    <div className="flex gap-4 mb-6">
                        {/* Thumbnail/Icon */}
                        <div
                            className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer bg-surface-100 dark:bg-surface-800"
                            onClick={() => allImages.length > 0 && openLightbox(0)}
                        >
                            {showcase.thumbnail_url ? (
                                <img
                                    src={showcase.thumbnail_url}
                                    alt={showcase.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Rocket className="w-8 h-8 text-surface-400" />
                                </div>
                            )}
                        </div>

                        {/* Title and info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">
                                    {showcase.title}
                                </h1>
                                {showcase.is_featured && (
                                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-medium rounded-full">
                                        Featured
                                    </span>
                                )}
                                {showcase.status === 'pending' && (
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${SHOWCASE_STATUS_INFO.pending.bgColor} ${SHOWCASE_STATUS_INFO.pending.color}`}>
                                        {SHOWCASE_STATUS_INFO.pending.label}
                                    </span>
                                )}
                            </div>
                            <p className="text-surface-600 dark:text-surface-400 mb-3">
                                {showcase.tagline}
                            </p>

                            {/* Category and Tags inline */}
                            <div className="flex items-center gap-2 flex-wrap text-sm">
                                <span
                                    className="px-2.5 py-1 rounded-md text-xs font-medium"
                                    style={{ backgroundColor: `${categoryInfo.color}15`, color: categoryInfo.color }}
                                >
                                    {categoryInfo.label}
                                </span>
                                {showcase.tags && showcase.tags.slice(0, 3).map((tag) => (
                                    <span
                                        key={tag.id}
                                        className="text-surface-500 dark:text-surface-400"
                                    >
                                        · {tag.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-surface-200 dark:border-surface-700 mb-6">
                        <div className="flex gap-6">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'overview'
                                        ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                                }`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('reviews')}
                                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                                    activeTab === 'reviews'
                                        ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                                }`}
                            >
                                Reviews
                                {showcase.review_count > 0 && (
                                    <span className="px-1.5 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 text-xs rounded">
                                        {showcase.review_count}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8">
                            {/* Gallery */}
                            {allImages.length > 0 && (
                                <div>
                                    {/* Main image */}
                                    <div
                                        className="aspect-video rounded-xl overflow-hidden cursor-pointer bg-surface-100 dark:bg-surface-800 mb-3"
                                        onClick={() => openLightbox(currentImageIndex)}
                                    >
                                        <img
                                            src={allImages[currentImageIndex]}
                                            alt={showcase.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    {/* Thumbnails */}
                                    {allImages.length > 1 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {allImages.map((img, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setCurrentImageIndex(index)}
                                                    className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                                        currentImageIndex === index
                                                            ? 'border-primary-500 ring-2 ring-primary-500/20'
                                                            : 'border-transparent opacity-70 hover:opacity-100'
                                                    }`}
                                                >
                                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Dots indicator */}
                                    {allImages.length > 1 && (
                                        <div className="flex justify-center gap-1.5 mt-3">
                                            {allImages.map((_, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setCurrentImageIndex(index)}
                                                    className={`w-2 h-2 rounded-full transition-colors ${
                                                        currentImageIndex === index
                                                            ? 'bg-primary-600'
                                                            : 'bg-surface-300 dark:bg-surface-600'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Description */}
                            <div className="overflow-hidden">
                                <div
                                    className="prose dark:prose-invert max-w-none text-surface-700 dark:text-surface-300 break-words"
                                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                    dangerouslySetInnerHTML={{
                                        __html: DOMPurify.sanitize(showcase.description, {
                                            ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'strike',
                                                'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
                                                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'div'],
                                            ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
                                            FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
                                            FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
                                        }),
                                    }}
                                />
                            </div>

                            {/* Tech Stack */}
                            {showcase.tech_stack && showcase.tech_stack.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">
                                        Built With
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {showcase.tech_stack.map((tech) => (
                                            <span
                                                key={tech}
                                                className="px-3 py-1.5 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg text-sm"
                                            >
                                                {tech}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Maker section */}
                            <div className="border-t border-surface-200 dark:border-surface-700 pt-6">
                                <h3 className="text-sm font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
                                    Made by
                                </h3>
                                <Link
                                    to={`/profile/${showcase.author.username}`}
                                    className="flex items-center gap-3 group"
                                >
                                    {showcase.author.avatar_url ? (
                                        <img
                                            src={showcase.author.avatar_url}
                                            alt={showcase.author.display_name}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-lg">
                                            {showcase.author.display_name?.charAt(0) || '?'}
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-medium text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                            {showcase.author.display_name}
                                        </p>
                                        <p className="text-sm text-surface-500 dark:text-surface-400">
                                            @{showcase.author.username}
                                        </p>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reviews' && (
                        <ShowcaseReviews
                            showcaseId={showcase.id}
                            reviews={reviews}
                            makerId={showcase.author_id}
                            onReviewAdded={handleReviewAdded}
                            onReviewUpdated={handleReviewUpdated}
                            onReviewDeleted={handleReviewDeleted}
                        />
                    )}
                </div>

                {/* Right Sidebar - Sticky */}
                <div className="lg:w-72 flex-shrink-0">
                    <div className="lg:sticky lg:top-6 space-y-4">
                        {/* Vote Button - Prominent at top */}
                        <ShowcaseVoteButton
                            showcaseId={showcase.id}
                            voteCount={showcase.vote_count}
                            hasVoted={showcase.user_has_voted || false}
                            onVoteChange={handleVoteChange}
                            size="lg"
                        />

                        {/* Action Buttons */}
                        <a
                            href={showcase.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Visit Website
                        </a>
                        <button
                            onClick={handleShare}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 rounded-lg font-medium hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                        >
                            <Share2 className="w-4 h-4" />
                            Share
                        </button>
                        {(isMaker || isAdmin) && showcase.status === 'pending' && (
                            <button
                                onClick={() => navigate(`/showcase/edit/${showcase.id}`)}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 rounded-lg font-medium hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                            >
                                <Edit className="w-4 h-4" />
                                Edit Submission
                            </button>
                        )}

                        {/* Project Info Card */}
                        <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                                Project Info
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm">
                                    <Globe className="w-4 h-4 text-surface-400 flex-shrink-0" />
                                    <a
                                        href={showcase.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-surface-600 dark:text-surface-400 hover:text-primary-600 truncate"
                                    >
                                        {new URL(showcase.url).hostname}
                                    </a>
                                </div>
                                {showcase.launch_date && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <Calendar className="w-4 h-4 text-surface-400 flex-shrink-0" />
                                        <span className="text-surface-600 dark:text-surface-400">
                                            Launched {new Date(showcase.launch_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                )}
                                {showcase.average_rating > 0 && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <Star className="w-4 h-4 text-amber-500 fill-current flex-shrink-0" />
                                        <span className="text-surface-600 dark:text-surface-400">
                                            {showcase.average_rating.toFixed(1)} ({showcase.review_count} reviews)
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-sm">
                                    <MessageSquare className="w-4 h-4 text-surface-400 flex-shrink-0" />
                                    <span className="text-surface-600 dark:text-surface-400">
                                        {showcase.review_count} review{showcase.review_count !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Tags */}
                        {showcase.tags && showcase.tags.length > 0 && (
                            <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3">
                                    Tags
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {showcase.tags.map((tag) => (
                                        <span
                                            key={tag.id}
                                            className="px-2.5 py-1 rounded-md text-xs font-medium"
                                            style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
                                        >
                                            {tag.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Lightbox */}
            {lightboxOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                    onClick={closeLightbox}
                >
                    <button
                        onClick={closeLightbox}
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {allImages.length > 1 && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    prevImage();
                                }}
                                className="absolute left-4 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                            >
                                <ChevronLeft className="w-8 h-8" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    nextImage();
                                }}
                                className="absolute right-4 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                            >
                                <ChevronRight className="w-8 h-8" />
                            </button>
                        </>
                    )}

                    <img
                        src={allImages[currentImageIndex]}
                        alt={`Image ${currentImageIndex + 1}`}
                        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* Thumbnails */}
                    {allImages.length > 1 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded-lg">
                            {allImages.map((img, index) => (
                                <button
                                    key={index}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentImageIndex(index);
                                    }}
                                    className={`w-14 h-10 rounded overflow-hidden transition-all ${
                                        currentImageIndex === index
                                            ? 'ring-2 ring-white'
                                            : 'opacity-50 hover:opacity-100'
                                    }`}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
