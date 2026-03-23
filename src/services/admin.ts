/**
 * Admin Service
 * Handles all admin dashboard operations: user management, content moderation,
 * category management, announcements, and analytics
 */

import { supabase } from './supabase';
import type { Profile, Category, UserRole } from '../types/database';

// =============================================================================
// TYPES
// =============================================================================

export type AnnouncementType = 'info' | 'warning' | 'success' | 'error';
export type AnnouncementScope = 'global' | 'group';

export interface Announcement {
    id: string;
    title: string;
    content: string;
    type: AnnouncementType;
    scope: AnnouncementScope;
    group_id: string | null;
    is_active: boolean;
    is_dismissible: boolean;
    starts_at: string | null;
    expires_at: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    // Joined fields
    creator?: Profile;
}

export interface AdminStats {
    total_members: number;
    banned_members: number;
    new_members_30d: number;
    total_posts: number;
    posts_30d: number;
    total_comments: number;
    comments_30d: number;
    total_groups: number;
    active_groups: number;
    total_events: number;
    upcoming_events: number;
    active_announcements: number;
}

export interface UserGrowthData {
    date: string;
    count: number;
}

export interface ActivityStatsData {
    date: string;
    posts: number;
    comments: number;
}

export interface BanDuration {
    label: string;
    value: string | null; // null = permanent
}

export const BAN_DURATIONS: BanDuration[] = [
    { label: '1 Hour', value: '1 hour' },
    { label: '24 Hours', value: '1 day' },
    { label: '7 Days', value: '7 days' },
    { label: '30 Days', value: '30 days' },
    { label: 'Permanent', value: null },
];

// UserWithBanInfo is now just an alias for Profile since ban fields are in the Profile type
export type UserWithBanInfo = Profile;

// =============================================================================
// USER MANAGEMENT
// =============================================================================

/**
 * Get paginated list of users with optional search and role filter
 */
export async function getUsers(options: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: UserRole | 'all';
    showBanned?: boolean;
}): Promise<{ users: UserWithBanInfo[]; total: number }> {
    const { page = 1, pageSize = 20, search = '', role = 'all', showBanned = true } = options;
    const offset = (page - 1) * pageSize;

    let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });

    // Search filter
    if (search.trim()) {
        query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    // Role filter
    if (role !== 'all') {
        query = query.eq('role', role);
    }

    // Ban filter
    if (!showBanned) {
        query = query.eq('is_banned', false);
    }

    // Pagination
    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
        users: (data || []) as UserWithBanInfo[],
        total: count || 0,
    };
}

/**
 * Ban a user with optional duration
 */
export async function banUser(
    targetUserId: string,
    adminUserId: string,
    reason?: string,
    durationInterval?: string | null
): Promise<boolean> {
    // Calculate expiration date based on duration
    let banExpiresAt: string | null = null;
    if (durationInterval) {
        const now = new Date();
        switch (durationInterval) {
            case '1 hour':
                now.setHours(now.getHours() + 1);
                break;
            case '1 day':
                now.setDate(now.getDate() + 1);
                break;
            case '7 days':
                now.setDate(now.getDate() + 7);
                break;
            case '30 days':
                now.setDate(now.getDate() + 30);
                break;
        }
        banExpiresAt = now.toISOString();
    }

    const { error } = await supabase
        .from('profiles')
        .update({
            is_banned: true,
            ban_reason: reason || null,
            ban_expires_at: banExpiresAt,
            banned_by: adminUserId,
            banned_at: new Date().toISOString(),
        } as never)
        .eq('id', targetUserId);

    if (error) throw error;
    return true;
}

/**
 * Unban a user
 */
export async function unbanUser(
    targetUserId: string,
    _adminUserId: string
): Promise<boolean> {
    const { error } = await supabase
        .from('profiles')
        .update({
            is_banned: false,
            ban_reason: null,
            ban_expires_at: null,
            banned_by: null,
            banned_at: null,
        } as never)
        .eq('id', targetUserId);

    if (error) throw error;
    return true;
}

/**
 * Update a user's platform role
 */
