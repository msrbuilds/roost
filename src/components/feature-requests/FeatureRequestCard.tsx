import { ChevronUp, MessageSquare, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { FeatureRequestCardData } from '@/types/feature-request';
import {
    FEATURE_REQUEST_STATUS_INFO,
    FEATURE_REQUEST_TYPE_INFO,
} from '@/types/feature-request';

interface FeatureRequestCardProps {
    request: FeatureRequestCardData;
    onVote: (requestId: string) => void;
    isVoting: boolean;
    onClick: (requestId: string) => void;
}

function stripHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
}

export default function FeatureRequestCard({
    request,
    onVote,
    isVoting,
    onClick,
}: FeatureRequestCardProps) {
    const statusInfo = FEATURE_REQUEST_STATUS_INFO[request.status];
    const typeInfo = FEATURE_REQUEST_TYPE_INFO[request.type];
    const plainDescription = stripHtml(request.description);

    return (
        <div
            className="card p-3 shadow-none hover:shadow-sm transition-all cursor-pointer group relative"
            onClick={() => onClick(request.id)}
        >
            {/* Pinned indicator */}
            {request.is_pinned && (
                <Star className="absolute top-2 right-2 w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            )}

            <div className="flex gap-3">
                {/* Vote button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onVote(request.id);
                    }}
                    disabled={isVoting}
                    className={`flex flex-col items-center justify-center px-2 py-1.5 rounded-lg border transition-colors flex-shrink-0 min-w-[48px] ${
                        request.user_has_voted
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                            : 'border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 text-surface-500 dark:text-surface-400'
                    }`}
                >
                    <ChevronUp className={`w-4 h-4 ${request.user_has_voted ? 'text-primary-600 dark:text-primary-400' : ''}`} />
                    <span className="text-xs font-semibold">{request.vote_count}</span>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100 line-clamp-2 leading-snug">
                        {request.title}
                    </h4>
                    <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-2 mt-1 leading-relaxed">
                        {plainDescription}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Status badge */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusInfo.color} ${statusInfo.bgColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                            {statusInfo.label}
                        </span>

                        {/* Type badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${typeInfo.color} ${typeInfo.bgColor}`}>
                            {typeInfo.label}
                        </span>

                        <div className="flex-1" />

                        {/* Comment count */}
                        <span className="inline-flex items-center gap-1 text-[10px] text-surface-400 dark:text-surface-500">
                            <MessageSquare className="w-3 h-3" />
                            {request.comment_count}
                        </span>

                        {/* Date */}
                        <span className="text-[10px] text-surface-400 dark:text-surface-500">
                            {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
