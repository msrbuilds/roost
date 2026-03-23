import { supabase } from './supabase';
import type { PointActivity, PointActionType } from '../types/database';
import type {
    LeaderboardRank,
    LeaderboardStats,
    UserRankInfo,
} from '../types';

/**
 * Get global leaderboard for a time period
 *
 * NOTE: The leaderboard_entries table stores pre-computed totals with fixed period dates.
 * For "all-time" (periodDays >= 365), we use the fixed all-time period (2000-01-01 to 2099-12-31).
 * For rolling periods, we calculate directly from point_activities to get accurate results.
 */
export async function getGlobalLeaderboard(
    periodDays: number = 30,
    limit: number = 100,
    offset: number = 0
): Promise<{ entries: LeaderboardRank[]; hasMore: boolean }> {
    // For all-time leaderboard, use the fixed period stored in the database
    if (periodDays >= 365) {
        const { data, error } = await supabase
            .from('leaderboard_entries')
            .select(`
                *,
                user:profiles!user_id (
                    id,
                    username,
                    display_name,
                    avatar_url,
                    location,
                    membership_type
                )
            `)
            .is('group_id', null)
            .eq('period_start', '2000-01-01')
            .eq('period_end', '2099-12-31')
            .order('total_points', { ascending: false })
            .range(offset, offset + limit);

        if (error) throw error;

        const entries = (data || []).map((entry, index) => ({
            ...(entry as any),
            rank: offset + index + 1,
        })) as LeaderboardRank[];

        return {
            entries,
            hasMore: entries.length > limit,
        };
    }

    // For rolling periods (7, 30 days), calculate from point_activities directly
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    const periodStartISO = periodStart.toISOString();

    // Query point_activities and aggregate by user using RPC function
    // Note: get_leaderboard_for_period is added via migration 037
    const { data, error } = await (supabase.rpc as any)('get_leaderboard_for_period', {
        p_group_id: null,
        p_period_start: periodStartISO,
        p_limit: limit + 1,
        p_offset: offset
    });

    if (error) {
        // Fallback: Try querying leaderboard_entries with closest match
        console.warn('RPC get_leaderboard_for_period not available, falling back to all-time:', error.message);
        return getGlobalLeaderboard(365, limit, offset);
    }

    const results = (data || []) as any[];
    const entries = results.map((entry: any, index: number) => ({
        id: entry.user_id,
        user_id: entry.user_id,
        group_id: null,
        total_points: entry.total_points,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        rank: offset + index + 1,
        user: entry.user,
    })) as LeaderboardRank[];

    return {
        entries: entries.slice(0, limit),
        hasMore: entries.length > limit,
    };
}

/**
 * Get group-specific leaderboard
 */
export async function getGroupLeaderboard(
    groupId: string,
    periodDays: number = 30,
    limit: number = 100,
    offset: number = 0
): Promise<{ entries: LeaderboardRank[]; hasMore: boolean }> {
    // For all-time leaderboard, use the fixed period stored in the database
    if (periodDays >= 365) {
        const { data, error } = await supabase
            .from('leaderboard_entries')
            .select(`
                *,
                user:profiles!user_id (
                    id,
                    username,
                    display_name,
                    avatar_url,
                    location,
                    membership_type
                )
            `)
            .eq('group_id', groupId)
            .eq('period_start', '2000-01-01')
            .eq('period_end', '2099-12-31')
            .order('total_points', { ascending: false })
            .range(offset, offset + limit);

        if (error) throw error;

        const entries = (data || []).map((entry, index) => ({
            ...(entry as any),
            rank: offset + index + 1,
        })) as LeaderboardRank[];

        return {
            entries,
            hasMore: entries.length > limit,
        };
    }

    // For rolling periods (7, 30 days), calculate from point_activities directly
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    const periodStartISO = periodStart.toISOString();

    // Query using RPC function for rolling periods
    // Note: get_leaderboard_for_period is added via migration 037
    const { data, error } = await (supabase.rpc as any)('get_leaderboard_for_period', {
        p_group_id: groupId,
        p_period_start: periodStartISO,
        p_limit: limit + 1,
        p_offset: offset
    });

    if (error) {
        // Fallback: Try querying leaderboard_entries with all-time period
        console.warn('RPC get_leaderboard_for_period not available, falling back to all-time:', error.message);
        return getGroupLeaderboard(groupId, 365, limit, offset);
    }

    const results = (data || []) as any[];
    const entries = results.map((entry: any, index: number) => ({
        id: entry.user_id,
        user_id: entry.user_id,
        group_id: groupId,
        total_points: entry.total_points,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        rank: offset + index + 1,
        user: entry.user,
    })) as LeaderboardRank[];

    return {
        entries: entries.slice(0, limit),
        hasMore: entries.length > limit,
    };
}