export async function updateUserRole(
    userId: string,
    newRole: UserRole
): Promise<Profile> {
    const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update a user's membership type (free/premium)
 */
export async function updateMembershipType(
    userId: string,
    membershipType: 'free' | 'premium'
): Promise<void> {
    const { error } = await supabase
        .from('profiles')
        .update({ membership_type: membershipType })
        .eq('id', userId);

    if (error) throw error;
}

/**
 * Check if current user is platform admin
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    if (error) return false;
    return data?.role === 'admin' || data?.role === 'superadmin';
}

/**
 * Check if current user is superadmin
 */
export async function checkIsSuperadmin(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    if (error) return false;
    return data?.role === 'superadmin';
}

// =============================================================================
// CONTENT MODERATION
// =============================================================================

/**
 * Get posts for moderation with author info
 */
export async function getPostsForModeration(options: {
    page?: number;
    pageSize?: number;
    search?: string;
}): Promise<{ posts: unknown[]; total: number }> {
    const { page = 1, pageSize = 20, search = '' } = options;
    const offset = (page - 1) * pageSize;

    let query = supabase
        .from('posts')
        .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url),
      category:categories(id, name, color)
    `, { count: 'exact' });

    if (search.trim()) {
        query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
        posts: data || [],
        total: count || 0,
    };
}

/**
 * Delete a post (admin action)
 */
export async function deletePostAsAdmin(postId: string): Promise<void> {
    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

    if (error) throw error;
}

/**
 * Get comments for moderation
 */
export async function getCommentsForModeration(options: {
    page?: number;
    pageSize?: number;
    search?: string;
}): Promise<{ comments: unknown[]; total: number }> {
    const { page = 1, pageSize = 20, search = '' } = options;
    const offset = (page - 1) * pageSize;

    let query = supabase
        .from('comments')
        .select(`
      *,
      author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url),
      post:posts(id, title)
    `, { count: 'exact' });

    if (search.trim()) {
        query = query.ilike('content', `%${search}%`);
    }

    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
        comments: data || [],
        total: count || 0,
    };
}

/**
 * Delete a comment (admin action)
 */
export async function deleteCommentAsAdmin(commentId: string): Promise<void> {
    const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

    if (error) throw error;
}

// =============================================================================
// CATEGORY MANAGEMENT
// =============================================================================

/**
 * Get all categories
 */
export async function getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * Create a new category
 */
export async function createCategory(category: {
    name: string;
    slug: string;
    color?: string;
    icon?: string;
}): Promise<Category> {
    const { data, error } = await supabase
        .from('categories')
        .insert({
            name: category.name,
            slug: category.slug,
            color: category.color,
            icon: category.icon,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update a category
 */
export async function updateCategory(
    categoryId: string,
    updates: Partial<Category>
): Promise<Category> {
    const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', categoryId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a category
 */
export async function deleteCategory(categoryId: string): Promise<void> {
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

    if (error) throw error;
}

/**
 * Reorder categories - simplified version without display_order column
 */
export async function reorderCategories(
    _orderedIds: string[]
): Promise<void> {
    // Note: display_order column not yet in types, skip for now
    console.log('Category reordering not yet implemented');
}

// =============================================================================
// ANNOUNCEMENTS
// =============================================================================

/**
 * Get all announcements (for admin management)
 */
export async function getAnnouncements(options?: {
    includeInactive?: boolean;
}): Promise<Announcement[]> {
    const { includeInactive = true } = options || {};

    let query = supabase
        .from('announcements')
        .select('*, creator:profiles!announcements_created_by_fkey(id, display_name, avatar_url)')
        .order('created_at', { ascending: false });

    if (!includeInactive) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as Announcement[];
}

/**
 * Get active announcements for display
 */
export async function getActiveAnnouncements(
    groupId?: string | null
): Promise<Announcement[]> {
    const now = new Date().toISOString();

    let query = supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false });

    // Filter by scope
    if (groupId) {
        // Get global announcements and group-specific ones
        query = query.or(`scope.eq.global,and(scope.eq.group,group_id.eq.${groupId})`);
    } else {
        // Only global announcements
        query = query.eq('scope', 'global');
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as Announcement[];
}

/**
 * Create an announcement
 */
export async function createAnnouncement(announcement: {
    title: string;
    content: string;
    type?: AnnouncementType;
    scope?: AnnouncementScope;
    group_id?: string | null;
    is_dismissible?: boolean;
    starts_at?: string | null;
    expires_at?: string | null;
    created_by: string;
}): Promise<Announcement> {
    const { data, error } = await supabase
        .from('announcements')
        .insert({
            title: announcement.title,
            content: announcement.content,
            type: announcement.type || 'info',
            scope: announcement.scope || 'global',
            group_id: announcement.group_id || null,
            is_dismissible: announcement.is_dismissible ?? true,
            starts_at: announcement.starts_at || null,
            expires_at: announcement.expires_at || null,
            created_by: announcement.created_by,
            is_active: true,
        })
        .select()
        .single();

    if (error) throw error;
    return data as Announcement;
}

/**
 * Update an announcement
 */
export async function updateAnnouncement(
    announcementId: string,
    updates: Partial<Announcement>
): Promise<Announcement> {
    const { data, error } = await supabase
        .from('announcements')
        .update({
            title: updates.title,
            content: updates.content,
            type: updates.type,
            scope: updates.scope,
            group_id: updates.group_id,
            is_active: updates.is_active,
            is_dismissible: updates.is_dismissible,
            starts_at: updates.starts_at,
            expires_at: updates.expires_at,
        })
        .eq('id', announcementId)
        .select()
        .single();

    if (error) throw error;
    return data as Announcement;
}

/**
 * Delete an announcement
 */
export async function deleteAnnouncement(announcementId: string): Promise<void> {
    const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId);

    if (error) throw error;
}

/**
 * Dismiss an announcement for a user
 */
export async function dismissAnnouncement(
    announcementId: string,
    userId: string
): Promise<void> {
    const { error } = await supabase
        .from('announcement_dismissals')
        .insert({
            announcement_id: announcementId,
            user_id: userId,
        });

    // Ignore unique constraint violations (already dismissed)
    if (error && error.code !== '23505') throw error;
}

/**
 * Get user's dismissed announcement IDs
 */
export async function getDismissedAnnouncementIds(
    userId: string
): Promise<string[]> {
    const { data, error } = await supabase
        .from('announcement_dismissals')
        .select('announcement_id')
        .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map(d => d.announcement_id);
}

// =============================================================================
// ANALYTICS
// =============================================================================

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<AdminStats> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all stats in parallel using counts
    const [
        totalMembersResult,
        totalPostsResult,
        totalCommentsResult,
        totalGroupsResult,
        totalEventsResult,
        recentPostsResult,
        recentCommentsResult,
        recentMembersResult,
        upcomingEventsResult,
    ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('posts').select('id', { count: 'exact', head: true }),
        supabase.from('comments').select('id', { count: 'exact', head: true }),
        supabase.from('groups').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
        supabase.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
        supabase.from('events').select('id', { count: 'exact', head: true }).gte('start_time', now.toISOString()),
    ]);

    return {
        total_members: totalMembersResult.count || 0,
        banned_members: 0, // Will be calculated after migration is run
        new_members_30d: recentMembersResult.count || 0,
        total_posts: totalPostsResult.count || 0,
        posts_30d: recentPostsResult.count || 0,
        total_comments: totalCommentsResult.count || 0,
        comments_30d: recentCommentsResult.count || 0,
        total_groups: totalGroupsResult.count || 0,
        active_groups: totalGroupsResult.count || 0, // All groups are active by default
        total_events: totalEventsResult.count || 0,
        upcoming_events: upcomingEventsResult.count || 0,
        active_announcements: 0, // Will be calculated after migration is run
    };
}

/**
 * Get user growth data for chart
 */
export async function getUserGrowth(days: number = 30): Promise<UserGrowthData[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

    if (error) throw error;

    // Group by date
    const countsByDate: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        countsByDate[date.toISOString().split('T')[0]] = 0;
    }

    (data || []).forEach((profile) => {
        if (profile.created_at) {
            const date = profile.created_at.split('T')[0];
            if (countsByDate[date] !== undefined) {
                countsByDate[date]++;
            }
        }
    });

    return Object.entries(countsByDate).map(([date, count]) => ({ date, count }));
}

/**
 * Get activity stats for chart
 */
export async function getActivityStats(days: number = 30): Promise<ActivityStatsData[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const [postsResult, commentsResult] = await Promise.all([
        supabase
            .from('posts')
            .select('created_at')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString()),
        supabase
            .from('comments')
            .select('created_at')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString()),
    ]);

    // Group by date
    const statsByDate: Record<string, { posts: number; comments: number }> = {};
    for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        statsByDate[date.toISOString().split('T')[0]] = { posts: 0, comments: 0 };
    }

    (postsResult.data || []).forEach((post) => {
        if (post.created_at) {
            const date = post.created_at.split('T')[0];
            if (statsByDate[date]) {
                statsByDate[date].posts++;
            }
        }
    });

    (commentsResult.data || []).forEach((comment) => {
        if (comment.created_at) {
            const date = comment.created_at.split('T')[0];
            if (statsByDate[date]) {
                statsByDate[date].comments++;
            }
        }
    });

    return Object.entries(statsByDate).map(([date, stats]) => ({
        date,
        posts: stats.posts,
        comments: stats.comments,
    }));
}

/**
 * Get top contributors from leaderboard
 */
export async function getTopContributors(limit: number = 5): Promise<unknown[]> {
    // Calculate current 30-day period (same as leaderboard service)
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 29);

    const periodStartDate = periodStart.toISOString().split('T')[0];
    const periodEndDate = periodEnd.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('leaderboard_entries')
        .select(`
      *,
      user:profiles!leaderboard_entries_user_id_fkey(id, username, display_name, avatar_url)
    `)
        .is('group_id', null)
        .eq('period_start', periodStartDate)
        .eq('period_end', periodEndDate)
        .order('total_points', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}
