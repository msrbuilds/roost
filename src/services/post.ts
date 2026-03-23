import { supabase } from './supabase';
import { cached, cachedSWR, cacheInvalidate } from '@/lib/cache';
import type { Post, PostInsert, PostUpdate, Profile, Category, ReactionType } from '@/types';

// Extended post type with author and category info
export interface PostWithDetails extends Post {
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'membership_type' | 'role'>;
    category: Pick<Category, 'id' | 'name' | 'slug' | 'color'> | null;
    comment_count: number;
    reaction_counts: {
        like: number;
        love: number;
        fire: number;
        clap: number;
        think: number;
        haha: number;
        total: number;
    };
}

// Raw query result type
interface RawPostResult extends Post {
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'membership_type' | 'role'>;
    category: Pick<Category, 'id' | 'name' | 'slug' | 'color'> | null;
}

// Options for fetching posts
export interface GetPostsOptions {
    limit?: number;
    offset?: number;
    categoryId?: string;
    authorId?: string;
    pinnedFirst?: boolean;
    adminOnly?: boolean;
    sortBy?: 'newest' | 'popular' | 'trending';
    followedUserIds?: string[];
}

/**
 * Fetch posts with author details, category, and counts
 */
export async function getPosts(
    groupId?: string | null,
    options: GetPostsOptions = {}
): Promise<{ posts: PostWithDetails[]; hasMore: boolean }> {
    const { limit = 10, offset = 0, categoryId, authorId, pinnedFirst = true, adminOnly = false, sortBy = 'newest', followedUserIds } = options;

    const followedKey = followedUserIds ? followedUserIds.length.toString() : 'all';
    const cacheKey = `posts:${groupId}:${offset}:${limit}:${categoryId}:${authorId}:${pinnedFirst}:${adminOnly}:${sortBy}:${followedKey}`;
    return cached(cacheKey, async () => {

    // If admin-only filter is active, fetch admin user IDs first
    let adminIds: string[] = [];
    if (adminOnly) {
        const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .in('role', ['admin', 'superadmin']);
        adminIds = (admins || []).map(a => a.id);
        if (adminIds.length === 0) {
            return { posts: [], hasMore: false };
        }
    }

    let query = supabase
        .from('posts')
        .select(`
      *,
      author:profiles!author_id(id, username, display_name, avatar_url, membership_type, role),
      category:categories!category_id(id, name, slug, color)
    `)
        .range(offset, offset + limit);

    // Filter by group_id
    // undefined = show all posts (home feed)
    // null = show only general posts (no group)
    // string = show posts from specific group
    if (groupId === undefined) {
        // No filter - show all posts from all groups and general feed
    } else if (groupId === null) {
        query = query.is('group_id', null);
    } else {
        query = query.eq('group_id', groupId);
    }

    // Apply filters
    if (categoryId) {
        query = query.eq('category_id', categoryId);
    }

    if (adminOnly && adminIds.length > 0) {
        query = query.in('author_id', adminIds);
    } else if (authorId) {
        query = query.eq('author_id', authorId);
    }

    // Filter by followed users (home feed mode)
    // Always includes admin/moderator posts so they're visible to everyone
    if (followedUserIds && followedUserIds.length > 0) {
        const { data: adminModProfiles } = await supabase
            .from('profiles')
            .select('id')
            .in('role', ['admin', 'superadmin', 'moderator']);

        const adminModIds = (adminModProfiles || []).map(p => p.id);
        const visibleAuthorIds = [...new Set([...followedUserIds, ...adminModIds])];

        query = query.in('author_id', visibleAuthorIds);
    } else if (followedUserIds && followedUserIds.length === 0) {
        // User follows nobody - only show admin/mod posts
        const { data: adminModProfiles } = await supabase
            .from('profiles')
            .select('id')
            .in('role', ['admin', 'superadmin', 'moderator']);

        const adminModIds = (adminModProfiles || []).map(p => p.id);
        if (adminModIds.length > 0) {
            query = query.in('author_id', adminModIds);
        } else {
            return { posts: [], hasMore: false };
        }
    }

    // Order by pinned first, then by date
    if (pinnedFirst) {
        query = query.order('is_pinned', { ascending: false });
    }
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    const posts = data as RawPostResult[] | null;

    if (error) {
        console.error('Error fetching posts:', error);
        throw error;
    }

    const postList = posts || [];
    if (postList.length === 0) {
        return { posts: [], hasMore: false };
    }

    const postIds = postList.map(p => p.id);

    // Batch fetch: comment counts and reactions in 2 queries instead of 2*N
    const [commentsResult, reactionsResult] = await Promise.all([
        supabase
            .from('comments')
            .select('post_id')
            .in('post_id', postIds),
        supabase
            .from('reactions')
            .select('reactable_id, reaction_type')
            .eq('reactable_type', 'post')
            .in('reactable_id', postIds),
    ]);

    // Build comment count map
    const commentCountMap: Record<string, number> = {};
    (commentsResult.data || []).forEach((c: { post_id: string | null }) => {
        if (c.post_id) {
            commentCountMap[c.post_id] = (commentCountMap[c.post_id] || 0) + 1;
        }
    });

    // Build reaction count map
    const reactionCountMap: Record<string, PostWithDetails['reaction_counts']> = {};
    (reactionsResult.data as { reactable_id: string; reaction_type: ReactionType }[] || []).forEach((r) => {
        if (!r.reaction_type) return;
        if (!reactionCountMap[r.reactable_id]) {
            reactionCountMap[r.reactable_id] = { like: 0, love: 0, fire: 0, clap: 0, think: 0, haha: 0, total: 0 };
        }
        const counts = reactionCountMap[r.reactable_id];
        counts[r.reaction_type]++;
        counts.total++;
    });

    const defaultReactions = { like: 0, love: 0, fire: 0, clap: 0, think: 0, haha: 0, total: 0 };

    let postsWithCounts: PostWithDetails[] = postList.map(post => ({
        ...post,
        comment_count: commentCountMap[post.id] || 0,
        reaction_counts: reactionCountMap[post.id] || { ...defaultReactions },
    }));

    // Client-side sort for popular/trending (DB already sorts by newest)
    if (sortBy === 'popular') {
        postsWithCounts.sort((a, b) => b.reaction_counts.total - a.reaction_counts.total);
    } else if (sortBy === 'trending') {
        postsWithCounts.sort((a, b) => b.comment_count - a.comment_count);
    }

    return {
        posts: postsWithCounts,
        hasMore: postsWithCounts.length > limit,
    };
    }); // end cached()
}

