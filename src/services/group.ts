import { supabase } from './supabase';
import { cached, cacheInvalidate } from '@/lib/cache';
import type { Group, GroupInsert, GroupUpdate, GroupMember, GroupRole, Profile } from '@/types';

// Extended group type with member count and user membership info
export interface GroupWithDetails extends Group {
    member_count: number;
    is_member: boolean;
    user_role: GroupRole | null;
    creator: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

// Group member with profile info
export interface GroupMemberWithProfile extends GroupMember {
    profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

// Options for fetching groups
export interface GetGroupsOptions {
    limit?: number;
    offset?: number;
    search?: string;
    includePrivate?: boolean;
    userId?: string; // For checking membership
}

// Raw query result type
interface RawGroupResult extends Group {
    creator: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

/**
 * Generate a URL-friendly slug from a group name
 */
export function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Check if a slug is already taken
 */
export async function isSlugAvailable(slug: string, excludeGroupId?: string): Promise<boolean> {
    let query = supabase
        .from('groups')
        .select('id', { count: 'exact', head: true })
        .eq('slug', slug);

    if (excludeGroupId) {
        query = query.neq('id', excludeGroupId);
    }

    const { count, error } = await query;

    if (error) {
        console.error('Error checking slug availability:', error);
        throw error;
    }

    return count === 0;
}

/**
 * Fetch groups with member counts and user membership info
 */
export async function getGroups(
    options: GetGroupsOptions = {}
): Promise<{ groups: GroupWithDetails[]; hasMore: boolean }> {
    const { limit = 12, offset = 0, search, includePrivate = false, userId } = options;

    const cacheKey = `groups:${offset}:${limit}:${search || ''}:${includePrivate}:${userId || ''}`;
    return cached(cacheKey, async () => {

    let query = supabase
        .from('groups')
        .select(`
            *,
            creator:profiles!created_by(id, username, display_name, avatar_url)
        `)
        .range(offset, offset + limit)
        .order('created_at', { ascending: false });

    // Filter out private groups unless explicitly included
    if (!includePrivate) {
        query = query.eq('is_private', false);
    }

    // Search by name or description
    if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;
    const groups = data as RawGroupResult[] | null;

    if (error) {
        console.error('Error fetching groups:', error);
        throw error;
    }

    const groupList = groups || [];
    if (groupList.length === 0) {
        return { groups: [], hasMore: false };
    }

    const groupIds = groupList.map(g => g.id);

    // Batch fetch: member counts and user memberships in 1-2 queries instead of 2*N
    const membersQuery = supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds);

    const membershipQuery = userId
        ? supabase
            .from('group_members')
            .select('group_id, role')
            .eq('user_id', userId)
            .in('group_id', groupIds)
        : null;

    const [membersResult, membershipResult] = await Promise.all([
        membersQuery,
        ...(membershipQuery ? [membershipQuery] : []),
    ]);

    // Build member count map
    const memberCountMap: Record<string, number> = {};
    (membersResult.data || []).forEach((m: { group_id: string }) => {
        memberCountMap[m.group_id] = (memberCountMap[m.group_id] || 0) + 1;
    });

    // Build membership map
    const membershipMap: Record<string, GroupRole> = {};
    if (userId && membershipResult?.data) {
        (membershipResult.data as Array<{ group_id: string; role: GroupRole }>).forEach(m => {
            membershipMap[m.group_id] = m.role;
        });
    }

    const groupsWithDetails: GroupWithDetails[] = groupList.map(group => ({
        ...group,
        member_count: memberCountMap[group.id] || 0,
        is_member: !!membershipMap[group.id],
        user_role: membershipMap[group.id] || null,
    }));

    return {
        groups: groupsWithDetails,
        hasMore: groupsWithDetails.length > limit,
    };
    }); // end cached()
}

/**
 * Get a single group by slug with full details
 */
export async function getGroupBySlug(slug: string, userId?: string): Promise<GroupWithDetails | null> {
    const cacheKey = `group:slug:${slug}:${userId || ''}`;
    return cached(cacheKey, async () => {
        const { data, error } = await supabase
            .from('groups')
            .select(`
                *,
                creator:profiles!created_by(id, username, display_name, avatar_url)
            `)
            .eq('slug', slug)
            .single();

        const group = data as RawGroupResult | null;

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            console.error('Error fetching group:', error);
            throw error;
        }

        if (!group) return null;

        return enrichGroupWithDetails(group, userId);
    });
}

/**
 * Get a single group by ID
 */
export async function getGroupById(groupId: string, userId?: string): Promise<GroupWithDetails | null> {
    const cacheKey = `group:id:${groupId}:${userId || ''}`;
    return cached(cacheKey, async () => {
        const { data, error } = await supabase
            .from('groups')
            .select(`
                *,
                creator:profiles!created_by(id, username, display_name, avatar_url)
            `)
            .eq('id', groupId)
            .single();

        const group = data as RawGroupResult | null;

        if (error) {
            if (error.code === 'PGRST116') return null;
            console.error('Error fetching group:', error);
            throw error;
        }

        if (!group) return null;

        return enrichGroupWithDetails(group, userId);
    });
}

/**
 * Enrich a single group with member count and user membership (parallel fetch)
 */
async function enrichGroupWithDetails(group: RawGroupResult, userId?: string): Promise<GroupWithDetails> {
    const countQuery = supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id);

