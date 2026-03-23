import { ChevronUp, MessageSquare, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { FeatureRequestCardData } from '@/types/feature-request';
import {
    FEATURE_REQUEST_STATUS_INFO,
    FEATURE_REQUEST_TYPE_INFO,
} from '@/types/feature-request';

interface FeatureRequestRowProps {
    request: FeatureRequestCardData;
    onVote: (requestId: string) => void;
    isVoting: boolean;
    onClick: (requestId: string) => void;
}

function stripHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
}

export default function FeatureRequestRow({
    request,
    onVote,
    isVoting,
    onClick,
}: FeatureRequestRowProps) {
    const statusInfo = FEATURE_REQUEST_STATUS_INFO[request.status];
    const typeInfo = FEATURE_REQUEST_TYPE_INFO[request.type];
    const plainDescription = stripHtml(request.description);

    return (
        <div
            className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors cursor-pointer"
            onClick={() => onClick(request.id)}
        >
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
                <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            {request.is_pinned && (
                                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                            )}
                            <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100 line-clamp-1">
                                {request.title}
                            </h4>
                        </div>
                        <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-1 mt-0.5">
                            {plainDescription}
                        </p>
                    </div>
                </div>

                {/* Meta row */}
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

                    {/* Author */}
                    <div className="flex items-center gap-1.5 text-[11px] text-surface-400 dark:text-surface-500">
                        {request.author.avatar_url ? (
                            <img src={request.author.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                            <div className="w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 text-[8px] font-bold flex items-center justify-center">
                                {request.author.display_name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span>{request.author.display_name}</span>
                    </div>

                    <div className="flex-1" />

                    {/* Comment count */}
                    <span className="inline-flex items-center gap-1 text-[11px] text-surface-400 dark:text-surface-500">
                        <MessageSquare className="w-3 h-3" />
                        {request.comment_count}
                    </span>

                    {/* Date */}
                    <span className="text-[11px] text-surface-400 dark:text-surface-500">
                        {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </span>
                </div>
            </div>
        </div>
    );
}
