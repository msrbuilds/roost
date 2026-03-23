// ============================================================
// Roost - Supabase Database Adapter
// Works for both Supabase Cloud and Self-hosted (same API, different URL)
// ============================================================

import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type {
  DatabaseAdapter,
  RealtimeCallback,
  RealtimeEvent,
  RealtimeSubscription,
} from '../../interfaces/database';
import type {
  Profile,
  Group,
  GroupMember,
  Category,
  Post,
  Comment,
  Reaction,
  Message,
  Asset,
  Notification,
  LeaderboardEntry,
  PointActivity,
  Event,
  EventAttendee,
  Announcement,
  Showcase,
  ShowcaseImage,
  ShowcaseTag,
  ShowcaseReview,
  Follow,
  LiveSession,
  LiveSessionMessage,
  Module,
  Recording,
  LessonCompletion,
  FeatureRequest,
  NotificationPreferences,
  ActivationProduct,
  ActivationRequest,
  ReactionType,
  ReactableType,
  GroupRole,
  UserRole,
  RsvpStatus,
  ActivationRequestStatus,
  ShowcaseStatus,
  FeatureRequestStatus,
  DbResult,
  DbListResult,
  QueryOptions,
} from '../../interfaces/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).'
  );
}

/** Shared Supabase client singleton */
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

/** Wrap a Supabase single-row response into DbResult<T> */
function toResult<T>(data: T | null, error: unknown): DbResult<T> {
  if (error) {
    const e = error as { message?: string; code?: string; details?: string };
    return { data: null, error: { message: e.message ?? 'Unknown error', code: e.code, details: e.details } };
  }
  return { data: data as T, error: null };
}

/** Wrap a Supabase list response into DbListResult<T> */
function toListResult<T>(data: T[] | null, error: unknown, count?: number | null): DbListResult<T> {
  if (error) {
    const e = error as { message?: string; code?: string; details?: string };
    return { data: [], error: { message: e.message ?? 'Unknown error', code: e.code, details: e.details } };
  }
  return { data: (data ?? []) as T[], error: null, count: count ?? undefined };
}

