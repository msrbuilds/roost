import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
    getFeatureRequestById,
    getFeatureRequestComments,
    toggleFeatureRequestVote,
} from '@/services/feature-request';
import { getFeatureRequestAssets } from '@/services';
import FeatureRequestDetailView from '@/components/feature-requests/FeatureRequestDetail';
import FeatureRequestComments from '@/components/feature-requests/FeatureRequestComments';
import MediaGallery from '@/components/feed/MediaGallery';
import type { Asset } from '@/services/asset';
import type { FeatureRequestWithDetails, FeatureRequestCommentWithAuthor } from '@/types/feature-request';

export default function FeatureRequestDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [request, setRequest] = useState<FeatureRequestWithDetails | null>(null);
    const [comments, setComments] = useState<FeatureRequestCommentWithAuthor[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isVoting, setIsVoting] = useState(false);

    const fetchRequest = useCallback(async () => {
        if (!id) return;
        try {
            const data = await getFeatureRequestById(id, user?.id);
            setRequest(data);
        } catch (err) {
            console.error('Error fetching feature request:', err);
        }
    }, [id, user?.id]);

    const fetchComments = useCallback(async () => {
        if (!id) return;
        try {
            const data = await getFeatureRequestComments(id);
            setComments(data);
        } catch (err) {
            console.error('Error fetching comments:', err);
        }
    }, [id]);

    const fetchAssets = useCallback(async () => {
        if (!id) return;
        try {
            const data = await getFeatureRequestAssets(id);
            setAssets(data);
        } catch (err) {
            console.error('Error fetching assets:', err);
        }
    }, [id]);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await Promise.all([fetchRequest(), fetchComments(), fetchAssets()]);
            setIsLoading(false);
        };
        load();
    }, [fetchRequest, fetchComments, fetchAssets]);

    const handleVote = async () => {
        if (!user || !request || isVoting) return;
        setIsVoting(true);

        // Optimistic update
        setRequest((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                user_has_voted: !prev.user_has_voted,
                vote_count: prev.user_has_voted ? prev.vote_count - 1 : prev.vote_count + 1,
            };
        });

        try {
            await toggleFeatureRequestVote(request.id, user.id);
        } catch (err) {
            console.error('Error voting:', err);
            await fetchRequest();
        } finally {
            setIsVoting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    if (!request) {
        return (
            <div className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
                <button
                    onClick={() => navigate('/roadmap')}
                    className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Roadmap
                </button>
                <div className="text-center py-20">
                    <h2 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
                        Feature request not found
                    </h2>
                    <p className="text-surface-500">
                        The feature request you're looking for doesn't exist or was deleted.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Back button */}
            <button
                onClick={() => navigate('/roadmap')}
                className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Roadmap
            </button>

            {/* Detail view */}
            <div className="card p-6 shadow-none mb-6">
                <FeatureRequestDetailView
                    request={request}
                    onVote={handleVote}
                    isVoting={isVoting}
                    onUpdate={fetchRequest}
                />

                {/* Attached images */}
                {assets.length > 0 && (
                    <MediaGallery assets={assets} />
                )}
            </div>

            {/* Comments */}
            <div className="card p-6 shadow-none">
                <FeatureRequestComments
                    requestId={request.id}
                    comments={comments}
                    onCommentsChange={setComments}
                />
            </div>
        </div>
    );
}
