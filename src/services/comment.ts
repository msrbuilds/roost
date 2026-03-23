import { supabase } from './supabase';
import { cached, cacheInvalidate } from '@/lib/cache';
import type { Comment, CommentInsert, CommentUpdate, Profile, ReactionType } from '@/types';
import type { ReactionCounts } from './reaction';
import type { VoteCounts } from './commentVote';

const DEFAULT_REACTION_COUNTS: ReactionCounts = { like: 0, love: 0, fire: 0, clap: 0, think: 0, haha: 0, total: 0 };
const DEFAULT_VOTE_COUNTS: VoteCounts = { upvotes: 0, downvotes: 0, score: 0 };

// Extended comment type with author info
export interface CommentWithAuthor extends Comment {
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'membership_type' | 'role'>;
    replies?: CommentWithAuthor[];
    reaction_counts: ReactionCounts;
    vote_counts: VoteCounts;
}

// Raw query result type
interface RawCommentResult extends Comment {
    author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'membership_type' | 'role'>;
}

const COMMENTS_PER_PAGE = 15;

/**
 * Fetch comments for a post (with nested replies, paginated)
 * @param postId - The post to fetch comments for
 * @param limit - Max comments to fetch (includes replies). Use 0 for all.
 * @param userId - Optional user ID to batch-fetch user reactions in the same call
 */
