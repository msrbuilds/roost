// Re-export all types
export * from './database';

// Extended types with related data
import type { Recording as BaseRecording, Module as BaseModule, Profile, Group } from './database';

export interface RecordingWithPublisher extends BaseRecording {
    publisher?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface RecordingWithCompletion extends BaseRecording {
    publisher?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
    module?: Pick<BaseModule, 'id' | 'title'> | null;
    is_completed: boolean;
}

export interface ModuleWithProgress extends BaseModule {
    recording_count: number;
    completed_count: number;
    progress_percentage: number;
}

export interface GroupAssetWithDetails {
    id: string;
    group_id: string;
    asset_id: string;
    uploaded_by: string;
    created_at: string;
    filename: string;
    file_url: string;
    file_size: number | null;
    mime_type: string | null;
    asset_type: 'image' | 'video' | 'document' | 'other';
    module_id?: string | null;
    uploader?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

// Leaderboard Types
export interface LeaderboardRank {
    id: string;
    user_id: string;
    group_id: string | null;
    total_points: number;
    period_start: string;
    period_end: string;
    created_at: string;
    updated_at: string;
    rank: number;
    user?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'location' | 'membership_type'>;
}

export interface LeaderboardStats {
    totalUsers: number;
    totalPoints: number;
    averagePoints: number;
    highestPoints: number;
}

export interface UserRankInfo {
    rank: number;
    points: number;
    totalUsers: number;
}

// Event Types
export interface EventWithDetails {
    id: string;
    title: string;
    description?: string | null;
    start_time: string;
    end_time: string;
    location?: string | null;
    meeting_url?: string | null;
    is_virtual: boolean;
    group_id?: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    creator?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
    group?: Pick<Group, 'id' | 'name' | 'slug'>;
    attendeeCount?: {
        going: number;
        maybe: number;
        not_going: number;
    };
    userRSVP?: 'going' | 'maybe' | 'not_going' | null;
}

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource: EventWithDetails; // Full event data
}