    const membershipQuery = userId
        ? supabase
            .from('group_members')
            .select('role')
            .eq('group_id', group.id)
            .eq('user_id', userId)
            .maybeSingle()
        : null;

    const [countResult, membershipResult] = await Promise.all([
        countQuery,
        ...(membershipQuery ? [membershipQuery] : []),
    ]);

    let isMember = false;
    let userRole: GroupRole | null = null;
    if (userId && membershipResult?.data) {
        isMember = true;
        userRole = (membershipResult.data as { role: GroupRole }).role;
    }

    return {
        ...group,
        member_count: countResult.count || 0,
        is_member: isMember,
        user_role: userRole,
    } as GroupWithDetails;
}

/**
 * Create a new group (creator becomes admin automatically)
 */
export async function createGroup(group: GroupInsert): Promise<Group> {
    // Generate slug if not provided
    const slug = group.slug || generateSlug(group.name);

    // Verify slug is available
    const slugAvailable = await isSlugAvailable(slug);
    if (!slugAvailable) {
        throw new Error('Group slug is already taken. Please choose a different name.');
    }

    const { data, error } = await supabase
        .from('groups')
        .insert({ ...group, slug } as never)
        .select()
        .single();

    if (error) {
        console.error('Error creating group:', error);
        throw error;
    }

    const newGroup = data as Group;

    // Note: Creator is automatically added as admin via the on_group_created database trigger
    // No manual insert needed here to avoid duplicate key constraint violation

    cacheInvalidate('groups:');
    cacheInvalidate('group:');
    return newGroup;
}

/**
 * Update an existing group
 */
export async function updateGroup(groupId: string, updates: GroupUpdate): Promise<Group> {
    // If name is being updated, generate new slug
    let slug = updates.slug;
    if (updates.name && !updates.slug) {
        slug = generateSlug(updates.name);
        const slugAvailable = await isSlugAvailable(slug, groupId);
        if (!slugAvailable) {
            throw new Error('Group slug is already taken. Please choose a different name.');
        }
    }

    const { data, error } = await supabase
        .from('groups')
        .update({ ...updates, slug, updated_at: new Date().toISOString() } as never)
        .eq('id', groupId)
        .select()
        .single();

    if (error) {
        console.error('Error updating group:', error);
        throw error;
    }

    cacheInvalidate('groups:');
    cacheInvalidate('group:');
    return data as Group;
}

/**
 * Delete a group (cascades to members, posts, etc.)
 */
export async function deleteGroup(groupId: string): Promise<void> {
    const { error } = await supabase.from('groups').delete().eq('id', groupId);

    if (error) {
        console.error('Error deleting group:', error);
        throw error;
    }

    cacheInvalidate('groups:');
    cacheInvalidate('group:');
}

/**
 * Join a group
 */
