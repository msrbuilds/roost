import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import DOMPurify from 'dompurify';
import {
    ChevronUp,
    Star,
    Shield,
    Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
    updateFeatureRequestStatus,
    togglePinFeatureRequest,
} from '@/services/feature-request';
import {
    FEATURE_REQUEST_STATUS_INFO,
    FEATURE_REQUEST_TYPE_INFO,
    KANBAN_COLUMNS,
} from '@/types/feature-request';
import type { FeatureRequestWithDetails } from '@/types/feature-request';
import type { FeatureRequestStatus } from '@/types/database';

interface FeatureRequestDetailProps {
    request: FeatureRequestWithDetails;
    onVote: () => void;
    isVoting: boolean;
    onUpdate: () => void;
}

const ALL_STATUSES: FeatureRequestStatus[] = [...KANBAN_COLUMNS, 'declined', 'duplicate'];

export default function FeatureRequestDetailView({
    request,
    onVote,
    isVoting,
    onUpdate,
}: FeatureRequestDetailProps) {
    const { isPlatformAdmin, isPlatformModerator } = useAuth();
    const isAdmin = isPlatformAdmin || isPlatformModerator;
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isTogglingPin, setIsTogglingPin] = useState(false);
    const [adminResponse, setAdminResponse] = useState(request.admin_response || '');
    const [isSavingResponse, setIsSavingResponse] = useState(false);

    const statusInfo = FEATURE_REQUEST_STATUS_INFO[request.status];
    const typeInfo = FEATURE_REQUEST_TYPE_INFO[request.type];

    const sanitizedDescription = DOMPurify.sanitize(request.description, {
        ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'strike',
            'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
        FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
        FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
    });

    const handleStatusChange = async (newStatus: FeatureRequestStatus) => {
        setIsUpdatingStatus(true);
        try {
            await updateFeatureRequestStatus(request.id, newStatus);
            onUpdate();
        } catch (err) {
            console.error('Error updating status:', err);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleTogglePin = async () => {
        setIsTogglingPin(true);
        try {
            await togglePinFeatureRequest(request.id, !request.is_pinned);
            onUpdate();
        } catch (err) {
            console.error('Error toggling pin:', err);
        } finally {
            setIsTogglingPin(false);
        }
    };

    const handleSaveAdminResponse = async () => {
        setIsSavingResponse(true);
        try {
            await updateFeatureRequestStatus(request.id, request.status, adminResponse || undefined);
            onUpdate();
        } catch (err) {
            console.error('Error saving admin response:', err);
        } finally {
            setIsSavingResponse(false);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
                {/* Vote button */}
                <button
                    onClick={onVote}
                    disabled={isVoting}
                    className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl border-2 transition-colors flex-shrink-0 min-w-[60px] ${
                        request.user_has_voted
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                            : 'border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 text-surface-500 dark:text-surface-400'
                    }`}
                >
                    <ChevronUp className="w-5 h-5" />
                    <span className="text-sm font-bold">{request.vote_count}</span>
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                        {/* Status badge */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor}`}>
                            <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`} />
                            {statusInfo.label}
                        </span>

                        {/* Type badge */}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.color} ${typeInfo.bgColor}`}>
                            {typeInfo.label}
                        </span>

                        {/* Pinned */}
                        {request.is_pinned && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                    </div>

                    <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100 mb-2">
                        {request.title}
                    </h1>

                    {/* Author info */}
                    <div className="flex items-center gap-2">
                        <img
                            src={request.author.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.author.display_name || 'U')}&background=random`}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="text-sm text-surface-600 dark:text-surface-400">
                            {request.author.display_name || request.author.username}
                        </span>
                        <span className="text-xs text-surface-400">
                            {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Description */}
            <div
                className="prose dark:prose-invert prose-sm max-w-none mb-6 text-surface-700 dark:text-surface-300"
                dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />

            {/* Admin response */}
            {request.admin_response && !isAdmin && (
                <div className="mb-6 p-4 rounded-lg bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                            Official Response
                        </span>
                    </div>
                    <p className="text-sm text-primary-800 dark:text-primary-200 whitespace-pre-wrap">
                        {request.admin_response}
                    </p>
                </div>
            )}

            {/* Admin controls */}
            {isAdmin && (
                <div className="mb-6 p-4 rounded-lg bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-primary-600" />
                        <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                            Admin Controls
                        </span>
                    </div>

                    {/* Status change */}
                    <div>
                        <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
                            Status
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {ALL_STATUSES.map((s) => {
                                const info = FEATURE_REQUEST_STATUS_INFO[s];
                                return (
                                    <button
                                        key={s}
                                        onClick={() => handleStatusChange(s)}
                                        disabled={isUpdatingStatus || request.status === s}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                            request.status === s
                                                ? `${info.bgColor} ${info.color} border-current`
                                                : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
                                        } disabled:opacity-50`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${info.dotColor}`} />
                                        {info.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Pin toggle */}
                    <button
                        onClick={handleTogglePin}
                        disabled={isTogglingPin}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            request.is_pinned
                                ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                                : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
                        }`}
                    >
                        <Star className={`w-3.5 h-3.5 ${request.is_pinned ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                        {request.is_pinned ? 'Unpin' : 'Pin'}
                    </button>

                    {/* Admin response */}
                    <div>
                        <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
                            Official Response
                        </label>
                        <textarea
                            value={adminResponse}
                            onChange={(e) => setAdminResponse(e.target.value)}
                            placeholder="Add an official response..."
                            className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 text-sm resize-none placeholder-surface-400"
                            rows={3}
                        />
                        <button
                            onClick={handleSaveAdminResponse}
                            disabled={isSavingResponse}
                            className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        >
                            {isSavingResponse ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Save Response
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