/**
 * Get a single post by ID with full details
 */
export async function getPostById(postId: string): Promise<PostWithDetails | null> {
    const cacheKey = `post:${postId}`;
    return cached(cacheKey, async () => {
        const { data, error } = await supabase
            .from('posts')
            .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, membership_type, role),
          category:categories!category_id(id, name, slug, color)
        `)
            .eq('id', postId)
            .single();

        const post = data as RawPostResult | null;

        if (error || !post) {
            console.error('Error fetching post:', error);
            return null;
        }

        // Parallel fetch comment count and reactions for single post
        const [commentsResult, reactionsResult] = await Promise.all([
            supabase
                .from('comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', postId),
            supabase
                .from('reactions')
                .select('reaction_type')
                .eq('reactable_type', 'post')
                .eq('reactable_id', postId),
        ]);

        const reactionCounts = { like: 0, love: 0, fire: 0, clap: 0, think: 0, haha: 0, total: 0 };
        const reactions = reactionsResult.data as { reaction_type: ReactionType }[] | null;
        if (reactions) {
            reactions.forEach((r) => {
                reactionCounts[r.reaction_type]++;
                reactionCounts.total++;
            });
        }

        return {
            ...post,
            comment_count: commentsResult.count || 0,
            reaction_counts: reactionCounts,
        } as PostWithDetails;
    }, 60_000); // 1 minute - real-time updates will use fresh data via invalidation
}

/**
 * Create a new post
 */
export async function createPost(post: PostInsert): Promise<Post> {
    const { data, error } = await supabase
        .from('posts')
        .insert(post as never)
        .select()
        .single();

    if (error) {
        console.error('Error creating post:', error);
        throw error;
    }

    cacheInvalidate('posts:');
    return data as Post;
}

/**
 * Update an existing post
 */
export async function updatePost(postId: string, updates: PostUpdate): Promise<Post> {
    const { data, error } = await supabase
        .from('posts')
        .update({ ...updates, is_edited: true, updated_at: new Date().toISOString() } as never)
        .eq('id', postId)
        .select()
        .single();

    if (error) {
        console.error('Error updating post:', error);
        throw error;
    }

    cacheInvalidate('posts:');
    return data as Post;
}

/**
 * Delete a post
 */
export async function deletePost(postId: string): Promise<void> {
    const { error } = await supabase.from('posts').delete().eq('id', postId);

    if (error) {
        console.error('Error deleting post:', error);
        throw error;
    }

    cacheInvalidate('posts:');
}

/**
 * Toggle pin status on a post (admin only)
 */
export async function togglePinPost(postId: string): Promise<Post> {
    // Get current pin status
    const { data: postData } = await supabase
        .from('posts')
        .select('is_pinned')
        .eq('id', postId)
        .single();

    const post = postData as { is_pinned: boolean } | null;
    const newPinStatus = !post?.is_pinned;

    const { data, error } = await supabase
        .from('posts')
        .update({ is_pinned: newPinStatus } as never)
        .eq('id', postId)
        .select()
        .single();

    if (error) {
        console.error('Error toggling pin:', error);
        throw error;
    }

    cacheInvalidate('posts:');
    return data as Post;
}

/**
 * Get categories for a group
 */
export async function getCategories(groupId?: string): Promise<Category[]> {
    const cacheKey = `categories:${groupId || 'all'}`;
    return cachedSWR(cacheKey, async () => {
        let query = supabase.from('categories').select('*').order('name');

        if (groupId) {
            query = query.or(`group_id.eq.${groupId},group_id.is.null`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching categories:', error);
            return [];
        }

        return data || [];
    }, 300_000); // 5 minutes - categories rarely change
}
