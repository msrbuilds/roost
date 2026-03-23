import { supabase } from './supabase';

export type VoteType = 'up' | 'down';

export interface VoteCounts {
    upvotes: number;
    downvotes: number;
    score: number;
}

export const DEFAULT_VOTE_COUNTS: VoteCounts = { upvotes: 0, downvotes: 0, score: 0 };

/**
 * Toggle a comment vote (add, remove, or switch)
 * Uses a single database RPC call.
 */
export async function toggleCommentVote(
    userId: string,
    commentId: string,
    voteType: VoteType
): Promise<{ action: string; voteType: VoteType | null }> {
    const { data, error } = await (supabase.rpc as any)('toggle_comment_vote', {
        p_user_id: userId,
        p_comment_id: commentId,
        p_vote_type: voteType,
    });

    if (error) {
        console.error('Error toggling comment vote:', error);
        throw error;
    }

    return data as { action: string; voteType: VoteType | null };
}

/**
 * Get vote counts for multiple comments (batch)
 * Note: Type assertion needed until generated types include comment_votes table.
 */
export async function getCommentVoteCounts(
    commentIds: string[]
): Promise<Record<string, VoteCounts>> {
    if (commentIds.length === 0) return {};

    const { data, error } = await (supabase.from as any)('comment_votes')
        .select('comment_id, vote_type')
        .in('comment_id', commentIds);

    if (error) {
        console.error('Error fetching comment votes:', error);
        return {};
    }

    const counts: Record<string, VoteCounts> = {};
    (data as { comment_id: string; vote_type: VoteType }[] | null)?.forEach((v) => {
        if (!counts[v.comment_id]) {
            counts[v.comment_id] = { upvotes: 0, downvotes: 0, score: 0 };
        }
        if (v.vote_type === 'up') counts[v.comment_id].upvotes++;
        else counts[v.comment_id].downvotes++;
    });

    Object.values(counts).forEach((c) => {
        c.score = c.upvotes - c.downvotes;
    });

    return counts;
}

/**
 * Get current user's votes for multiple comments (batch)
 * Note: Type assertion needed until generated types include comment_votes table.
 */
export async function getUserVotesForComments(
    userId: string,
    commentIds: string[]
): Promise<Map<string, VoteType>> {
    const voteMap = new Map<string, VoteType>();
    if (commentIds.length === 0) return voteMap;

    const { data, error } = await (supabase.from as any)('comment_votes')
        .select('comment_id, vote_type')
        .eq('user_id', userId)
        .in('comment_id', commentIds);

    if (error) {
        console.error('Error fetching user votes:', error);
        return voteMap;
    }

    (data as { comment_id: string; vote_type: VoteType }[] | null)?.forEach((v) => {
        voteMap.set(v.comment_id, v.vote_type);
    });

    return voteMap;
}
