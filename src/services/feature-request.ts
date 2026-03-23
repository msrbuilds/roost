import { supabase } from './supabase';
import { cached, cacheInvalidate } from '@/lib/cache';
import type {
    FeatureRequest,
    FeatureRequestInsert,
    FeatureRequestComment,
    FeatureRequestCommentInsert,
    FeatureRequestStatus,
    Profile,
} from '@/types/database';
import type {
    FeatureRequestCardData,
    FeatureRequestWithDetails,
    FeatureRequestCommentWithAuthor,
    FeatureRequestFilters,
} from '@/types/feature-request';

// =============================================================================
// FEATURE REQUEST CRUD
// =============================================================================

export async function createFeatureRequest(
    data: Pick<FeatureRequestInsert, 'title' | 'description' | 'type' | 'author_id'>
): Promise<FeatureRequest> {
    const { data: request, error } = await supabase
        .from('feature_requests')
        .insert({
            ...data,
            status: 'under_review',
            vote_count: 0,
            comment_count: 0,
        } as never)
        .select()
        .single();

    if (error) {
        console.error('Error creating feature request:', error);
        throw error;
    }

    cacheInvalidate('feature-requests:');
    return request as FeatureRequest;
}

export async function updateFeatureRequest(
    id: string,
    updates: { title?: string; description?: string; type?: string }
): Promise<FeatureRequest> {
    const { data, error } = await supabase
        .from('feature_requests')
        .update({ ...updates, updated_at: new Date().toISOString() } as never)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating feature request:', error);
        throw error;
    }

    cacheInvalidate('feature-requests:');
    return data as FeatureRequest;
}

export async function deleteFeatureRequest(id: string): Promise<void> {
    const { error } = await supabase.from('feature_requests').delete().eq('id', id);

    if (error) {
        console.error('Error deleting feature request:', error);
        throw error;
    }

    cacheInvalidate('feature-requests:');
}

// =============================================================================
// FETCHING
// =============================================================================

export async function getFeatureRequests(
    filters: FeatureRequestFilters = {},
    pagination?: { limit: number; offset: number }
): Promise<FeatureRequestCardData[]> {
    const { status, statuses, type, sortBy = 'most_votes', search, pinnedOnly } = filters;
    const cacheKey = `feature-requests:list:${status || ''}:${statuses?.join(',') || ''}:${type || ''}:${sortBy}:${search || ''}:${pinnedOnly || ''}:${pagination?.limit || ''}:${pagination?.offset || ''}`;

    return cached(cacheKey, async () => {
    let query = supabase
        .from('feature_requests')
        .select(`
            id, title, description, type, status, vote_count, comment_count, is_pinned, created_at,
            author:profiles!feature_requests_author_id_fkey(id, username, display_name, avatar_url)
        `);

    // Status filters: statuses (array) takes priority over status (single)
    if (statuses && statuses.length > 0) {
        query = query.in('status', statuses);
    } else if (status) {
        query = query.eq('status', status);
    }

    if (type) {
        query = query.eq('type', type);
    }

    if (pinnedOnly) {
        query = query.eq('is_pinned', true);
    }

    if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sortBy) {
        case 'most_votes':
            query = query.order('vote_count', { ascending: false });
            break;
        case 'most_comments':
            query = query.order('comment_count', { ascending: false });
            break;
        case 'oldest':
            query = query.order('created_at', { ascending: true });
            break;
        case 'newest':
        default:
            query = query.order('created_at', { ascending: false });
            break;
    }

    // Pinned items first within sort
    query = query.order('is_pinned', { ascending: false });

    // Apply pagination if provided
    if (pagination) {
        query = query.range(pagination.offset, pagination.offset + pagination.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching feature requests:', error);
        throw error;
    }

    return (data || []).map((item) => ({
        ...item,
        author: item.author as unknown as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>,
    })) as FeatureRequestCardData[];
    }, 120_000); // 2 minute cache
}