export async function joinGroup(groupId: string, userId: string): Promise<GroupMember> {
    // Check if already a member
    const existing = await checkMembership(groupId, userId);
    if (existing) {
        return existing;
    }

    const { data, error } = await supabase
        .from('group_members')
        .insert({
            group_id: groupId,
            user_id: userId,
            role: 'member',
        } as never)
        .select()
        .single();

    if (error) {
        console.error('Error joining group:', error);
        throw error;
    }

    cacheInvalidate('groups:');
    cacheInvalidate('group:');
    return data as GroupMember;
}

/**
 * Leave a group
 */
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
    // Check if user is the only admin
    const membership = await checkMembership(groupId, userId);
    if (membership?.role === 'admin') {
        const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', groupId)
            .eq('role', 'admin');

        if (count === 1) {
            throw new Error('Cannot leave group as the only admin. Transfer ownership or delete the group.');
        }
    }

    const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

    if (error) {
        console.error('Error leaving group:', error);
        throw error;
    }

    cacheInvalidate('groups:');
    cacheInvalidate('group:');
}

/**
 * Get group members with profile info
 */
export async function getGroupMembers(
    groupId: string,
    options: { limit?: number; offset?: number; role?: GroupRole } = {}
): Promise<{ members: GroupMemberWithProfile[]; hasMore: boolean }> {
    const { limit = 20, offset = 0, role } = options;

    let query = supabase
        .from('group_members')
        .select(`
            *,
            profile:profiles!user_id(id, username, display_name, avatar_url)
        `)
        .eq('group_id', groupId)
        .range(offset, offset + limit)
        .order('joined_at', { ascending: false });

    if (role) {
        query = query.eq('role', role);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching group members:', error);
        throw error;
    }

    const members = (data || []) as GroupMemberWithProfile[];

    return {
        members,
        hasMore: members.length > limit,
    };
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
    groupId: string,
    userId: string,
    newRole: GroupRole
): Promise<void> {
    // Prevent demoting the last admin
    if (newRole !== 'admin') {
        const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', groupId)
            .eq('role', 'admin')
            .neq('user_id', userId);

        if (count === 0) {
            throw new Error('Cannot demote the only admin. Promote another member first.');
        }
    }

    const { error } = await supabase
        .from('group_members')
        .update({ role: newRole } as never)
        .eq('group_id', groupId)
        .eq('user_id', userId);

    if (error) {
        console.error('Error updating member role:', error);
        throw error;
    }
}

/**
 * Remove a member from a group
 */
export async function removeMember(groupId: string, userId: string): Promise<void> {
    // Cannot remove the only admin
    const membership = await checkMembership(groupId, userId);
    if (membership?.role === 'admin') {
        const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', groupId)
            .eq('role', 'admin');

        if (count === 1) {
            throw new Error('Cannot remove the only admin. Transfer ownership first.');
        }
    }

    const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

    if (error) {
        console.error('Error removing member:', error);
        throw error;
    }
}

/**
 * Check if a user is a member of a group
 */
export async function checkMembership(groupId: string, userId: string): Promise<GroupMember | null> {
    const { data, error } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Error checking membership:', error);
        throw error;
    }

    return data as GroupMember | null;
}

/**
 * Get member count for a group
 */