/**
 * Get user's leaderboard rank using database function
 */
export async function getUserRank(
    userId: string,
    groupId?: string,
    periodDays: number = 30
): Promise<UserRankInfo | null> {
    // Use fixed all-time period for consistent results
    // The database stores entries with either rolling dates OR all-time (2000-01-01 to 2099-12-31)
    let periodStartDate: string;
    let periodEndDate: string;

    if (periodDays >= 365) {
        // All-time uses fixed period
        periodStartDate = '2000-01-01';
        periodEndDate = '2099-12-31';
    } else {
        // For rolling periods, try to use all-time as fallback since rolling periods
        // in leaderboard_entries may not match today's date calculation
        periodStartDate = '2000-01-01';
        periodEndDate = '2099-12-31';
    }

    const { data, error } = await supabase.rpc('get_user_rank', {
        p_user_id: userId,
        p_group_id: groupId || null,
        p_period_start: periodStartDate,
        p_period_end: periodEndDate,
    } as any);

    if (error) throw error;
    if (!data || (data as any[]).length === 0) return null;

    const result = (data as any[])[0];
    return {
        rank: Number(result.rank),
        points: result.points || result.total_points,
        totalUsers: Number(result.total_users),
    };
}

/**
 * Get user's point activity history
 */
export async function getUserPointActivities(
    userId: string,
    limit: number = 50,
    offset: number = 0
): Promise<PointActivity[]> {
    const { data, error } = await supabase
        .from('point_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
}

/**
 * Manual point adjustment (admin only)
 */
export async function adjustUserPoints(
    userId: string,
    points: number,
    description: string,
    groupId?: string
): Promise<void> {
    const { error } = await supabase.rpc('award_points', {
        p_user_id: userId,
        p_action_type: 'manual_adjustment' as PointActionType,
        p_points: points,
        p_group_id: groupId || null,
        p_description: description,
        p_reference_id: null,
    } as any);

    if (error) throw error;
}

/**
 * Get leaderboard statistics
 */
export async function getLeaderboardStats(groupId?: string): Promise<LeaderboardStats> {
    // Use fixed all-time period to get accurate stats
    let query = supabase
        .from('leaderboard_entries')
        .select('total_points')
        .eq('period_start', '2000-01-01')
        .eq('period_end', '2099-12-31');

    if (groupId) {
        query = query.eq('group_id', groupId);
    } else {
        query = query.is('group_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    const points = ((data || []) as any[]).map((e) => e.total_points || 0);
    const totalPoints = points.reduce((sum, p) => sum + p, 0);
    const avgPoints = points.length > 0 ? totalPoints / points.length : 0;
    const maxPoints = Math.max(...points, 0);

    return {
        totalUsers: points.length,
        totalPoints,
        averagePoints: Math.round(avgPoints),
        highestPoints: maxPoints,
    };
}

/**
 * Get top users by points (helper for widgets)
 */
export async function getTopUsers(
    limit: number = 10,
    groupId?: string,
    periodDays: number = 30
): Promise<LeaderboardRank[]> {
    if (groupId) {
        const result = await getGroupLeaderboard(groupId, periodDays, limit);
        return result.entries;
    }
    const result = await getGlobalLeaderboard(periodDays, limit);
    return result.entries;
}

/**
 * Subscribe to leaderboard changes in real-time
 */
export function subscribeToLeaderboardChanges(
    groupId: string | null,
    callback: () => void
) {
    const channel = supabase
        .channel('leaderboard-updates')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'point_activities',
                filter: groupId ? `group_id=eq.${groupId}` : undefined,
            },
            callback
        )
        .subscribe();

    return channel;
}