export async function getFeatureRequestById(
    id: string,
    userId?: string
): Promise<FeatureRequestWithDetails | null> {
    const { data, error } = await supabase
        .from('feature_requests')
        .select(`
            *,
            author:profiles!feature_requests_author_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('id', id)
        .single();

    if (error || !data) {
        console.error('Error fetching feature request:', error);
        return null;
    }

    // Check if user has voted
    let userHasVoted = false;
    if (userId) {
        const { data: voteData } = await supabase
            .from('reactions')
            .select('id')
            .eq('user_id', userId)
            .eq('reactable_type', 'feature_request')
            .eq('reactable_id', id)
            .maybeSingle();

        userHasVoted = !!voteData;
    }

    return {
        ...data,
        author: data.author as unknown as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>,
        user_has_voted: userHasVoted,
    } as FeatureRequestWithDetails;
}

// =============================================================================
// VOTING (via reactions table)
// =============================================================================

export async function voteForFeatureRequest(requestId: string, userId: string): Promise<boolean> {
    const { error } = await supabase.from('reactions').insert({
        user_id: userId,
        reactable_type: 'feature_request',
        reactable_id: requestId,
        reaction_type: 'like',
    } as never);

    if (error) {
        if (error.code === '23505') {
            // Already voted, remove instead
            await removeFeatureRequestVote(requestId, userId);
            return false;
        }
        console.error('Error voting for feature request:', error);
        throw error;
    }

    return true;
}

export async function removeFeatureRequestVote(requestId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('user_id', userId)
        .eq('reactable_type', 'feature_request')
        .eq('reactable_id', requestId);

    if (error) {
        console.error('Error removing feature request vote:', error);
        throw error;
    }

    return true;
}

export async function hasUserVotedForRequest(requestId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
        .from('reactions')
        .select('id')
        .eq('user_id', userId)
        .eq('reactable_type', 'feature_request')
        .eq('reactable_id', requestId)
        .maybeSingle();

    return !!data;
}

export async function toggleFeatureRequestVote(requestId: string, userId: string): Promise<boolean> {
    const hasVoted = await hasUserVotedForRequest(requestId, userId);

    if (hasVoted) {
        await removeFeatureRequestVote(requestId, userId);
        cacheInvalidate('feature-requests:');
        return false;
    } else {
        await voteForFeatureRequest(requestId, userId);
        cacheInvalidate('feature-requests:');
        return true;
    }
}

export async function getUserVotesForRequests(
    userId: string,
    requestIds: string[]
): Promise<Set<string>> {
    if (requestIds.length === 0) {
        return new Set();
    }

    const { data } = await supabase
        .from('reactions')
        .select('reactable_id')
        .eq('user_id', userId)
        .eq('reactable_type', 'feature_request')
        .in('reactable_id', requestIds);

    return new Set(data?.map((r) => r.reactable_id) || []);
}

// =============================================================================
// ADMIN ACTIONS
// =============================================================================

export async function updateFeatureRequestStatus(
    id: string,
    status: FeatureRequestStatus,
    adminResponse?: string
): Promise<FeatureRequest> {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (adminResponse !== undefined) {
        updates.admin_response = adminResponse;
    }

    const { data, error } = await supabase
        .from('feature_requests')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating feature request status:', error);
        throw error;
    }

    cacheInvalidate('feature-requests:');
    return data as FeatureRequest;
}

export async function togglePinFeatureRequest(id: string, isPinned: boolean): Promise<void> {
    const { error } = await supabase
        .from('feature_requests')
        .update({ is_pinned: isPinned, updated_at: new Date().toISOString() } as never)
        .eq('id', id);

    if (error) {
        console.error('Error toggling pin:', error);
        throw error;
    }

    cacheInvalidate('feature-requests:');
}

// =============================================================================
// COMMENTS
// =============================================================================

interface RawCommentResult extends FeatureRequestComment {
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>;
}

export async function getFeatureRequestComments(
    requestId: string
): Promise<FeatureRequestCommentWithAuthor[]> {
    const { data, error } = await supabase
        .from('feature_request_comments')
        .select(`
            *,
            author:profiles!feature_request_comments_author_id_fkey(id, username, display_name, avatar_url, role)
        `)
        .eq('feature_request_id', requestId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching feature request comments:', error);
        throw error;
    }

    const comments = data as RawCommentResult[] | null;

    // Build comment tree
    const commentMap = new Map<string, FeatureRequestCommentWithAuthor>();
    const topLevelComments: FeatureRequestCommentWithAuthor[] = [];

    comments?.forEach((comment) => {
        const commentWithAuthor: FeatureRequestCommentWithAuthor = {
            ...comment,
            replies: [],
        };
        commentMap.set(comment.id, commentWithAuthor);
    });

    comments?.forEach((comment) => {
        const commentWithAuthor = commentMap.get(comment.id)!;
        if (comment.parent_comment_id) {
            const parent = commentMap.get(comment.parent_comment_id);
            if (parent) {
                parent.replies = parent.replies || [];
                parent.replies.push(commentWithAuthor);
            } else {
                topLevelComments.push(commentWithAuthor);
            }
        } else {
            topLevelComments.push(commentWithAuthor);
        }
    });

    return topLevelComments;
}

export async function createFeatureRequestComment(
    requestId: string,
    authorId: string,
    content: string,
    parentCommentId?: string
): Promise<FeatureRequestComment> {
    const commentData: FeatureRequestCommentInsert = {
        feature_request_id: requestId,
        author_id: authorId,
        content,
        parent_comment_id: parentCommentId || null,
    };

    const { data, error } = await supabase
        .from('feature_request_comments')
        .insert(commentData as never)
        .select()
        .single();

    if (error) {
        console.error('Error creating feature request comment:', error);
        throw error;
    }

    cacheInvalidate('feature-requests:');
    return data as FeatureRequestComment;
}

export async function updateFeatureRequestComment(
    commentId: string,
    content: string
): Promise<FeatureRequestComment> {
    const { data, error } = await supabase
        .from('feature_request_comments')
        .update({
            content,
            is_edited: true,
            updated_at: new Date().toISOString(),
        } as never)
        .eq('id', commentId)
        .select()
        .single();

    if (error) {
        console.error('Error updating feature request comment:', error);
        throw error;
    }

    cacheInvalidate('feature-requests:');
    return data as FeatureRequestComment;
}

export async function deleteFeatureRequestComment(commentId: string): Promise<void> {
    const { error } = await supabase
        .from('feature_request_comments')
        .delete()
        .eq('id', commentId);

    if (error) {
        console.error('Error deleting feature request comment:', error);
        throw error;
    }

    cacheInvalidate('feature-requests:');
}