/** Apply standard pagination/sort from QueryOptions to a Supabase query builder */
function applyQueryOptions<Q extends { range: (a: number, b: number) => Q; order: (col: string, opts: { ascending: boolean }) => Q }>(
  query: Q,
  options?: QueryOptions,
  defaultSort?: { field: string; direction: 'asc' | 'desc' },
): Q {
  if (options?.sort) {
    query = query.order(options.sort.field, { ascending: options.sort.direction === 'asc' });
  } else if (defaultSort) {
    query = query.order(defaultSort.field, { ascending: defaultSort.direction === 'asc' });
  }
  if (options?.pagination) {
    const { offset, limit } = options.pagination;
    query = query.range(offset, offset + limit - 1);
  }
  return query;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class SupabaseAdapter implements DatabaseAdapter {
  // -----------------------------------------------------------------------
  // Profiles
  // -----------------------------------------------------------------------

  async getProfile(userId: string): Promise<DbResult<Profile>> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return toResult<Profile>(data as Profile | null, error);
  }

  async getProfileByUsername(username: string): Promise<DbResult<Profile>> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();
    return toResult<Profile>(data as Profile | null, error);
  }

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<DbResult<Profile>> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', userId)
      .select()
      .single();
    return toResult<Profile>(data as Profile | null, error);
  }

  async searchProfiles(query: string, options?: QueryOptions): Promise<DbListResult<Profile>> {
    let q = supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`);
    q = applyQueryOptions(q, options, { field: 'display_name', direction: 'asc' });
    const { data, error } = await q;
    return toListResult<Profile>(data as Profile[] | null, error);
  }

  async getOnlineProfiles(options?: QueryOptions): Promise<DbListResult<Profile>> {
    let q = supabase
      .from('profiles')
      .select('*')
      .eq('is_online', true);
    q = applyQueryOptions(q, options, { field: 'last_seen_at', direction: 'desc' });
    const { data, error } = await q;
    return toListResult<Profile>(data as Profile[] | null, error);
  }

  // -----------------------------------------------------------------------
  // Groups
  // -----------------------------------------------------------------------

  async getGroup(groupId: string): Promise<DbResult<Group>> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();
    return toResult<Group>(data as Group | null, error);
  }

  async getGroupBySlug(slug: string): Promise<DbResult<Group>> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('slug', slug)
      .single();
    return toResult<Group>(data as Group | null, error);
  }

  async getGroups(options?: QueryOptions): Promise<DbListResult<Group>> {
    let q = supabase.from('groups').select('*');
    q = applyQueryOptions(q, options, { field: 'created_at', direction: 'desc' });
    const { data, error } = await q;
    return toListResult<Group>(data as Group[] | null, error);
  }

  async createGroup(groupData: Partial<Group>): Promise<DbResult<Group>> {
    const { data, error } = await supabase
      .from('groups')
      .insert(groupData as never)
      .select()
      .single();
    return toResult<Group>(data as Group | null, error);
  }

  async updateGroup(groupId: string, updates: Partial<Group>): Promise<DbResult<Group>> {
    const { data, error } = await supabase
      .from('groups')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', groupId)
      .select()
      .single();
    return toResult<Group>(data as Group | null, error);
  }

  async deleteGroup(groupId: string): Promise<DbResult<null>> {
    const { error } = await supabase.from('groups').delete().eq('id', groupId);
    return toResult<null>(null, error);
  }

  // -----------------------------------------------------------------------
  // Group Members
  // -----------------------------------------------------------------------

  async getGroupMembers(groupId: string, options?: QueryOptions): Promise<DbListResult<GroupMember>> {
    let q = supabase
      .from('group_members')
      .select('*, profile:profiles!user_id(id, username, display_name, avatar_url)')
      .eq('group_id', groupId);
    q = applyQueryOptions(q, options, { field: 'joined_at', direction: 'desc' });
    const { data, error } = await q;
    return toListResult<GroupMember>(data as GroupMember[] | null, error);
  }

  async getGroupMember(groupId: string, userId: string): Promise<DbResult<GroupMember>> {
    const { data, error } = await supabase
      .from('group_members')
      .select('*, profile:profiles!user_id(id, username, display_name, avatar_url)')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();
    return toResult<GroupMember>(data as GroupMember | null, error);
  }

  async joinGroup(groupId: string, userId: string): Promise<DbResult<GroupMember>> {
    const { data, error } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: userId, role: 'member' } as never)
      .select()
      .single();
    return toResult<GroupMember>(data as GroupMember | null, error);
  }

  async leaveGroup(groupId: string, userId: string): Promise<DbResult<null>> {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
    return toResult<null>(null, error);
  }

  async updateMemberRole(groupId: string, userId: string, role: GroupRole): Promise<DbResult<GroupMember>> {
    const { data, error } = await supabase
      .from('group_members')
      .update({ role } as never)
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .select()
      .single();
    return toResult<GroupMember>(data as GroupMember | null, error);
  }

  async getUserGroups(userId: string): Promise<DbListResult<Group>> {
    // Step 1: get membership rows
    const { data: memberships, error: memErr } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (memErr || !memberships || memberships.length === 0) {
      return toListResult<Group>([], memErr);
    }

    const groupIds = memberships.map((m: { group_id: string }) => m.group_id);

    // Step 2: fetch the groups
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds);
    return toListResult<Group>(data as Group[] | null, error);
  }

  async isGroupMember(groupId: string, userId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('user_id', userId);
    if (error) return false;
    return (count ?? 0) > 0;
  }

  async isGroupAdminOrMod(groupId: string, userId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .in('role', ['admin', 'moderator']);
    if (error) return false;
    return (count ?? 0) > 0;
  }

  // -----------------------------------------------------------------------
  // Categories
  // -----------------------------------------------------------------------

  async getCategories(groupId?: string | null): Promise<DbListResult<Category>> {
    let q = supabase.from('categories').select('*').order('display_order', { ascending: true });
    if (groupId) {
      q = q.or(`group_id.eq.${groupId},group_id.is.null`);
    }
    const { data, error } = await q;
    return toListResult<Category>(data as Category[] | null, error);
  }

  async createCategory(catData: Partial<Category>): Promise<DbResult<Category>> {
    const { data, error } = await supabase
      .from('categories')
      .insert(catData as never)
      .select()
      .single();
    return toResult<Category>(data as Category | null, error);
  }

  async updateCategory(categoryId: string, updates: Partial<Category>): Promise<DbResult<Category>> {
    const { data, error } = await supabase
      .from('categories')
      .update(updates as never)
      .eq('id', categoryId)
      .select()
      .single();
    return toResult<Category>(data as Category | null, error);
  }

  async deleteCategory(categoryId: string): Promise<DbResult<null>> {
    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    return toResult<null>(null, error);
  }

  // -----------------------------------------------------------------------
  // Posts
  // -----------------------------------------------------------------------

  async getPost(postId: string, _userId?: string): Promise<DbResult<Post>> {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, membership_type, role),
        category:categories!category_id(id, name, slug, color),
        assets(*)
      `)
      .eq('id', postId)
      .single();

    if (error) return toResult<Post>(null, error);

    const post = data as Post;

    // Fetch reaction counts and comment count in parallel
    const [commentsRes, reactionsRes] = await Promise.all([
      supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      supabase.from('reactions').select('reaction_type').eq('reactable_type', 'post').eq('reactable_id', postId),
    ]);

    const reactionCounts: Record<ReactionType, number> = { like: 0, love: 0, fire: 0, clap: 0, think: 0, haha: 0 };
    if (reactionsRes.data) {
      for (const r of reactionsRes.data as { reaction_type: ReactionType }[]) {
        reactionCounts[r.reaction_type]++;
      }
    }

    // If userId provided, get user's reaction
    let userReaction: ReactionType | null = null;
    if (_userId) {
      const { data: ur } = await supabase
        .from('reactions')
        .select('reaction_type')
        .eq('reactable_type', 'post')
        .eq('reactable_id', postId)
        .eq('user_id', _userId)
        .maybeSingle();
      if (ur) userReaction = (ur as { reaction_type: ReactionType }).reaction_type;
    }

    return toResult<Post>({
      ...post,
      comment_count: commentsRes.count ?? 0,
      reaction_counts: reactionCounts,
      user_reaction: userReaction,
    } as Post, null);
  }

  async getPosts(
    groupId: string | null,
    options?: QueryOptions & { categoryId?: string; userId?: string },
  ): Promise<DbListResult<Post>> {
    let q = supabase
      .from('posts')
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, membership_type, role),
        category:categories!category_id(id, name, slug, color)
      `);

    // Group filter: null = general only, string = specific group, undefined = all
    if (groupId === null) {
      q = q.is('group_id', null);
    } else if (groupId) {
      q = q.eq('group_id', groupId);
    }

    if (options?.categoryId) {
      q = q.eq('category_id', options.categoryId);
    }
    if (options?.userId) {
      q = q.eq('author_id', options.userId);
    }

    q = q.order('is_pinned', { ascending: false });
    q = applyQueryOptions(q, options, { field: 'created_at', direction: 'desc' });

    const { data, error } = await q;
    return toListResult<Post>(data as Post[] | null, error);
  }

  async createPost(postData: Partial<Post>): Promise<DbResult<Post>> {
    const { data, error } = await supabase
      .from('posts')
      .insert(postData as never)
      .select()
      .single();
    return toResult<Post>(data as Post | null, error);
  }

  async updatePost(postId: string, updates: Partial<Post>): Promise<DbResult<Post>> {
    const { data, error } = await supabase
      .from('posts')
      .update({ ...updates, is_edited: true, updated_at: new Date().toISOString() } as never)
      .eq('id', postId)
      .select()
      .single();
    return toResult<Post>(data as Post | null, error);
  }

  async deletePost(postId: string): Promise<DbResult<null>> {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    return toResult<null>(null, error);
  }

  async pinPost(postId: string, pinned: boolean): Promise<DbResult<Post>> {
    const { data, error } = await supabase
      .from('posts')
      .update({ is_pinned: pinned } as never)
      .eq('id', postId)
      .select()
      .single();
    return toResult<Post>(data as Post | null, error);
  }

  async searchPosts(query: string, groupId?: string | null): Promise<DbListResult<Post>> {
    let q = supabase
      .from('posts')
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, membership_type, role),
        category:categories!category_id(id, name, slug, color)
      `)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`);

    if (groupId === null) {
      q = q.is('group_id', null);
    } else if (groupId) {
      q = q.eq('group_id', groupId);
    }

    q = q.order('created_at', { ascending: false }).limit(50);
    const { data, error } = await q;
    return toListResult<Post>(data as Post[] | null, error);
  }

  // -----------------------------------------------------------------------
  // Comments
  // -----------------------------------------------------------------------

  async getComments(postId: string, userId?: string): Promise<DbListResult<Comment>> {
    const { data, error } = await supabase
      .from('comments')
      .select('*, author:profiles!author_id(id, username, display_name, avatar_url, membership_type, role)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) return toListResult<Comment>(null, error);

    const comments = (data ?? []) as Comment[];

    // If userId provided, fetch user votes for these comments
    if (userId && comments.length > 0) {
      const commentIds = comments.map(c => c.id);
      const { data: votes } = await supabase
        .from('comment_votes')
        .select('comment_id, vote_type')
        .eq('user_id', userId)
        .in('comment_id', commentIds);

      const voteMap: Record<string, 'up' | 'down'> = {};
      if (votes) {
        for (const v of votes as { comment_id: string; vote_type: 'up' | 'down' }[]) {
          voteMap[v.comment_id] = v.vote_type;
        }
      }
      for (const c of comments) {
        c.user_vote = voteMap[c.id] ?? null;
      }
    }

    return toListResult<Comment>(comments, null);
  }

  async getRecordingComments(recordingId: string, userId?: string): Promise<DbListResult<Comment>> {
    const { data, error } = await supabase
      .from('comments')
      .select('*, author:profiles!author_id(id, username, display_name, avatar_url, membership_type, role)')
      .eq('recording_id', recordingId)
      .order('created_at', { ascending: true });

    if (error) return toListResult<Comment>(null, error);

    const comments = (data ?? []) as Comment[];

    if (userId && comments.length > 0) {
      const commentIds = comments.map(c => c.id);
      const { data: votes } = await supabase
        .from('comment_votes')
        .select('comment_id, vote_type')
        .eq('user_id', userId)
        .in('comment_id', commentIds);

      const voteMap: Record<string, 'up' | 'down'> = {};
      if (votes) {
        for (const v of votes as { comment_id: string; vote_type: 'up' | 'down' }[]) {
          voteMap[v.comment_id] = v.vote_type;
        }
      }
      for (const c of comments) {
        c.user_vote = voteMap[c.id] ?? null;
      }
    }

    return toListResult<Comment>(comments, null);
  }

  async createComment(commentData: Partial<Comment>): Promise<DbResult<Comment>> {
    const { data, error } = await supabase
      .from('comments')
      .insert(commentData as never)
      .select('*, author:profiles!author_id(id, username, display_name, avatar_url, membership_type, role)')
      .single();
    return toResult<Comment>(data as Comment | null, error);
  }

  async updateComment(commentId: string, content: string): Promise<DbResult<Comment>> {
    const { data, error } = await supabase
      .from('comments')
      .update({ content, is_edited: true, updated_at: new Date().toISOString() } as never)
      .eq('id', commentId)
      .select('*, author:profiles!author_id(id, username, display_name, avatar_url, membership_type, role)')
      .single();
    return toResult<Comment>(data as Comment | null, error);
  }

  async deleteComment(commentId: string): Promise<DbResult<null>> {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    return toResult<null>(null, error);
  }

  async toggleCommentVote(
    userId: string,
    commentId: string,
    voteType: 'up' | 'down',
  ): Promise<DbResult<{ vote_count: number }>> {
    // Check if user already voted on this comment
    const { data: existing } = await supabase
      .from('comment_votes')
      .select('id, vote_type')
      .eq('user_id', userId)
      .eq('comment_id', commentId)
      .maybeSingle();

    const existingVote = existing as { id: string; vote_type: string } | null;

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Remove vote (toggle off)
        await supabase.from('comment_votes').delete().eq('id', existingVote.id);
      } else {
        // Change vote direction
        await supabase
          .from('comment_votes')
          .update({ vote_type: voteType } as never)
          .eq('id', existingVote.id);
      }
    } else {
      // Insert new vote
      await supabase
        .from('comment_votes')
        .insert({ user_id: userId, comment_id: commentId, vote_type: voteType } as never);
    }

    // Return updated vote count
    const { data: upVotes } = await supabase
      .from('comment_votes')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId)
      .eq('vote_type', 'up');

    const { data: downVotes } = await supabase
      .from('comment_votes')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId)
      .eq('vote_type', 'down');

    const voteCount = ((upVotes as unknown as { count: number })?.count ?? 0) -
      ((downVotes as unknown as { count: number })?.count ?? 0);

    return toResult({ vote_count: voteCount }, null);
  }

  // -----------------------------------------------------------------------
  // Reactions
  // -----------------------------------------------------------------------

  async getReactions(reactableType: ReactableType, reactableId: string): Promise<DbListResult<Reaction>> {
    const { data, error } = await supabase
      .from('reactions')
      .select('*')
      .eq('reactable_type', reactableType)
      .eq('reactable_id', reactableId);
    return toListResult<Reaction>(data as Reaction[] | null, error);
  }

  async toggleReaction(
    userId: string,
    reactableType: ReactableType,
    reactableId: string,
    reactionType: ReactionType,
  ): Promise<DbResult<{ added: boolean }>> {
    // Check if reaction exists
    const { data: existing } = await supabase
      .from('reactions')
      .select('id, reaction_type')
      .eq('user_id', userId)
      .eq('reactable_type', reactableType)
      .eq('reactable_id', reactableId)
      .maybeSingle();

    const existingReaction = existing as { id: string; reaction_type: string } | null;

    if (existingReaction) {
      if (existingReaction.reaction_type === reactionType) {
        // Same reaction type: remove it (toggle off)
        const { error } = await supabase.from('reactions').delete().eq('id', existingReaction.id);
        if (error) return toResult(null, error);
        return toResult({ added: false }, null);
      } else {
        // Different reaction type: update to new type
        const { error } = await supabase
          .from('reactions')
          .update({ reaction_type: reactionType } as never)
          .eq('id', existingReaction.id);
        if (error) return toResult(null, error);
        return toResult({ added: true }, null);
      }
    } else {
      // No existing reaction: insert new one
      const { error } = await supabase
        .from('reactions')
        .insert({
          user_id: userId,
          reactable_type: reactableType,
          reactable_id: reactableId,
          reaction_type: reactionType,
        } as never);
      if (error) return toResult(null, error);
      return toResult({ added: true }, null);
    }
  }

  async getReactionCounts(
    reactableType: ReactableType,
    reactableId: string,
  ): Promise<DbResult<Record<ReactionType, number>>> {
    const { data, error } = await supabase
      .from('reactions')
      .select('reaction_type')
      .eq('reactable_type', reactableType)
      .eq('reactable_id', reactableId);

    if (error) return toResult(null, error);

    const counts: Record<ReactionType, number> = { like: 0, love: 0, fire: 0, clap: 0, think: 0, haha: 0 };
    for (const r of (data ?? []) as { reaction_type: ReactionType }[]) {
      counts[r.reaction_type]++;
    }
    return toResult(counts, null);
  }

  async getUserReaction(
    userId: string,
    reactableType: ReactableType,
    reactableId: string,
  ): Promise<DbResult<ReactionType | null>> {
    const { data, error } = await supabase
      .from('reactions')
      .select('reaction_type')
      .eq('user_id', userId)
      .eq('reactable_type', reactableType)
      .eq('reactable_id', reactableId)
      .maybeSingle();

    if (error) return toResult<ReactionType | null>(null, error);
    return toResult<ReactionType | null>(
      data ? (data as { reaction_type: ReactionType }).reaction_type : null,
      null,
    );
  }

  // -----------------------------------------------------------------------
  // Messages
  // -----------------------------------------------------------------------

  async getConversations(
    userId: string,
  ): Promise<DbListResult<Message & { other_user: Profile; unread_count: number }>> {
    // Fetch all messages where user is sender or recipient, ordered by latest first
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(id, username, display_name, avatar_url, is_online),
        recipient:profiles!recipient_id(id, username, display_name, avatar_url, is_online)
      `)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) return toListResult([], error);

    const messages = (data ?? []) as (Message & { sender: Profile; recipient: Profile })[];

    // Group by conversation partner and take latest message
    const conversationMap = new Map<string, Message & { other_user: Profile; unread_count: number }>();
    const unreadCounts = new Map<string, number>();

    for (const msg of messages) {
      const otherId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
      const otherUser = msg.sender_id === userId ? msg.recipient : msg.sender;

      // Track unread count
      if (msg.recipient_id === userId && !msg.is_read) {
        unreadCounts.set(otherId, (unreadCounts.get(otherId) ?? 0) + 1);
      }

      if (!conversationMap.has(otherId)) {
        conversationMap.set(otherId, {
          ...msg,
          other_user: otherUser,
          unread_count: 0, // Will be set after
        });
      }
    }

    // Assign unread counts
    const conversations = Array.from(conversationMap.values()).map(conv => {
      const otherId = conv.sender_id === userId ? conv.recipient_id : conv.sender_id;
      return { ...conv, unread_count: unreadCounts.get(otherId) ?? 0 };
    });

    return toListResult(conversations, null);
  }

  async getMessages(userId: string, otherUserId: string, options?: QueryOptions): Promise<DbListResult<Message>> {
    let q = supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(id, username, display_name, avatar_url),
        recipient:profiles!recipient_id(id, username, display_name, avatar_url),
        assets(*)
      `)
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`,
      );

    q = applyQueryOptions(q, options, { field: 'created_at', direction: 'asc' });
    const { data, error } = await q;
    return toListResult<Message>(data as Message[] | null, error);
  }

  async sendMessage(senderId: string, recipientId: string, content: string): Promise<DbResult<Message>> {
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: senderId, recipient_id: recipientId, content } as never)
      .select()
      .single();
    return toResult<Message>(data as Message | null, error);
  }

  async markMessageRead(messageId: string): Promise<DbResult<null>> {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() } as never)
      .eq('id', messageId);
    return toResult<null>(null, error);
  }

  async markAllMessagesRead(userId: string, otherUserId: string): Promise<DbResult<null>> {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() } as never)
      .eq('recipient_id', userId)
      .eq('sender_id', otherUserId)
      .eq('is_read', false);
    return toResult<null>(null, error);
  }

  async getUnreadMessageCount(userId: string): Promise<DbResult<number>> {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);
    if (error) return toResult<number>(null, error);
    return toResult<number>(count ?? 0, null);
  }

  // -----------------------------------------------------------------------
  // Assets
  // -----------------------------------------------------------------------

  async createAsset(assetData: Partial<Asset>): Promise<DbResult<Asset>> {
    const { data, error } = await supabase
      .from('assets')
      .insert(assetData as never)
      .select()
      .single();
    return toResult<Asset>(data as Asset | null, error);
  }

  async getPostAssets(postId: string): Promise<DbListResult<Asset>> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    return toListResult<Asset>(data as Asset[] | null, error);
  }

  async getMessageAssets(messageId: string): Promise<DbListResult<Asset>> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });
    return toListResult<Asset>(data as Asset[] | null, error);
  }

  async deleteAsset(assetId: string): Promise<DbResult<null>> {
    const { error } = await supabase.from('assets').delete().eq('id', assetId);
    return toResult<null>(null, error);
  }

  // -----------------------------------------------------------------------
  // Notifications
  // -----------------------------------------------------------------------

  async getNotifications(userId: string, options?: QueryOptions): Promise<DbListResult<Notification>> {
    let q = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);
    q = applyQueryOptions(q, options, { field: 'created_at', direction: 'desc' });
    const { data, error } = await q;
    return toListResult<Notification>(data as Notification[] | null, error);
  }

  async getUnreadNotificationCount(userId: string): Promise<DbResult<number>> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) return toResult<number>(null, error);
    return toResult<number>(count ?? 0, null);
  }

  async markNotificationRead(notificationId: string): Promise<DbResult<null>> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true } as never)
      .eq('id', notificationId);
    return toResult<null>(null, error);
  }

  async markAllNotificationsRead(userId: string): Promise<DbResult<null>> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true } as never)
      .eq('user_id', userId)
      .eq('is_read', false);
    return toResult<null>(null, error);
  }

  async createNotification(notifData: Partial<Notification>): Promise<DbResult<Notification>> {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notifData as never)
      .select()
      .single();
    return toResult<Notification>(data as Notification | null, error);
  }

  async getNotificationPreferences(userId: string): Promise<DbResult<NotificationPreferences>> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    return toResult<NotificationPreferences>(data as NotificationPreferences | null, error);
  }

  async updateNotificationPreferences(
    userId: string,
    updates: Partial<NotificationPreferences>,
  ): Promise<DbResult<NotificationPreferences>> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({ ...updates, user_id: userId, updated_at: new Date().toISOString() } as never)
      .select()
      .single();
    return toResult<NotificationPreferences>(data as NotificationPreferences | null, error);
  }

  // -----------------------------------------------------------------------
  // Leaderboard
  // -----------------------------------------------------------------------

  async getLeaderboard(
    period: string,
    groupId?: string | null,
    options?: QueryOptions,
  ): Promise<DbListResult<LeaderboardEntry>> {
    let q = supabase
      .from('leaderboard_entries')
      .select('*, profile:profiles!user_id(id, username, display_name, avatar_url)')
      .eq('period_start', period);

    if (groupId === null || groupId === undefined) {
      q = q.is('group_id', null);
    } else {
      q = q.eq('group_id', groupId);
    }

    q = applyQueryOptions(q, options, { field: 'points', direction: 'desc' });
    const { data, error } = await q;
    return toListResult<LeaderboardEntry>(data as LeaderboardEntry[] | null, error);
  }

  async getUserRank(
    userId: string,
    period: string,
    groupId?: string | null,
  ): Promise<DbResult<{ rank: number; points: number }>> {
    const { data, error } = await supabase.rpc('get_user_rank', {
      p_user_id: userId,
      p_period: period,
      p_group_id: groupId ?? null,
    });

    if (error) return toResult(null, error);

    const result = data as { rank: number; points: number } | null;
    return toResult(result ?? { rank: 0, points: 0 }, null);
  }

  async getPointActivities(userId: string, options?: QueryOptions): Promise<DbListResult<PointActivity>> {
    let q = supabase
      .from('point_activities')
      .select('*')
      .eq('user_id', userId);
    q = applyQueryOptions(q, options, { field: 'created_at', direction: 'desc' });
    const { data, error } = await q;
    return toListResult<PointActivity>(data as PointActivity[] | null, error);
  }

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  async getEvents(groupId?: string, options?: QueryOptions): Promise<DbListResult<Event>> {
    let q = supabase
      .from('events')
      .select('*, creator:profiles!created_by(id, username, display_name, avatar_url), group:groups!group_id(id, name, slug)');

    if (groupId) {
      q = q.eq('group_id', groupId);
    }

    q = applyQueryOptions(q, options, { field: 'start_time', direction: 'asc' });
    const { data, error } = await q;
    return toListResult<Event>(data as Event[] | null, error);
  }

  async getEvent(eventId: string, userId?: string): Promise<DbResult<Event>> {
    const { data, error } = await supabase
      .from('events')
      .select('*, creator:profiles!created_by(id, username, display_name, avatar_url), group:groups!group_id(id, name, slug)')
      .eq('id', eventId)
      .single();

    if (error) return toResult<Event>(null, error);

    const event = data as Event;

    // Get attendee count
    const { count } = await supabase
      .from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'going');

    // Get user RSVP if userId provided
    let userRsvp: RsvpStatus | null = null;
    if (userId) {
      const { data: rsvp } = await supabase
        .from('event_attendees')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      if (rsvp) userRsvp = (rsvp as { status: RsvpStatus }).status;
    }

    return toResult<Event>({
      ...event,
      attendee_count: count ?? 0,
      user_rsvp: userRsvp,
    } as Event, null);
  }

  async createEvent(eventData: Partial<Event>): Promise<DbResult<Event>> {
    const { data, error } = await supabase
      .from('events')
      .insert(eventData as never)
      .select()
      .single();
    return toResult<Event>(data as Event | null, error);
  }

  async updateEvent(eventId: string, updates: Partial<Event>): Promise<DbResult<Event>> {
    const { data, error } = await supabase
      .from('events')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', eventId)
      .select()
      .single();
    return toResult<Event>(data as Event | null, error);
  }

  async deleteEvent(eventId: string): Promise<DbResult<null>> {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    return toResult<null>(null, error);
  }

  async rsvpEvent(eventId: string, userId: string, status: RsvpStatus): Promise<DbResult<EventAttendee>> {
    const { data, error } = await supabase
      .from('event_attendees')
      .upsert(
        { event_id: eventId, user_id: userId, status, updated_at: new Date().toISOString() } as never,
        { onConflict: 'event_id,user_id' },
      )
      .select()
      .single();
    return toResult<EventAttendee>(data as EventAttendee | null, error);
  }

  async getEventAttendees(eventId: string): Promise<DbListResult<EventAttendee>> {
    const { data, error } = await supabase
      .from('event_attendees')
      .select('*, profile:profiles!user_id(id, username, display_name, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    return toListResult<EventAttendee>(data as EventAttendee[] | null, error);
  }

  // -----------------------------------------------------------------------
  // Announcements
  // -----------------------------------------------------------------------

  async getActiveAnnouncements(userId: string, groupId?: string | null): Promise<DbListResult<Announcement>> {
    const now = new Date().toISOString();

    let q = supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', now)
      .or(`expires_at.is.null,expires_at.gte.${now}`);

    if (groupId) {
      // Show global + group-specific
      q = q.or(`group_id.is.null,group_id.eq.${groupId}`);
    } else {
      // Show global only
      q = q.is('group_id', null);
    }

    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;

    if (error) return toListResult<Announcement>(null, error);

    // Filter out dismissed announcements
    const announcements = (data ?? []) as Announcement[];
    if (announcements.length === 0) return toListResult<Announcement>([], null);

    const announcementIds = announcements.map(a => a.id);
    const { data: dismissals } = await supabase
      .from('announcement_dismissals')
      .select('announcement_id')
      .eq('user_id', userId)
      .in('announcement_id', announcementIds);

    const dismissedSet = new Set(
      (dismissals ?? []).map((d: { announcement_id: string }) => d.announcement_id),
    );

    const filtered = announcements.filter(a => !a.is_dismissible || !dismissedSet.has(a.id));
    return toListResult<Announcement>(filtered, null);
  }

  async createAnnouncement(announcementData: Partial<Announcement>): Promise<DbResult<Announcement>> {
    const { data, error } = await supabase
      .from('announcements')
      .insert(announcementData as never)
      .select()
      .single();
    return toResult<Announcement>(data as Announcement | null, error);
  }

  async updateAnnouncement(announcementId: string, updates: Partial<Announcement>): Promise<DbResult<Announcement>> {
    const { data, error } = await supabase
      .from('announcements')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', announcementId)
      .select()
      .single();
    return toResult<Announcement>(data as Announcement | null, error);
  }

  async deleteAnnouncement(announcementId: string): Promise<DbResult<null>> {
    const { error } = await supabase.from('announcements').delete().eq('id', announcementId);
    return toResult<null>(null, error);
  }

  async dismissAnnouncement(announcementId: string, userId: string): Promise<DbResult<null>> {
    const { error } = await supabase
      .from('announcement_dismissals')
      .insert({ announcement_id: announcementId, user_id: userId } as never);
    return toResult<null>(null, error);
  }

  // -----------------------------------------------------------------------
  // Showcases
  // -----------------------------------------------------------------------

  async getShowcases(
    options?: QueryOptions & { status?: ShowcaseStatus; category?: string },
  ): Promise<DbListResult<Showcase>> {
    let q = supabase
      .from('showcases')
      .select('*, author:profiles!author_id(id, username, display_name, avatar_url), images:showcase_images(*), tags:showcase_tags(*)');

    if (options?.status) {
      q = q.eq('status', options.status);
    }
    if (options?.category) {
      q = q.eq('category', options.category);
    }

    q = applyQueryOptions(q, options, { field: 'created_at', direction: 'desc' });
    const { data, error } = await q;
    return toListResult<Showcase>(data as Showcase[] | null, error);
  }

  async getShowcase(showcaseId: string): Promise<DbResult<Showcase>> {
    const { data, error } = await supabase
      .from('showcases')
      .select('*, author:profiles!author_id(id, username, display_name, avatar_url), images:showcase_images(*), tags:showcase_tags(*)')
      .eq('id', showcaseId)
      .single();
    return toResult<Showcase>(data as Showcase | null, error);
  }

  async createShowcase(
    showcaseData: Partial<Showcase>,
    images?: Partial<ShowcaseImage>[],
  ): Promise<DbResult<Showcase>> {
    const { data, error } = await supabase
      .from('showcases')
      .insert(showcaseData as never)
      .select()
      .single();

    if (error || !data) return toResult<Showcase>(null, error);

    const showcase = data as Showcase;

    // Insert images if provided
    if (images && images.length > 0) {
      const imageRows = images.map((img, idx) => ({
        ...img,
        showcase_id: showcase.id,
        display_order: img.display_order ?? idx,
      }));
      await supabase.from('showcase_images').insert(imageRows as never);
    }

    // Re-fetch with relations
    return this.getShowcase(showcase.id);
  }

  async updateShowcase(showcaseId: string, updates: Partial<Showcase>): Promise<DbResult<Showcase>> {
    const { data, error } = await supabase
      .from('showcases')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', showcaseId)
      .select()
      .single();
    return toResult<Showcase>(data as Showcase | null, error);
  }

  async deleteShowcase(showcaseId: string): Promise<DbResult<null>> {
    const { error } = await supabase.from('showcases').delete().eq('id', showcaseId);
    return toResult<null>(null, error);
  }

  async getShowcaseReviews(showcaseId: string, options?: QueryOptions): Promise<DbListResult<ShowcaseReview>> {
    let q = supabase
      .from('showcase_reviews')
      .select('*, author:profiles!author_id(id, username, display_name, avatar_url)')
      .eq('showcase_id', showcaseId);
    q = applyQueryOptions(q, options, { field: 'created_at', direction: 'desc' });
    const { data, error } = await q;
    return toListResult<ShowcaseReview>(data as ShowcaseReview[] | null, error);
  }

  async createShowcaseReview(reviewData: Partial<ShowcaseReview>): Promise<DbResult<ShowcaseReview>> {
    const { data, error } = await supabase
      .from('showcase_reviews')
      .insert(reviewData as never)
      .select('*, author:profiles!author_id(id, username, display_name, avatar_url)')
      .single();
    return toResult<ShowcaseReview>(data as ShowcaseReview | null, error);
  }

  async getShowcaseTags(): Promise<DbListResult<ShowcaseTag>> {
    const { data, error } = await supabase
      .from('showcase_tags')
      .select('*')
      .order('name', { ascending: true });
    return toListResult<ShowcaseTag>(data as ShowcaseTag[] | null, error);
  }

  // -----------------------------------------------------------------------
  // Follows
  // -----------------------------------------------------------------------

  async followUser(followerId: string, followingId: string): Promise<DbResult<Follow>> {
    const { data, error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId } as never)
      .select()
      .single();
    return toResult<Follow>(data as Follow | null, error);
  }

  async unfollowUser(followerId: string, followingId: string): Promise<DbResult<null>> {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    return toResult<null>(null, error);
  }

  async getFollowers(userId: string, options?: QueryOptions): Promise<DbListResult<Profile>> {
    let q = supabase
      .from('follows')
      .select('follower:profiles!follower_id(*)')
      .eq('following_id', userId);
    q = applyQueryOptions(q, options, { field: 'created_at', direction: 'desc' });
    const { data, error } = await q;

    if (error) return toListResult<Profile>(null, error);

    // Extract the nested profile from each follow row
    const profiles = (data ?? []).map((row: { follower: Profile }) => row.follower);
    return toListResult<Profile>(profiles, null);
  }

  async getFollowing(userId: string, options?: QueryOptions): Promise<DbListResult<Profile>> {
    let q = supabase
      .from('follows')
      .select('following:profiles!following_id(*)')
      .eq('follower_id', userId);
    q = applyQueryOptions(q, options, { field: 'created_at', direction: 'desc' });
    const { data, error } = await q;

    if (error) return toListResult<Profile>(null, error);

    const profiles = (data ?? []).map((row: { following: Profile }) => row.following);
    return toListResult<Profile>(profiles, null);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    if (error) return false;
    return (count ?? 0) > 0;
  }

  // -----------------------------------------------------------------------
  // Live Sessions
  // -----------------------------------------------------------------------

  async getLiveSession(): Promise<DbResult<LiveSession>> {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .in('status', ['live', 'idle'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return toResult<LiveSession>(data as LiveSession | null, error);
  }

  async createLiveSession(sessionData: Partial<LiveSession>): Promise<DbResult<LiveSession>> {
    const { data, error } = await supabase
      .from('live_sessions')
      .insert(sessionData as never)
      .select()
      .single();
    return toResult<LiveSession>(data as LiveSession | null, error);
  }

  async updateLiveSession(sessionId: string, updates: Partial<LiveSession>): Promise<DbResult<LiveSession>> {
    const { data, error } = await supabase
      .from('live_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', sessionId)
      .select()
      .single();
    return toResult<LiveSession>(data as LiveSession | null, error);
  }

  async getLiveSessionMessages(
    sessionId: string,
    options?: QueryOptions,
  ): Promise<DbListResult<LiveSessionMessage>> {
    let q = supabase
      .from('live_session_messages')
      .select('*, user:profiles!user_id(id, username, display_name, avatar_url)')
      .eq('session_id', sessionId);
    q = applyQueryOptions(q, options, { field: 'created_at', direction: 'asc' });
    const { data, error } = await q;
    return toListResult<LiveSessionMessage>(data as LiveSessionMessage[] | null, error);
  }

  async sendLiveMessage(
    sessionId: string,
    userId: string,
    content: string,
  ): Promise<DbResult<LiveSessionMessage>> {
    const { data, error } = await supabase
      .from('live_session_messages')
      .insert({ session_id: sessionId, user_id: userId, content } as never)
      .select('*, user:profiles!user_id(id, username, display_name, avatar_url)')
      .single();
    return toResult<LiveSessionMessage>(data as LiveSessionMessage | null, error);
  }

  // -----------------------------------------------------------------------
  // Modules (Learn Mode)
  // -----------------------------------------------------------------------

  async getModules(groupId: string): Promise<DbListResult<Module>> {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('group_id', groupId)
      .order('display_order', { ascending: true });
    return toListResult<Module>(data as Module[] | null, error);
  }

  async createModule(moduleData: Partial<Module>): Promise<DbResult<Module>> {
    const { data, error } = await supabase
      .from('modules')
      .insert(moduleData as never)
      .select()
      .single();
    return toResult<Module>(data as Module | null, error);
  }

  async updateModule(moduleId: string, updates: Partial<Module>): Promise<DbResult<Module>> {
    const { data, error } = await supabase
      .from('modules')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', moduleId)
      .select()
      .single();
    return toResult<Module>(data as Module | null, error);
  }

  async deleteModule(moduleId: string): Promise<DbResult<null>> {
    const { error } = await supabase.from('modules').delete().eq('id', moduleId);
    return toResult<null>(null, error);
  }

  async getRecordings(groupId: string, moduleId?: string): Promise<DbListResult<Recording>> {
    let q = supabase
      .from('recordings')
      .select('*, publisher:profiles!published_by(id, username, display_name, avatar_url)')
      .eq('group_id', groupId);

    if (moduleId) {
      q = q.eq('module_id', moduleId);
    }

    q = q.order('display_order', { ascending: true });
    const { data, error } = await q;
    return toListResult<Recording>(data as Recording[] | null, error);
  }

  async createRecording(recordingData: Partial<Recording>): Promise<DbResult<Recording>> {
    const { data, error } = await supabase
      .from('recordings')
      .insert(recordingData as never)
      .select()
      .single();
    return toResult<Recording>(data as Recording | null, error);
  }

  async updateRecording(recordingId: string, updates: Partial<Recording>): Promise<DbResult<Recording>> {
    const { data, error } = await supabase
      .from('recordings')
      .update(updates as never)
      .eq('id', recordingId)
      .select()
      .single();
    return toResult<Recording>(data as Recording | null, error);
  }

  async deleteRecording(recordingId: string): Promise<DbResult<null>> {
    const { error } = await supabase.from('recordings').delete().eq('id', recordingId);
    return toResult<null>(null, error);
  }

  async getLessonCompletions(userId: string, moduleId: string): Promise<DbListResult<LessonCompletion>> {
    const { data, error } = await supabase
      .from('lesson_completions')
      .select('*')
      .eq('user_id', userId)
      .eq('module_id', moduleId);
    return toListResult<LessonCompletion>(data as LessonCompletion[] | null, error);
  }

  async completelesson(
    userId: string,
    recordingId: string,
    moduleId: string,
  ): Promise<DbResult<LessonCompletion>> {
    const { data, error } = await supabase
      .from('lesson_completions')
      .upsert(
        {
          user_id: userId,
          recording_id: recordingId,
          module_id: moduleId,
          completed_at: new Date().toISOString(),
        } as never,
        { onConflict: 'user_id,recording_id' },
      )
      .select()
      .single();
    return toResult<LessonCompletion>(data as LessonCompletion | null, error);
  }

  // -----------------------------------------------------------------------
  // Feature Requests
  // -----------------------------------------------------------------------

  async getFeatureRequests(
    options?: QueryOptions & { status?: FeatureRequestStatus },
  ): Promise<DbListResult<FeatureRequest>> {
    let q = supabase
      .from('feature_requests')
      .select('*, author:profiles!author_id(id, username, display_name, avatar_url)');

    if (options?.status) {
      q = q.eq('status', options.status);
    }

    q = applyQueryOptions(q, options, { field: 'vote_count', direction: 'desc' });
    const { data, error } = await q;
    return toListResult<FeatureRequest>(data as FeatureRequest[] | null, error);
  }

  async createFeatureRequest(requestData: Partial<FeatureRequest>): Promise<DbResult<FeatureRequest>> {
    const { data, error } = await supabase
      .from('feature_requests')
      .insert(requestData as never)
      .select()
      .single();
    return toResult<FeatureRequest>(data as FeatureRequest | null, error);
  }

  async updateFeatureRequest(
    requestId: string,
    updates: Partial<FeatureRequest>,
  ): Promise<DbResult<FeatureRequest>> {
    const { data, error } = await supabase
      .from('feature_requests')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id', requestId)
      .select()
      .single();
    return toResult<FeatureRequest>(data as FeatureRequest | null, error);
  }

  async voteFeatureRequest(
    requestId: string,
    userId: string,
  ): Promise<DbResult<{ voted: boolean }>> {
    // Check if already voted
    const { data: existing } = await supabase
      .from('feature_request_votes')
      .select('id')
      .eq('feature_request_id', requestId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Remove vote
      await supabase.from('feature_request_votes').delete().eq('id', (existing as { id: string }).id);
      // Decrement count
      await supabase.rpc('decrement_feature_vote', { p_request_id: requestId });
      return toResult({ voted: false }, null);
    } else {
      // Add vote
      const { error } = await supabase
        .from('feature_request_votes')
        .insert({ feature_request_id: requestId, user_id: userId } as never);
      if (error) return toResult(null, error);
      // Increment count
      await supabase.rpc('increment_feature_vote', { p_request_id: requestId });
      return toResult({ voted: true }, null);
    }
  }

  // -----------------------------------------------------------------------
  // Activations
  // -----------------------------------------------------------------------

  async getActivationProducts(): Promise<DbListResult<ActivationProduct>> {
    const { data, error } = await supabase
      .from('activation_products')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    return toListResult<ActivationProduct>(data as ActivationProduct[] | null, error);
  }

  async createActivationRequest(
    requestData: Partial<ActivationRequest>,
  ): Promise<DbResult<ActivationRequest>> {
    const { data, error } = await supabase
      .from('activation_requests')
      .insert(requestData as never)
      .select()
      .single();
    return toResult<ActivationRequest>(data as ActivationRequest | null, error);
  }

  async getActivationRequests(
    userId?: string,
    status?: ActivationRequestStatus,
  ): Promise<DbListResult<ActivationRequest>> {
    let q = supabase
      .from('activation_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      q = q.eq('user_id', userId);
    }
    if (status) {
      q = q.eq('status', status);
    }

    const { data, error } = await q;
    return toListResult<ActivationRequest>(data as ActivationRequest[] | null, error);
  }

  async processActivationRequest(
    requestId: string,
    approved: boolean,
    adminNotes?: string,
  ): Promise<DbResult<ActivationRequest>> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('activation_requests')
      .update({
        status: approved ? 'completed' : 'rejected',
        admin_notes: adminNotes ?? null,
        processed_by: user?.id ?? null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', requestId)
      .select()
      .single();
    return toResult<ActivationRequest>(data as ActivationRequest | null, error);
  }

  // -----------------------------------------------------------------------
  // Admin
  // -----------------------------------------------------------------------

  async getAdminStats(): Promise<DbResult<{
    total_users: number;
    total_posts: number;
    total_comments: number;
    total_groups: number;
    total_events: number;
  }>> {
    // Run all count queries in parallel
    const [usersRes, postsRes, commentsRes, groupsRes, eventsRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('comments').select('*', { count: 'exact', head: true }),
      supabase.from('groups').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
    ]);

    const anyError = usersRes.error || postsRes.error || commentsRes.error || groupsRes.error || eventsRes.error;
    if (anyError) return toResult(null, anyError);

    return toResult({
      total_users: usersRes.count ?? 0,
      total_posts: postsRes.count ?? 0,
      total_comments: commentsRes.count ?? 0,
      total_groups: groupsRes.count ?? 0,
      total_events: eventsRes.count ?? 0,
    }, null);
  }

  async banUser(
    targetId: string,
    adminId: string,
    reason: string,
    duration?: string,
  ): Promise<DbResult<null>> {
    let banExpiresAt: string | null = null;
    if (duration) {
      const durationMap: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      const ms = durationMap[duration];
      if (ms) {
        banExpiresAt = new Date(Date.now() + ms).toISOString();
      }
      // 'permanent' or unknown durations leave banExpiresAt as null
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        is_banned: true,
        ban_reason: reason,
        ban_expires_at: banExpiresAt,
        banned_by: adminId,
        banned_at: new Date().toISOString(),
      } as never)
      .eq('id', targetId);
    return toResult<null>(null, error);
  }

  async unbanUser(targetId: string, _adminId: string): Promise<DbResult<null>> {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_banned: false,
        ban_reason: null,
        ban_expires_at: null,
        banned_by: null,
        banned_at: null,
      } as never)
      .eq('id', targetId);
    return toResult<null>(null, error);
  }

  async updateUserRole(userId: string, role: UserRole): Promise<DbResult<Profile>> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role } as never)
      .eq('id', userId)
      .select()
      .single();
    return toResult<Profile>(data as Profile | null, error);
  }

  async getAllUsers(
    options?: QueryOptions & { role?: UserRole; search?: string },
  ): Promise<DbListResult<Profile>> {
    let q = supabase.from('profiles').select('*');

    if (options?.role) {
      q = q.eq('role', options.role);
    }
    if (options?.search) {
      q = q.or(`username.ilike.%${options.search}%,display_name.ilike.%${options.search}%`);
    }

    q = applyQueryOptions(q, options, { field: 'created_at', direction: 'desc' });
    const { data, error } = await q;
    return toListResult<Profile>(data as Profile[] | null, error);
  }

  // -----------------------------------------------------------------------
  // Access Control (RPC calls)
  // -----------------------------------------------------------------------

  async hasPremiumAccess(userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('has_premium_access', {
      p_user_id: userId,
    });
    if (error) return false;
    return data ?? false;
  }

  async canAccessGroup(userId: string, groupId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('can_access_group', {
      p_user_id: userId,
      p_group_id: groupId,
    });
    if (error) return false;
    return data ?? false;
  }

  // -----------------------------------------------------------------------
  // Realtime
  // -----------------------------------------------------------------------

  subscribeToTable(
    table: string,
    filter: Record<string, string>,
    callback: RealtimeCallback,
  ): RealtimeSubscription {
    const channelName = `${table}:${Object.values(filter).join(':')}:${Date.now()}`;

    // Build the Postgres Changes filter string  e.g. "group_id=eq.abc-123"
    const filterStr = Object.entries(filter)
      .map(([key, value]) => `${key}=eq.${value}`)
      .join(',');

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table,
          ...(filterStr ? { filter: filterStr } : {}),
        },
        (payload: { eventType: string; new: unknown; old: unknown }) => {
          const event = payload.eventType.toUpperCase() as RealtimeEvent;
          callback(event, {
            new: payload.new as never,
            old: (payload.old ?? null) as never,
          });
        },
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  subscribeToPresence(
    channelName: string,
    userId: string,
    onSync: (presences: Record<string, unknown>) => void,
  ): RealtimeSubscription {
    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        onSync(state as Record<string, unknown>);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }
}