export async function getComments(
    postId: string,
    limit: number = COMMENTS_PER_PAGE,
    userId?: string
): Promise<{
    comments: CommentWithAuthor[];
    hasMore: boolean;
    userReactions: Map<string, string>;
    userVotes: Map<string, string>;
}> {
    const cacheKey = `comments:${postId}:${limit}`;
    return cached(cacheKey, async () => {
    // Fetch comments + a buffer for replies (we paginate on total, not top-level)
    const fetchLimit = limit > 0 ? limit * 2 : 0; // 2x buffer for nested replies

    let query = supabase
        .from('comments')
        .select(`
      *,
      author:profiles!author_id(id, username, display_name, avatar_url, membership_type, role)
    `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

    if (fetchLimit > 0) {
        query = query.limit(fetchLimit);
    }

    const { data, error } = await query;

    const comments = data as RawCommentResult[] | null;

    if (error) {
        console.error('Error fetching comments:', error);
        throw error;
    }

    const commentIds = comments?.map((c) => c.id) || [];

    // Fetch reaction counts, user reactions, vote counts, and user votes in parallel
    let reactionCountsMap: Record<string, ReactionCounts> = {};
    let voteCountsMap: Record<string, VoteCounts> = {};
    let userReactions = new Map<string, string>();
    let userVotes = new Map<string, string>();

    if (commentIds.length > 0) {
        const [reactionsResult, userReactionsResult, votesResult, userVotesResult] = await Promise.all([
            supabase
                .from('reactions')
                .select('reactable_id, reaction_type')
                .eq('reactable_type', 'comment')
                .in('reactable_id', commentIds),
            userId
                ? supabase
                    .from('reactions')
                    .select('reactable_id, reaction_type')
                    .eq('user_id', userId)
                    .eq('reactable_type', 'comment')
                    .in('reactable_id', commentIds)
                : Promise.resolve({ data: null }),
            (supabase.from as any)('comment_votes')
                .select('comment_id, vote_type')
                .in('comment_id', commentIds),
            userId
                ? (supabase.from as any)('comment_votes')
                    .select('comment_id, vote_type')
                    .eq('user_id', userId)
                    .in('comment_id', commentIds)
                : Promise.resolve({ data: null }),
        ]);

        // Build per-comment reaction counts
        const reactions = reactionsResult.data as { reactable_id: string; reaction_type: ReactionType }[] | null;
        reactions?.forEach((r) => {
            if (!reactionCountsMap[r.reactable_id]) {
                reactionCountsMap[r.reactable_id] = { ...DEFAULT_REACTION_COUNTS };
            }
            reactionCountsMap[r.reactable_id][r.reaction_type]++;
            reactionCountsMap[r.reactable_id].total++;
        });

        // Build user reactions map
        const userReactionsData = userReactionsResult.data as { reactable_id: string; reaction_type: string }[] | null;
        userReactionsData?.forEach((r) => {
            userReactions.set(r.reactable_id, r.reaction_type);
        });

        // Build per-comment vote counts
        const votes = votesResult.data as { comment_id: string; vote_type: string }[] | null;
        votes?.forEach((v) => {
            if (!voteCountsMap[v.comment_id]) {
                voteCountsMap[v.comment_id] = { upvotes: 0, downvotes: 0, score: 0 };
            }
            if (v.vote_type === 'up') voteCountsMap[v.comment_id].upvotes++;
            else voteCountsMap[v.comment_id].downvotes++;
        });
        Object.values(voteCountsMap).forEach((c) => {
            c.score = c.upvotes - c.downvotes;
        });

        // Build user votes map
        const userVotesData = userVotesResult.data as { comment_id: string; vote_type: string }[] | null;
        userVotesData?.forEach((v) => {
            userVotes.set(v.comment_id, v.vote_type);
        });
    }

    // Build comment tree (top-level and nested)
    const commentMap = new Map<string, CommentWithAuthor>();
    const topLevelComments: CommentWithAuthor[] = [];

    // First pass: create all comment objects
    comments?.forEach((comment) => {
        const commentWithAuthor: CommentWithAuthor = {
            ...comment,
            reaction_counts: reactionCountsMap[comment.id] || { ...DEFAULT_REACTION_COUNTS },
            vote_counts: voteCountsMap[comment.id] || { ...DEFAULT_VOTE_COUNTS },
            replies: [],
        };
        commentMap.set(comment.id, commentWithAuthor);
    });

    // Second pass: build tree structure
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

    // Determine if there are more comments
    const hasMore = fetchLimit > 0 && (comments?.length || 0) >= fetchLimit;

    return { comments: topLevelComments, hasMore, userReactions, userVotes };
    }, 60_000); // 1 minute cache
}

/**
 * Create a new comment
 */
export async function createComment(
    postId: string,
    authorId: string,
    content: string,
    parentCommentId?: string
): Promise<Comment> {
    const commentData: CommentInsert = {
        post_id: postId,
        author_id: authorId,
        content,
        parent_comment_id: parentCommentId || null,
    };

    const { data, error } = await supabase
        .from('comments')
        .insert(commentData as never)
        .select()
        .single();

    if (error) {
        console.error('Error creating comment:', error);
        throw error;
    }

    cacheInvalidate(`comments:${postId}`);
    return data as Comment;
}

/**
 * Update a comment
 */
export async function updateComment(
    commentId: string,
    content: string,
    postId?: string
): Promise<Comment> {
    const updates: CommentUpdate = {
        content,
        is_edited: true,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('comments')
        .update(updates as never)
        .eq('id', commentId)
        .select()
        .single();

    if (error) {
        console.error('Error updating comment:', error);
        throw error;
    }

    // Scoped invalidation: only clear this post's comment cache
    if (postId) {
        cacheInvalidate(`comments:${postId}`);
    } else {
        cacheInvalidate('comments:');
    }
    return data as Comment;
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string, postId?: string): Promise<void> {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);

    if (error) {
        console.error('Error deleting comment:', error);
        throw error;
    }

    // Scoped invalidation: only clear this post's comment cache
    if (postId) {
        cacheInvalidate(`comments:${postId}`);
    } else {
        cacheInvalidate('comments:');
    }
}

/**
 * Get comment count for a post
 */
export async function getCommentCount(postId: string): Promise<number> {
    const { count, error } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

    if (error) {
        console.error('Error getting comment count:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Fetch comments for a recording (lesson)
 * Reuses the same tree-building and reaction logic as getComments
 */
export async function getRecordingComments(
    recordingId: string,
    limit: number = COMMENTS_PER_PAGE,
    userId?: string
): Promise<{
    comments: CommentWithAuthor[];
    hasMore: boolean;
    userReactions: Map<string, string>;
    userVotes: Map<string, string>;
}> {
    const cacheKey = `comments:recording:${recordingId}:${limit}`;
    return cached(cacheKey, async () => {
    const fetchLimit = limit > 0 ? limit * 2 : 0;

    let query = supabase
        .from('comments')
        .select(`
      *,
      author:profiles!author_id(id, username, display_name, avatar_url, membership_type, role)
    `)
        .eq('recording_id', recordingId)
        .order('created_at', { ascending: true });

    if (fetchLimit > 0) {
        query = query.limit(fetchLimit);
    }

    const { data, error } = await query;
    const comments = data as RawCommentResult[] | null;

    if (error) {
        console.error('Error fetching recording comments:', error);
        throw error;
    }

    const commentIds = comments?.map((c) => c.id) || [];

    let reactionCountsMap: Record<string, ReactionCounts> = {};
    let voteCountsMap: Record<string, VoteCounts> = {};
    let userReactions = new Map<string, string>();
    let userVotes = new Map<string, string>();

    if (commentIds.length > 0) {
        const [reactionsResult, userReactionsResult, votesResult, userVotesResult] = await Promise.all([
            supabase
                .from('reactions')
                .select('reactable_id, reaction_type')
                .eq('reactable_type', 'comment')
                .in('reactable_id', commentIds),
            userId
                ? supabase
                    .from('reactions')
                    .select('reactable_id, reaction_type')
                    .eq('user_id', userId)
                    .eq('reactable_type', 'comment')
                    .in('reactable_id', commentIds)
                : Promise.resolve({ data: null }),
            (supabase.from as any)('comment_votes')
                .select('comment_id, vote_type')
                .in('comment_id', commentIds),
            userId
                ? (supabase.from as any)('comment_votes')
                    .select('comment_id, vote_type')
                    .eq('user_id', userId)
                    .in('comment_id', commentIds)
                : Promise.resolve({ data: null }),
        ]);

        const reactions = reactionsResult.data as { reactable_id: string; reaction_type: ReactionType }[] | null;
        reactions?.forEach((r) => {
            if (!reactionCountsMap[r.reactable_id]) {
                reactionCountsMap[r.reactable_id] = { ...DEFAULT_REACTION_COUNTS };
            }
            reactionCountsMap[r.reactable_id][r.reaction_type]++;
            reactionCountsMap[r.reactable_id].total++;
        });

        const userReactionsData = userReactionsResult.data as { reactable_id: string; reaction_type: string }[] | null;
        userReactionsData?.forEach((r) => {
            userReactions.set(r.reactable_id, r.reaction_type);
        });

        const votes = votesResult.data as { comment_id: string; vote_type: string }[] | null;
        votes?.forEach((v) => {
            if (!voteCountsMap[v.comment_id]) {
                voteCountsMap[v.comment_id] = { upvotes: 0, downvotes: 0, score: 0 };
            }
            if (v.vote_type === 'up') voteCountsMap[v.comment_id].upvotes++;
            else voteCountsMap[v.comment_id].downvotes++;
        });
        Object.values(voteCountsMap).forEach((c) => {
            c.score = c.upvotes - c.downvotes;
        });

        const userVotesData = userVotesResult.data as { comment_id: string; vote_type: string }[] | null;
        userVotesData?.forEach((v) => {
            userVotes.set(v.comment_id, v.vote_type);
        });
    }

    const commentMap = new Map<string, CommentWithAuthor>();
    const topLevelComments: CommentWithAuthor[] = [];

    comments?.forEach((comment) => {
        const commentWithAuthor: CommentWithAuthor = {
            ...comment,
            reaction_counts: reactionCountsMap[comment.id] || { ...DEFAULT_REACTION_COUNTS },
            vote_counts: voteCountsMap[comment.id] || { ...DEFAULT_VOTE_COUNTS },
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

    const hasMore = fetchLimit > 0 && (comments?.length || 0) >= fetchLimit;
    return { comments: topLevelComments, hasMore, userReactions, userVotes };
    }, 60_000);
}

/**
 * Create a comment on a recording (lesson)
 */
export async function createRecordingComment(
    recordingId: string,
    authorId: string,
    content: string,
    parentCommentId?: string
): Promise<Comment> {
    const { data, error } = await supabase
        .from('comments')
        .insert({
            recording_id: recordingId,
            author_id: authorId,
            content,
            parent_comment_id: parentCommentId || null,
        } as never)
        .select()
        .single();

    if (error) {
        console.error('Error creating recording comment:', error);
        throw error;
    }

    cacheInvalidate(`comments:recording:${recordingId}`);
    return data as Comment;
}

/**
 * Get comment count for a recording
 */
export async function getRecordingCommentCount(recordingId: string): Promise<number> {
    const { count, error } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('recording_id', recordingId);

    if (error) {
        console.error('Error getting recording comment count:', error);
        return 0;
    }

    return count || 0;
}
