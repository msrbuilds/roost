import { supabase } from './supabase';
import type { ReactionType, Profile } from '@/types';

export type ReactableType = 'post' | 'comment';

export interface ReactorInfo {
    user_id: string;
    reaction_type: ReactionType;
    user: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface ReactionCounts {
    like: number;
    love: number;
    fire: number;
    clap: number;
    think: number;
    haha: number;
    total: number;
}

/**
 * Toggle a reaction (add if not exists, remove if exists, or change type)
 * Uses a single database RPC call instead of 2 sequential queries.
 */
export async function toggleReaction(
    userId: string,
    reactableType: ReactableType,
    reactableId: string,
    reactionType: ReactionType
): Promise<{ added: boolean; reactionType: ReactionType | null }> {
    // Note: 'toggle_reaction' is a custom DB function (see migration 052).
    // Type assertion needed until generated types are regenerated.
    const { data, error } = await (supabase.rpc as any)('toggle_reaction', {
        p_user_id: userId,
        p_reactable_type: reactableType,
        p_reactable_id: reactableId,
        p_reaction_type: reactionType,
    });

    if (error) {
        console.error('Error toggling reaction:', error);
        throw error;
    }

    const result = data as { added: boolean; reactionType: string | null };
    return {
        added: result.added,
        reactionType: result.reactionType as ReactionType | null,
    };
}

/**
 * Get reaction counts for a reactable item
 */
export async function getReactionCounts(
    reactableType: ReactableType,
    reactableId: string
): Promise<ReactionCounts> {
    const { data, error } = await supabase
        .from('reactions')
        .select('reaction_type')
        .eq('reactable_type', reactableType)
        .eq('reactable_id', reactableId);

    const reactions = data as { reaction_type: ReactionType }[] | null;

    if (error) {
        console.error('Error fetching reactions:', error);
        return { like: 0, love: 0, fire: 0, clap: 0, think: 0, haha: 0, total: 0 };
    }

    const counts: ReactionCounts = {
        like: 0,
        love: 0,
        fire: 0,
        clap: 0,
        think: 0,
        haha: 0,
        total: 0,
    };

    reactions?.forEach((r) => {
        counts[r.reaction_type]++;
        counts.total++;
    });

    return counts;
}

/**
 * Get the current user's reaction for an item
 */
export async function getUserReaction(
    userId: string,
    reactableType: ReactableType,
    reactableId: string
): Promise<ReactionType | null> {
    const { data, error } = await supabase
        .from('reactions')
        .select('reaction_type')
        .eq('user_id', userId)
        .eq('reactable_type', reactableType)
        .eq('reactable_id', reactableId)
        .maybeSingle();

    const reaction = data as { reaction_type: ReactionType } | null;

    if (error || !reaction) {
        return null;
    }

    return reaction.reaction_type;
}

/**
 * Get all user reactions for multiple items (for batch loading)
 */
export async function getUserReactionsForItems(
    userId: string,
    reactableType: ReactableType,
    reactableIds: string[]
): Promise<Map<string, ReactionType>> {
    const reactionMap = new Map<string, ReactionType>();

    if (reactableIds.length === 0) {
        return reactionMap;
    }

    const { data, error } = await supabase
        .from('reactions')
        .select('reactable_id, reaction_type')
        .eq('user_id', userId)
        .eq('reactable_type', reactableType)
        .in('reactable_id', reactableIds);

    const reactions = data as { reactable_id: string; reaction_type: ReactionType }[] | null;

    if (error || !reactions) {
        return reactionMap;
    }

    reactions.forEach((r) => {
        reactionMap.set(r.reactable_id, r.reaction_type);
    });

    return reactionMap;
}

/**
 * Get list of users who reacted to an item (for reactor list modal)
 */
export async function getReactors(
    reactableType: ReactableType,
    reactableId: string
): Promise<ReactorInfo[]> {
    const { data, error } = await supabase
        .from('reactions')
        .select(`
            user_id,
            reaction_type,
            user:profiles!user_id(id, username, display_name, avatar_url)
        `)
        .eq('reactable_type', reactableType)
        .eq('reactable_id', reactableId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching reactors:', error);
        return [];
    }

    return (data as unknown as ReactorInfo[]) || [];
}
