import { supabase } from './supabase';
import type { Profile, Post, Group, Category } from '@/types';

// Search result types
export interface SearchResultUser {
    type: 'user';
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_online: boolean | null;
}

export interface SearchResultPost {
    type: 'post';
    id: string;
    title: string | null;
    content: string;
    created_at: string | null;
    group_id: string | null;
    group_name: string | null;
    group_slug: string | null;
    group_is_premium: boolean | null;
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
    category: Pick<Category, 'id' | 'name' | 'slug' | 'color'> | null;
}

export interface SearchResultGroup {
    type: 'group';
    id: string;
    name: string;
    slug: string;
    description: string | null;
    avatar_url: string | null;
    is_private: boolean | null;
    is_premium: boolean | null;
    member_count: number;
}

export type SearchResult = SearchResultUser | SearchResultPost | SearchResultGroup;

export interface SearchResults {
    users: SearchResultUser[];
    posts: SearchResultPost[];
    groups: SearchResultGroup[];
}

// Raw query result types
interface RawPostSearchResult extends Post {
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
    category: Pick<Category, 'id' | 'name' | 'slug' | 'color'> | null;
    group: Pick<Group, 'id' | 'name' | 'slug' | 'is_premium'> | null;
}

/**
 * Search users by display name or username
 */
export async function searchUsers(
    query: string,
    limit: number = 5
): Promise<SearchResultUser[]> {
    if (query.trim().length < 2) {
        return [];
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_online')
        .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(limit);

    if (error) {
        console.error('Error searching users:', error);
        return [];
    }

    return (data || []).map((user) => ({
        type: 'user' as const,
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        is_online: user.is_online,
    }));
}

/**
 * Search posts by title and content
 * Respects premium group restrictions
 */
export async function searchPosts(
    query: string,
    isPremium: boolean,
    limit: number = 5
): Promise<SearchResultPost[]> {
    if (query.trim().length < 2) {
        return [];
    }

    // Search in title and content
    const { data, error } = await supabase
        .from('posts')
        .select(`
            id, title, content, created_at, group_id,
            author:profiles!author_id(id, username, display_name, avatar_url),
            category:categories!category_id(id, name, slug, color),
            group:groups!group_id(id, name, slug, is_premium)
        `)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit * 2); // Fetch more to account for filtering

    if (error) {
        console.error('Error searching posts:', error);
        return [];
    }

    const rawPosts = (data || []) as RawPostSearchResult[];

    // Filter based on premium access
    const filteredPosts = rawPosts.filter((post) => {
        // If post is in a premium group and user is not premium, exclude it
        if (post.group?.is_premium && !isPremium) {
            return false;
        }
        return true;
    });

    return filteredPosts.slice(0, limit).map((post) => ({
        type: 'post' as const,
        id: post.id,
        title: post.title,
        content: post.content,
        created_at: post.created_at,
        group_id: post.group_id,
        group_name: post.group?.name || null,
        group_slug: post.group?.slug || null,
        group_is_premium: post.group?.is_premium || null,
        author: post.author,
        category: post.category,
    }));
}

/**
 * Search groups by name and description
 * Shows all groups but marks premium ones appropriately
 */
export async function searchGroups(
    query: string,
    _userId: string,
    limit: number = 5
): Promise<SearchResultGroup[]> {
    if (query.trim().length < 2) {
        return [];
    }

    const { data, error } = await supabase
        .from('groups')
        .select('id, name, slug, description, avatar_url, is_private, is_premium')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .eq('is_private', false) // Only show public groups
        .limit(limit);

    if (error) {
        console.error('Error searching groups:', error);
        return [];
    }

    // Get member counts for each group
    const groupsWithCounts = await Promise.all(
        (data || []).map(async (group) => {
            const { count } = await supabase
                .from('group_members')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', group.id);

            return {
                type: 'group' as const,
                id: group.id,
                name: group.name,
                slug: group.slug,
                description: group.description,
                avatar_url: group.avatar_url,
                is_private: group.is_private,
                is_premium: group.is_premium,
                member_count: count || 0,
            };
        })
    );

    return groupsWithCounts;
}

/**
 * Unified search across all content types
 * Respects membership tier restrictions
 */
export async function globalSearch(
    query: string,
    userId: string,
    isPremium: boolean,
    limits: { users?: number; posts?: number; groups?: number } = {}
): Promise<SearchResults> {
    const { users: userLimit = 5, posts: postLimit = 5, groups: groupLimit = 5 } = limits;

    if (query.trim().length < 2) {
        return { users: [], posts: [], groups: [] };
    }

    // Execute all searches in parallel
    const [users, posts, groups] = await Promise.all([
        searchUsers(query, userLimit),
        searchPosts(query, isPremium, postLimit),
        searchGroups(query, userId, groupLimit),
    ]);

    return { users, posts, groups };
}

/**
 * Strip HTML tags from content for display
 */
export function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number = 100): string {
    const stripped = stripHtml(text);
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength).trim() + '...';
}
