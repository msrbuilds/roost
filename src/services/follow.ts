import { supabase } from './supabase';
import { cached, cacheInvalidate } from '@/lib/cache';
import type { Profile } from '@/types/database';

/**
 * Toggle follow/unfollow a user
 */
export async function toggleFollow(
    followerId: string,
    followingId: string
): Promise<{ isFollowing: boolean }> {
    // Check if already following
    const { data: existing } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();

    if (existing) {
        // Unfollow
        await supabase.from('follows').delete().eq('id', existing.id);
        cacheInvalidate(`follows:${followerId}`);
        return { isFollowing: false };
    }

    // Follow
    const { error } = await supabase.from('follows').insert({
        follower_id: followerId,
        following_id: followingId,
    } as never);

    if (error) {
        console.error('Error following user:', error);
        throw error;
    }

    cacheInvalidate(`follows:${followerId}`);
    return { isFollowing: true };
}

/**
 * Check if current user follows a specific user
 */
export async function isFollowing(
    followerId: string,
    followingId: string
): Promise<boolean> {
    const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();

    return !!data;
}

/**
 * Get all user IDs that a user follows (for feed filtering)
 * Cached for 60 seconds, invalidated on follow/unfollow
 */
export async function getFollowedUserIds(userId: string): Promise<string[]> {
    const cacheKey = `follows:${userId}:ids`;
    return cached(cacheKey, async () => {
        const { data, error } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', userId);

        if (error) {
            console.error('Error fetching followed user IDs:', error);
            return [];
        }

        return (data || []).map(f => f.following_id);
    }, 60_000);
}

/**
 * Batch check follow status for multiple users
 * Returns a Set of user IDs that the current user follows
 */
export async function getFollowStatusForUsers(
    followerId: string,
    userIds: string[]
): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();

    const { data, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', followerId)
        .in('following_id', userIds);

    if (error || !data) return new Set();

    return new Set(data.map(f => f.following_id));
}

/**
 * Get follower count for a user
 */
export async function getFollowerCount(userId: string): Promise<number> {
    const { count, error } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

    if (error) return 0;
    return count || 0;
}

/**
 * Get following count for a user
 */
export async function getFollowingCount(userId: string): Promise<number> {
    const { count, error } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

    if (error) return 0;
    return count || 0;
}

/**
 * Get profiles who follow a given user (paginated)
 */
export async function getFollowers(
    userId: string,
    limit = 20,
    offset = 0
): Promise<{ profiles: Profile[]; hasMore: boolean }> {
    const { data, error } = await supabase
        .from('follows')
        .select('follower:profiles!follower_id(*)')
        .eq('following_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit);

    if (error) {
        console.error('Error fetching followers:', error);
        return { profiles: [], hasMore: false };
    }

    const profiles = (data || []).map((row: any) => row.follower as Profile);
    return { profiles, hasMore: profiles.length > limit };
}

/**
 * Get profiles that a given user follows (paginated)
 */
export async function getFollowing(
    userId: string,
    limit = 20,
    offset = 0
): Promise<{ profiles: Profile[]; hasMore: boolean }> {
    const { data, error } = await supabase
        .from('follows')
        .select('following:profiles!following_id(*)')
        .eq('follower_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit);

    if (error) {
        console.error('Error fetching following:', error);
        return { profiles: [], hasMore: false };
    }

    const profiles = (data || []).map((row: any) => row.following as Profile);
    return { profiles, hasMore: profiles.length > limit };
}
