import type {
    Profile,
    Showcase,
    ShowcaseImage,
    ShowcaseTag,
    ShowcaseReview,
    ShowcaseCategory,
    ShowcaseStatus,
} from './database';

// Showcase with author and related data
export interface ShowcaseWithDetails extends Showcase {
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
    images: ShowcaseImage[];
    tags: ShowcaseTag[];
    user_has_voted?: boolean;
    user_review?: ShowcaseReviewWithAuthor | null;
}

// Review with author profile
export interface ShowcaseReviewWithAuthor extends ShowcaseReview {
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

// Showcase card display (lighter version for lists)
export interface ShowcaseCardData {
    id: string;
    title: string;
    tagline: string;
    thumbnail_url: string | null;
    category: ShowcaseCategory;
    vote_count: number;
    review_count: number;
    average_rating: number;
    launch_date: string | null;
    is_featured: boolean;
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
    tags: Pick<ShowcaseTag, 'id' | 'name' | 'slug' | 'color'>[];
    user_has_voted?: boolean;
}

// Filter options for showcase listing
export interface ShowcaseFilters {
    category?: ShowcaseCategory;
    tagIds?: string[];
    sortBy?: 'newest' | 'votes' | 'rating' | 'featured';
    search?: string;
}

// Pagination options
export interface ShowcasePaginationOptions {
    page?: number;
    pageSize?: number;
}

// Admin moderation view
export interface ShowcaseForModeration extends Showcase {
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
    moderator?: Pick<Profile, 'id' | 'username' | 'display_name'> | null;
}

// Create/Update form data
export interface ShowcaseFormData {
    title: string;
    tagline: string;
    description: string;
    url: string;
    category: ShowcaseCategory;
    tech_stack: string[];
    tagIds: string[];
    thumbnailUrl?: string;
    imageUrls?: string[];
}

// Showcase stats for admin dashboard
export interface ShowcaseStats {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    featured: number;
    thisMonth: number;
}

// Category display info
export const SHOWCASE_CATEGORY_INFO: Record<ShowcaseCategory, { label: string; icon: string; color: string }> = {
    web_app: { label: 'Web App', icon: 'Globe', color: '#3B82F6' },
    mobile_app: { label: 'Mobile App', icon: 'Smartphone', color: '#8B5CF6' },
    saas: { label: 'SaaS', icon: 'Cloud', color: '#06B6D4' },
    tool: { label: 'Tool', icon: 'Wrench', color: '#F59E0B' },
    api: { label: 'API', icon: 'Code', color: '#10B981' },
    website: { label: 'Website', icon: 'Layout', color: '#EC4899' },
    game: { label: 'Game', icon: 'Gamepad2', color: '#EF4444' },
    extension: { label: 'Extension', icon: 'Puzzle', color: '#84CC16' },
    other: { label: 'Other', icon: 'Package', color: '#6B7280' },
};

// Status display info
export const SHOWCASE_STATUS_INFO: Record<ShowcaseStatus, { label: string; color: string; bgColor: string }> = {
    pending: { label: 'Pending Review', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    approved: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-100' },
    rejected: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100' },
    featured: { label: 'Featured', color: 'text-purple-600', bgColor: 'bg-purple-100' },
};
