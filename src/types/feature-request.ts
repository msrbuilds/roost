import type {
    Profile,
    FeatureRequest,
    FeatureRequestComment,
    FeatureRequestStatus,
    FeatureRequestType,
} from './database';

// Feature request with author details (for cards)
export interface FeatureRequestCardData {
    id: string;
    title: string;
    description: string;
    type: FeatureRequestType;
    status: FeatureRequestStatus;
    vote_count: number;
    comment_count: number;
    is_pinned: boolean;
    created_at: string;
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
    user_has_voted?: boolean;
}

// Full detail view
export interface FeatureRequestWithDetails extends FeatureRequest {
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
    user_has_voted?: boolean;
}

// Comment with author
export interface FeatureRequestCommentWithAuthor extends FeatureRequestComment {
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>;
    replies?: FeatureRequestCommentWithAuthor[];
}

// Filter options
export interface FeatureRequestFilters {
    status?: FeatureRequestStatus;
    statuses?: FeatureRequestStatus[];
    type?: FeatureRequestType;
    sortBy?: 'newest' | 'oldest' | 'most_votes' | 'most_comments';
    search?: string;
    pinnedOnly?: boolean;
}

// Open statuses (not released/declined)
export const OPEN_STATUSES: FeatureRequestStatus[] = [
    'under_review',
    'planned',
    'in_progress',
];

// Status display info (matches screenshot colors)
export const FEATURE_REQUEST_STATUS_INFO: Record<FeatureRequestStatus, {
    label: string;
    color: string;
    bgColor: string;
    dotColor: string;
}> = {
    under_review: {
        label: 'Under Review',
        color: 'text-yellow-700 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        dotColor: 'bg-yellow-500',
    },
    planned: {
        label: 'Planned',
        color: 'text-blue-700 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        dotColor: 'bg-blue-500',
    },
    in_progress: {
        label: 'In Progress',
        color: 'text-orange-700 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        dotColor: 'bg-orange-500',
    },
    released: {
        label: 'Released',
        color: 'text-green-700 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        dotColor: 'bg-green-500',
    },
    declined: {
        label: 'Declined',
        color: 'text-red-700 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        dotColor: 'bg-red-500',
    },
    duplicate: {
        label: 'Duplicate',
        color: 'text-surface-600 dark:text-surface-400',
        bgColor: 'bg-surface-100 dark:bg-surface-800',
        dotColor: 'bg-surface-400',
    },
};

// Type display info
export const FEATURE_REQUEST_TYPE_INFO: Record<FeatureRequestType, {
    label: string;
    color: string;
    bgColor: string;
}> = {
    feature_request: {
        label: 'Feature',
        color: 'text-purple-700 dark:text-purple-400',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    bug_report: {
        label: 'Bug',
        color: 'text-red-700 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
    improvement: {
        label: 'Improvement',
        color: 'text-blue-700 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
};

// Kanban column statuses (4 main columns for the board)
export const KANBAN_COLUMNS: FeatureRequestStatus[] = [
    'under_review',
    'planned',
    'in_progress',
    'released',
];
