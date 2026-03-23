import { supabase } from './supabase';
import type { Profile } from '@/types/database';

/**
 * Profile Service
 * Handles all profile-related database operations
 */

// Get profile by user ID
export async function getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
    }

    return data;
}

// Get profile by username
export async function getProfileByUsername(username: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
    }

    return data;
}

// Update profile
export async function updateProfile(
    userId: string,
    updates: Partial<Pick<Profile, 'display_name' | 'username' | 'bio' | 'location' | 'website' | 'avatar_url' | 'cover_url'>>
): Promise<Profile> {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates as never)
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Check if username is available
export async function isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    let query = supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase());

    if (excludeUserId) {
        query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return data === null;
}

// Update online status
export async function updateOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    const { error } = await supabase
        .from('profiles')
        .update({
            is_online: isOnline,
            last_seen_at: new Date().toISOString(),
        } as never)
        .eq('id', userId);

    if (error) throw error;
}

// Get online users count (users seen within the last 2 minutes)
export async function getOnlineUsersCount(): Promise<number> {
    const threshold = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen_at', threshold);

    if (error) throw error;
    return count || 0;
}

// Get total members count
export async function getMembersCount(): Promise<number> {
    const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
}

// Search members with filters
export async function searchMembers({
    query,
    status = 'all',
    // role = 'all', // Unused parameter for now
    sort = 'newest',
    limit = 20,
    offset = 0
}: {
    query?: string;
    status?: 'all' | 'online';
    role?: 'all' | 'admin' | 'moderator' | 'member';
    sort?: 'newest' | 'alphabetical' | 'last_active';
    limit?: number;
    offset?: number;
}): Promise<Profile[]> {
    let dbQuery = supabase
        .from('profiles')
        .select('*');

    // Apply text search
    if (query) {
        dbQuery = dbQuery.or(`display_name.ilike.%${query}%,username.ilike.%${query}%`);
    }

    // Apply status filter
    if (status === 'online') {
        dbQuery = dbQuery.eq('is_online', true);
    }

    // Apply sorting
    if (sort === 'newest') {
        dbQuery = dbQuery.order('created_at', { ascending: false });
    } else if (sort === 'alphabetical') {
        dbQuery = dbQuery.order('display_name', { ascending: true });
    } else if (sort === 'last_active') {
        dbQuery = dbQuery.order('last_seen_at', { ascending: false });
    }

    // Apply pagination
    dbQuery = dbQuery.range(offset, offset + limit - 1);

    const { data, error } = await dbQuery;

    if (error) throw error;

    // Client-side role filtering (since roles are in a separate table/meta usually, 
    // but here we might need to adjust if roles aren't directly on profile)
    // Note: Assuming 'role' might be added to profile or handled separately. 
    // For now, if role is required, we might need a join or additional logic.
    // Given the current schema in types/database.ts, check if role exists on profile.
    // If not, we'll implement what we can.

    return data || [];
}

// Validate username format
export function isValidUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    return usernameRegex.test(username);
}

// Validate website URL
export function isValidWebsite(url: string): boolean {
    if (!url) return true; // Empty is valid
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// Get user stats (posts and comments count)
export async function getUserStats(userId: string): Promise<{ postsCount: number; commentsCount: number }> {
    const [postsResult, commentsResult] = await Promise.all([
        supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', userId),
        supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', userId),
    ]);

    return {
        postsCount: postsResult.count || 0,
        commentsCount: commentsResult.count || 0,
    };
}