export async function getMemberCount(groupId: string): Promise<number> {
    const { count, error } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

    if (error) {
        console.error('Error getting member count:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Get groups that a user is a member of
 */
export async function getUserGroups(userId: string): Promise<GroupWithDetails[]> {
    const { data: memberships, error } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user groups:', error);
        throw error;
    }

    if (!memberships || memberships.length === 0) {
        return [];
    }

    const typedMemberships = memberships as Array<{ group_id: string; role: string }>;
    const groupIds = typedMemberships.map(m => m.group_id);
    const roleMap = new Map(typedMemberships.map(m => [m.group_id, m.role as GroupRole]));

    const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select(`
            *,
            creator:profiles!created_by(id, username, display_name, avatar_url)
        `)
        .in('id', groupIds);

    if (groupsError) {
        console.error('Error fetching user groups:', groupsError);
        throw groupsError;
    }

    const typedGroups = groups as RawGroupResult[] | null;

    const groupList = typedGroups || [];
    if (groupList.length === 0) return [];

    // Batch fetch member counts in 1 query instead of N
    const { data: allMembers } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupList.map(g => g.id));

    const memberCountMap: Record<string, number> = {};
    (allMembers || []).forEach((m: { group_id: string }) => {
        memberCountMap[m.group_id] = (memberCountMap[m.group_id] || 0) + 1;
    });

    return groupList.map(group => ({
        ...group,
        member_count: memberCountMap[group.id] || 0,
        is_member: true,
        user_role: roleMap.get(group.id) || null,
    } as GroupWithDetails));
}

/**
 * Check if user has permission for an action in a group
 */
export function hasPermission(
    userRole: GroupRole | null,
    action: 'create_post' | 'delete_any_post' | 'pin_post' | 'manage_members' | 'edit_settings' | 'delete_group'
): boolean {
    if (!userRole) return false;

    const permissions: Record<GroupRole, string[]> = {
        admin: ['create_post', 'delete_any_post', 'pin_post', 'manage_members', 'edit_settings', 'delete_group'],
        moderator: ['create_post', 'delete_any_post', 'pin_post', 'manage_members'],
        member: ['create_post'],
    };

    return permissions[userRole].includes(action);
}

/**
 * Get assets for a group
 */
export async function getGroupAssets(groupId: string): Promise<any[]> {
    const { data, error } = await supabase
        .from('group_assets')
        .select(`
            *,
            asset:assets!asset_id(*),
            uploader:profiles!uploaded_by(id, username, display_name, avatar_url)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching group assets:', error);
        throw error;
    }

    return data || [];
}

/**
 * Link asset to group (after uploading to S3)
 */
export async function linkAssetToGroup(
    groupId: string,
    assetId: string,
    userId: string,
    moduleId?: string | null
): Promise<void> {
    const { error } = await supabase
        .from('group_assets')
        .insert({
            group_id: groupId,
            asset_id: assetId,
            uploaded_by: userId,
            ...(moduleId ? { module_id: moduleId } : {}),
        } as never);

    if (error) {
        console.error('Error linking asset to group:', error);
        throw error;
    }
}

/**
 * Delete group asset
 */
export async function deleteGroupAsset(groupAssetId: string): Promise<void> {
    const { error } = await supabase
        .from('group_assets')
        .delete()
        .eq('id', groupAssetId);

    if (error) {
        console.error('Error deleting group asset:', error);
        throw error;
    }
}

/**
 * Get recordings for a group
 */
export async function getGroupRecordings(groupId: string): Promise<any[]> {
    const { data, error } = await supabase
        .from('recordings')
        .select(`
            *,
            publisher:profiles!published_by(id, username, display_name, avatar_url)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching group recordings:', error);
        throw error;
    }

    return data || [];
}

/**
 * Create a recording
 */
export async function createRecording(recording: any): Promise<any> {
    const { data, error } = await supabase
        .from('recordings')
        .insert(recording as never)
        .select()
        .single();

    if (error) {
        console.error('Error creating recording:', error);
        throw error;
    }

    return data;
}

/**
 * Update a recording
 */
export async function updateRecording(id: string, updates: any): Promise<any> {
    const { data, error } = await supabase
        .from('recordings')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating recording:', error);
        throw error;
    }

    return data;
}

/**
 * Delete a recording
 */
export async function deleteRecording(id: string): Promise<void> {
    const { error } = await supabase
        .from('recordings')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting recording:', error);
        throw error;
    }
}

/**
 * Check if a user can access a group (premium check)
 * Returns true if:
 * - Group is not premium, or
 * - User has premium access
 */
export async function canAccessGroup(groupId: string, userId: string): Promise<boolean> {
    // Use database function to check access
    const { data, error } = await supabase.rpc('can_access_group', {
        p_user_id: userId,
        p_group_id: groupId,
    });

    if (error) {
        console.error('Error checking group access:', error);
        return false;
    }

    return data ?? false;
}

/**
 * Check if user has premium access
 */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('has_premium_access', {
        p_user_id: userId,
    });

    if (error) {
        console.error('Error checking premium access:', error);
        return false;
    }

    return data ?? false;
}
