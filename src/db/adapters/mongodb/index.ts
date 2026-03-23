// ============================================================
// Roost - MongoDB Database Adapter (Prisma)
// Implements DatabaseAdapter interface using Prisma Client
// ============================================================

import { PrismaClient, Prisma } from '@prisma/client';
import type {
  DatabaseAdapter,
  RealtimeCallback,
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
  DbError,
  QueryOptions,
} from '../../interfaces/types';

// --- Singleton Prisma Client ---
let prisma: PrismaClient;

function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// --- Helpers ---

/** Convert a Date to ISO string, or null */
function dateToStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/** Convert a Date to ISO string (non-null) */
function dateToStrNN(d: Date): string {
  return d.toISOString();
}

/** BigInt to number or null */
function bigIntToNum(b: bigint | null | undefined): number | null {
  return b != null ? Number(b) : null;
}

/** Build Prisma pagination/sort from QueryOptions */
function buildQueryArgs(options?: QueryOptions): {
  skip?: number;
  take?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
} {
  const args: { skip?: number; take?: number; orderBy?: Record<string, 'asc' | 'desc'> } = {};
  if (options?.pagination) {
    args.skip = options.pagination.offset;
    args.take = options.pagination.limit;
  }
  if (options?.sort) {
    args.orderBy = { [options.sort.field]: options.sort.direction };
  }
  return args;
}

/** Build a DbError from a caught exception */
function toDbError(err: unknown): DbError {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return { message: err.message, code: err.code, details: JSON.stringify(err.meta) };
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: String(err) };
}

/** Map a Prisma Profile row to the interface Profile type */
function mapProfile(row: any): Profile {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url ?? null,
    bio: row.bio ?? null,
    location: row.location ?? null,
    website: row.website ?? null,
    is_online: row.is_online,
    last_seen_at: dateToStrNN(row.last_seen_at),
    role: row.role as UserRole,
    is_banned: row.is_banned,
    ban_reason: row.ban_reason ?? null,
    ban_expires_at: dateToStr(row.ban_expires_at),
    banned_by: row.banned_by ?? null,
    banned_at: dateToStr(row.banned_at),
    membership_type: row.membership_type,
    two_factor_enabled: row.two_factor_enabled,
    two_factor_secret: row.two_factor_secret ?? null,
    two_factor_verified_at: dateToStr(row.two_factor_verified_at),
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
}

/** Map layout_mode enum from Prisma (default_layout) to interface ('default') */
function mapLayoutMode(mode: string): 'default' | 'sidebar' | 'learn' {
  if (mode === 'default_layout') return 'default';
  return mode as 'sidebar' | 'learn';
}

/** Map a Prisma Group row to the interface Group type */
function mapGroup(row: any): Group {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    avatar_url: row.avatar_url ?? null,
    cover_url: row.cover_url ?? null,
    is_private: row.is_private,
    is_premium: row.is_premium,
    layout_mode: mapLayoutMode(row.layout_mode),
    created_by: row.created_by,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
}

function mapGroupMember(row: any): GroupMember {
  return {
    id: row.id,
    group_id: row.group_id,
    user_id: row.user_id,
    role: row.role as GroupRole,
    joined_at: dateToStrNN(row.joined_at),
    created_at: dateToStrNN(row.joined_at),
    profile: row.user ? mapProfile(row.user) : undefined,
  };
}

function mapCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    icon: row.icon ?? null,
    group_id: row.group_id ?? null,
    display_order: row.display_order,
    is_active: row.is_active,
    created_at: dateToStrNN(row.created_at),
  };
}

function mapPost(row: any): Post {
  const post: Post = {
    id: row.id,
    title: row.title ?? null,
    content: row.content,
    author_id: row.author_id,
    group_id: row.group_id ?? null,
    category_id: row.category_id ?? null,
    is_pinned: row.is_pinned,
    is_edited: row.is_edited,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
  if (row.author) post.author = mapProfile(row.author);
  if (row.category) post.category = mapCategory(row.category);
  if (row.assets) post.assets = row.assets.map(mapAsset);
  if (row._count?.comments != null) post.comment_count = row._count.comments;
  return post;
}

function mapComment(row: any): Comment {
  const comment: Comment = {
    id: row.id,
    post_id: row.post_id ?? null,
    recording_id: row.recording_id ?? null,
    author_id: row.author_id,
    content: row.content,
    parent_comment_id: row.parent_comment_id ?? null,
    is_edited: row.is_edited,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
    vote_count: row.vote_count ?? 0,
  };
  if (row.author) comment.author = mapProfile(row.author);
  if (row.replies) comment.replies = row.replies.map(mapComment);
  return comment;
}

function mapReaction(row: any): Reaction {
  return {
    id: row.id,
    user_id: row.user_id,
    reactable_type: row.reactable_type as ReactableType,
    reactable_id: row.reactable_id,
    reaction_type: row.reaction_type as ReactionType,
    created_at: dateToStrNN(row.created_at),
  };
}

function mapMessage(row: any): Message {
  const msg: Message = {
    id: row.id,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    content: row.content,
    is_read: row.is_read,
    read_at: dateToStr(row.read_at),
    created_at: dateToStrNN(row.created_at),
  };
  if (row.sender) msg.sender = mapProfile(row.sender);
  if (row.recipient) msg.recipient = mapProfile(row.recipient);
  if (row.assets) msg.assets = row.assets.map(mapAsset);
  return msg;
}

function mapAsset(row: any): Asset {
  return {
    id: row.id,
    filename: row.filename,
    file_url: row.file_url,
    file_size: bigIntToNum(row.file_size),
    mime_type: row.mime_type ?? null,
    asset_type: row.asset_type,
    uploaded_by: row.uploaded_by,
    post_id: row.post_id ?? null,
    message_id: row.message_id ?? null,
    created_at: dateToStrNN(row.created_at),
  };
}

function mapNotification(row: any): Notification {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message ?? null,
    link: row.link ?? null,
    is_read: row.is_read,
    email_pending: row.email_pending,
    email_sent_at: dateToStr(row.email_sent_at),
    created_at: dateToStrNN(row.created_at),
  };
}

function mapLeaderboardEntry(row: any): LeaderboardEntry {
  const entry: LeaderboardEntry = {
    id: row.id,
    user_id: row.user_id,
    group_id: row.group_id ?? null,
    points: row.points,
    period_start: dateToStrNN(row.period_start),
    period_end: dateToStrNN(row.period_end),
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
  if (row.user) entry.profile = mapProfile(row.user);
  return entry;
}

function mapPointActivity(row: any): PointActivity {
  return {
    id: row.id,
    user_id: row.user_id,
    group_id: row.group_id ?? null,
    action_type: row.action_type,
    points: row.points,
    description: row.description ?? null,
    reference_id: row.reference_id ?? null,
    created_at: dateToStrNN(row.created_at),
  };
}

function mapEvent(row: any): Event {
  const ev: Event = {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    start_time: dateToStrNN(row.start_time),
    end_time: dateToStrNN(row.end_time),
    location: row.location ?? null,
    is_virtual: row.is_virtual,
    meeting_url: row.meeting_url ?? null,
    group_id: row.group_id,
    created_by: row.created_by,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
  if (row.creator) ev.creator = mapProfile(row.creator);
  if (row.group) ev.group = mapGroup(row.group);
  if (row._count?.attendees != null) ev.attendee_count = row._count.attendees;
  return ev;
}

function mapEventAttendee(row: any): EventAttendee {
  const att: EventAttendee = {
    id: row.id,
    event_id: row.event_id,
    user_id: row.user_id,
    status: row.status as RsvpStatus,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
  if (row.user) att.profile = mapProfile(row.user);
  return att;
}

function mapAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type,
    scope: row.scope,
    group_id: row.group_id ?? null,
    is_active: row.is_active,
    is_dismissible: row.is_dismissible,
    starts_at: dateToStrNN(row.starts_at),
    expires_at: dateToStr(row.expires_at),
    created_by: row.created_by,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
}

function mapShowcase(row: any): Showcase {
  const sc: Showcase = {
    id: row.id,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    url: row.url,
    thumbnail_url: row.thumbnail_url ?? null,
    category: row.category,
    tech_stack: row.tech_stack ?? [],
    author_id: row.author_id,
    status: row.status as ShowcaseStatus,
    moderation_notes: row.moderation_notes ?? null,
    moderated_by: row.moderated_by ?? null,
    moderated_at: dateToStr(row.moderated_at),
    launch_date: dateToStr(row.launch_date),
    is_featured: row.is_featured,
    featured_at: dateToStr(row.featured_at),
    vote_count: row.vote_count,
    review_count: row.review_count,
    average_rating: row.average_rating,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
  if (row.author) sc.author = mapProfile(row.author);
  if (row.images) sc.images = row.images.map(mapShowcaseImage);
  if (row.tag_relations) {
    sc.tags = row.tag_relations
      .filter((tr: any) => tr.tag)
      .map((tr: any) => mapShowcaseTag(tr.tag));
  }
  return sc;
}

function mapShowcaseImage(row: any): ShowcaseImage {
  return {
    id: row.id,
    showcase_id: row.showcase_id,
    image_url: row.image_url,
    display_order: row.display_order,
    caption: row.caption ?? null,
    created_at: dateToStrNN(row.created_at),
  };
}

function mapShowcaseTag(row: any): ShowcaseTag {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    created_at: dateToStrNN(row.created_at),
  };
}

function mapShowcaseReview(row: any): ShowcaseReview {
  const rev: ShowcaseReview = {
    id: row.id,
    showcase_id: row.showcase_id,
    author_id: row.author_id,
    content: row.content,
    rating: row.rating,
    maker_reply: row.maker_reply ?? null,
    maker_replied_at: dateToStr(row.maker_replied_at),
    is_edited: row.is_edited,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
  if (row.author) rev.author = mapProfile(row.author);
  return rev;
}

function mapFollow(row: any): Follow {
  return {
    id: row.id,
    follower_id: row.follower_id,
    following_id: row.following_id,
    created_at: dateToStrNN(row.created_at),
  };
}

function mapLiveSession(row: any): LiveSession {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    youtube_embed_url: row.youtube_embed_url ?? null,
    scheduled_at: dateToStr(row.scheduled_at),
    status: row.status,
    started_at: dateToStr(row.started_at),
    ended_at: dateToStr(row.ended_at),
    created_by: row.created_by ?? null,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
}

function mapLiveSessionMessage(row: any): LiveSessionMessage {
  const msg: LiveSessionMessage = {
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    content: row.content,
    created_at: dateToStrNN(row.created_at),
  };
  if (row.user) msg.user = mapProfile(row.user);
  return msg;
}

function mapModule(row: any): Module {
  return {
    id: row.id,
    group_id: row.group_id,
    title: row.title,
    description: row.description ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    display_order: row.display_order,
    created_by: row.created_by,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
}

function mapRecording(row: any): Recording {
  return {
    id: row.id,
    group_id: row.group_id,
    module_id: row.module_id ?? null,
    title: row.title,
    description: row.description ?? null,
    video_url: row.video_url,
    video_platform: row.video_platform,
    video_id: row.video_id,
    thumbnail_url: row.thumbnail_url ?? null,
    display_order: row.display_order,
    published_by: row.published_by,
    created_at: dateToStrNN(row.created_at),
  };
}

function mapLessonCompletion(row: any): LessonCompletion {
  return {
    id: row.id,
    user_id: row.user_id,
    recording_id: row.recording_id,
    module_id: row.module_id,
    completed_at: dateToStrNN(row.completed_at),
    created_at: dateToStrNN(row.completed_at),
  };
}

function mapFeatureRequest(row: any): FeatureRequest {
  const fr: FeatureRequest = {
    id: row.id,
    title: row.title,
    description: row.description,
    author_id: row.author_id,
    status: row.status as FeatureRequestStatus,
    vote_count: row.vote_count,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
  if (row.author) fr.author = mapProfile(row.author);
  return fr;
}

function mapNotificationPreferences(row: any): NotificationPreferences {
  return {
    id: row.id,
    user_id: row.user_id,
    notify_comments: row.notify_comments,
    notify_replies: row.notify_replies,
    notify_mentions: row.notify_mentions,
    notify_messages: row.notify_messages,
    notify_reactions: row.notify_reactions,
    email_comments: row.email_comments,
    email_replies: row.email_replies,
    email_mentions: row.email_mentions,
    email_messages: row.email_messages,
    email_announcements: row.email_announcements,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
}

function mapActivationProduct(row: any): ActivationProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    product_type: row.product_type,
    monthly_limit: row.monthly_limit,
    is_active: row.is_active,
    icon_url: row.icon_url ?? null,
    instructions: row.instructions ?? null,
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
}

function mapActivationRequest(row: any): ActivationRequest {
  return {
    id: row.id,
    user_id: row.user_id,
    product_id: row.product_id,
    status: row.status as ActivationRequestStatus,
    website_url: row.website_url,
    wp_username: row.wp_username,
    wp_password: row.wp_password,
    notes: row.notes ?? null,
    admin_notes: row.admin_notes ?? null,
    processed_by: row.processed_by ?? null,
    processed_at: dateToStr(row.processed_at),
    created_at: dateToStrNN(row.created_at),
    updated_at: dateToStrNN(row.updated_at),
  };
}

// ============================================================
// MongoDB Adapter
// ============================================================

export class MongoDBAdapter implements DatabaseAdapter {
  private db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  // ==========================================================
  // Profiles
  // ==========================================================

  async getProfile(userId: string): Promise<DbResult<Profile>> {
    try {
      const row = await this.db.profile.findUnique({ where: { id: userId } });
      return { data: row ? mapProfile(row) : null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getProfileByUsername(username: string): Promise<DbResult<Profile>> {
    try {
      const row = await this.db.profile.findUnique({ where: { username } });
      return { data: row ? mapProfile(row) : null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateProfile(userId: string, data: Partial<Profile>): Promise<DbResult<Profile>> {
    try {
      const row = await this.db.profile.update({
        where: { id: userId },
        data: {
          ...(data.display_name !== undefined && { display_name: data.display_name }),
          ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
          ...(data.bio !== undefined && { bio: data.bio }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.website !== undefined && { website: data.website }),
          ...(data.is_online !== undefined && { is_online: data.is_online }),
          ...(data.last_seen_at !== undefined && { last_seen_at: new Date(data.last_seen_at) }),
        },
      });
      return { data: mapProfile(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async searchProfiles(query: string, options?: QueryOptions): Promise<DbListResult<Profile>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.ProfileWhereInput = {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { display_name: { contains: query, mode: 'insensitive' } },
        ],
      };
      const [rows, count] = await Promise.all([
        this.db.profile.findMany({ where, skip, take, orderBy: orderBy ?? { display_name: 'asc' } }),
        this.db.profile.count({ where }),
      ]);
      return { data: rows.map(mapProfile), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async getOnlineProfiles(options?: QueryOptions): Promise<DbListResult<Profile>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.ProfileWhereInput = { is_online: true };
      const [rows, count] = await Promise.all([
        this.db.profile.findMany({ where, skip, take, orderBy: orderBy ?? { display_name: 'asc' } }),
        this.db.profile.count({ where }),
      ]);
      return { data: rows.map(mapProfile), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  // ==========================================================
  // Groups
  // ==========================================================

  async getGroup(groupId: string): Promise<DbResult<Group>> {
    try {
      const row = await this.db.group.findUnique({ where: { id: groupId } });
      return { data: row ? mapGroup(row) : null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getGroupBySlug(slug: string): Promise<DbResult<Group>> {
    try {
      const row = await this.db.group.findUnique({ where: { slug } });
      return { data: row ? mapGroup(row) : null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getGroups(options?: QueryOptions): Promise<DbListResult<Group>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const [rows, count] = await Promise.all([
        this.db.group.findMany({ skip, take, orderBy: orderBy ?? { created_at: 'desc' } }),
        this.db.group.count(),
      ]);
      return { data: rows.map(mapGroup), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async createGroup(data: Partial<Group>): Promise<DbResult<Group>> {
    try {
      const row = await this.db.group.create({
        data: {
          name: data.name!,
          slug: data.slug!,
          description: data.description ?? null,
          avatar_url: data.avatar_url ?? null,
          cover_url: data.cover_url ?? null,
          is_private: data.is_private ?? false,
          is_premium: data.is_premium ?? false,
          created_by: data.created_by!,
        },
      });
      return { data: mapGroup(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateGroup(groupId: string, data: Partial<Group>): Promise<DbResult<Group>> {
    try {
      const row = await this.db.group.update({
        where: { id: groupId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
          ...(data.cover_url !== undefined && { cover_url: data.cover_url }),
          ...(data.is_private !== undefined && { is_private: data.is_private }),
          ...(data.is_premium !== undefined && { is_premium: data.is_premium }),
        },
      });
      return { data: mapGroup(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async deleteGroup(groupId: string): Promise<DbResult<null>> {
    try {
      await this.db.group.delete({ where: { id: groupId } });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Group Members
  // ==========================================================

  async getGroupMembers(groupId: string, options?: QueryOptions): Promise<DbListResult<GroupMember>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.GroupMemberWhereInput = { group_id: groupId };
      const [rows, count] = await Promise.all([
        this.db.groupMember.findMany({
          where,
          include: { user: true },
          skip,
          take,
          orderBy: orderBy ?? { joined_at: 'desc' },
        }),
        this.db.groupMember.count({ where }),
      ]);
      return { data: rows.map(mapGroupMember), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async getGroupMember(groupId: string, userId: string): Promise<DbResult<GroupMember>> {
    try {
      const row = await this.db.groupMember.findUnique({
        where: { group_id_user_id: { group_id: groupId, user_id: userId } },
        include: { user: true },
      });
      return { data: row ? mapGroupMember(row) : null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async joinGroup(groupId: string, userId: string): Promise<DbResult<GroupMember>> {
    try {
      const row = await this.db.groupMember.create({
        data: { group_id: groupId, user_id: userId, role: 'member' },
        include: { user: true },
      });
      return { data: mapGroupMember(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async leaveGroup(groupId: string, userId: string): Promise<DbResult<null>> {
    try {
      await this.db.groupMember.delete({
        where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateMemberRole(groupId: string, userId: string, role: GroupRole): Promise<DbResult<GroupMember>> {
    try {
      const row = await this.db.groupMember.update({
        where: { group_id_user_id: { group_id: groupId, user_id: userId } },
        data: { role },
        include: { user: true },
      });
      return { data: mapGroupMember(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getUserGroups(userId: string): Promise<DbListResult<Group>> {
    try {
      const memberships = await this.db.groupMember.findMany({
        where: { user_id: userId },
        include: { group: true },
      });
      const groups = memberships.map((m) => mapGroup(m.group));
      return { data: groups, error: null, count: groups.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async isGroupMember(groupId: string, userId: string): Promise<boolean> {
    try {
      const row = await this.db.groupMember.findUnique({
        where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      });
      return !!row;
    } catch {
      return false;
    }
  }

  async isGroupAdminOrMod(groupId: string, userId: string): Promise<boolean> {
    try {
      const row = await this.db.groupMember.findUnique({
        where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      });
      return !!row && (row.role === 'admin' || row.role === 'moderator');
    } catch {
      return false;
    }
  }

  // ==========================================================
  // Categories
  // ==========================================================

  async getCategories(groupId?: string | null): Promise<DbListResult<Category>> {
    try {
      const where: Prisma.CategoryWhereInput = {};
      if (groupId === null) {
        where.group_id = null;
      } else if (groupId !== undefined) {
        where.group_id = groupId;
      }
      const rows = await this.db.category.findMany({
        where,
        orderBy: { display_order: 'asc' },
      });
      return { data: rows.map(mapCategory), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async createCategory(data: Partial<Category>): Promise<DbResult<Category>> {
    try {
      const row = await this.db.category.create({
        data: {
          name: data.name!,
          slug: data.slug!,
          color: data.color ?? '#6366f1',
          icon: data.icon ?? null,
          group_id: data.group_id ?? null,
          display_order: data.display_order ?? 0,
          is_active: data.is_active ?? true,
        },
      });
      return { data: mapCategory(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateCategory(categoryId: string, data: Partial<Category>): Promise<DbResult<Category>> {
    try {
      const row = await this.db.category.update({
        where: { id: categoryId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.slug !== undefined && { slug: data.slug }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.icon !== undefined && { icon: data.icon }),
          ...(data.display_order !== undefined && { display_order: data.display_order }),
          ...(data.is_active !== undefined && { is_active: data.is_active }),
        },
      });
      return { data: mapCategory(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async deleteCategory(categoryId: string): Promise<DbResult<null>> {
    try {
      await this.db.category.delete({ where: { id: categoryId } });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Posts
  // ==========================================================

  async getPost(postId: string, userId?: string): Promise<DbResult<Post>> {
    try {
      const row = await this.db.post.findUnique({
        where: { id: postId },
        include: {
          author: true,
          category: true,
          assets: true,
          reactions: true,
          _count: { select: { comments: true } },
        },
      });
      if (!row) return { data: null, error: null };

      const post = mapPost(row);
      // Build reaction counts
      const counts: Record<string, number> = {};
      let userReaction: ReactionType | null = null;
      for (const r of row.reactions) {
        counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
        if (userId && r.user_id === userId) {
          userReaction = r.reaction_type as ReactionType;
        }
      }
      post.reaction_counts = counts as Record<ReactionType, number>;
      post.user_reaction = userReaction;
      return { data: post, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getPosts(
    groupId: string | null,
    options?: QueryOptions & { categoryId?: string; userId?: string }
  ): Promise<DbListResult<Post>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.PostWhereInput = {};
      if (groupId !== undefined && groupId !== null) {
        where.group_id = groupId;
      } else if (groupId === null) {
        where.group_id = null;
      }
      if (options?.categoryId) where.category_id = options.categoryId;

      const [rows, count] = await Promise.all([
        this.db.post.findMany({
          where,
          include: {
            author: true,
            category: true,
            assets: true,
            reactions: true,
            _count: { select: { comments: true } },
          },
          skip,
          take,
          orderBy: orderBy ?? [{ is_pinned: 'desc' }, { created_at: 'desc' }],
        }),
        this.db.post.count({ where }),
      ]);

      const posts = rows.map((row) => {
        const post = mapPost(row);
        const counts: Record<string, number> = {};
        let userReaction: ReactionType | null = null;
        for (const r of row.reactions) {
          counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
          if (options?.userId && r.user_id === options.userId) {
            userReaction = r.reaction_type as ReactionType;
          }
        }
        post.reaction_counts = counts as Record<ReactionType, number>;
        post.user_reaction = userReaction;
        return post;
      });

      return { data: posts, error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async createPost(data: Partial<Post>): Promise<DbResult<Post>> {
    try {
      const row = await this.db.post.create({
        data: {
          title: data.title ?? null,
          content: data.content!,
          author_id: data.author_id!,
          group_id: data.group_id ?? null,
          category_id: data.category_id ?? null,
          is_pinned: data.is_pinned ?? false,
        },
        include: { author: true, category: true, assets: true },
      });
      return { data: mapPost(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updatePost(postId: string, data: Partial<Post>): Promise<DbResult<Post>> {
    try {
      const row = await this.db.post.update({
        where: { id: postId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.content !== undefined && { content: data.content }),
          ...(data.category_id !== undefined && { category_id: data.category_id }),
          is_edited: true,
        },
        include: { author: true, category: true, assets: true },
      });
      return { data: mapPost(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async deletePost(postId: string): Promise<DbResult<null>> {
    try {
      await this.db.post.delete({ where: { id: postId } });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async pinPost(postId: string, pinned: boolean): Promise<DbResult<Post>> {
    try {
      const row = await this.db.post.update({
        where: { id: postId },
        data: { is_pinned: pinned },
        include: { author: true, category: true, assets: true },
      });
      return { data: mapPost(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async searchPosts(query: string, groupId?: string | null): Promise<DbListResult<Post>> {
    try {
      const where: Prisma.PostWhereInput = {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      };
      if (groupId !== undefined && groupId !== null) {
        where.group_id = groupId;
      } else if (groupId === null) {
        where.group_id = null;
      }
      const rows = await this.db.post.findMany({
        where,
        include: { author: true, category: true, assets: true, _count: { select: { comments: true } } },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
      return { data: rows.map(mapPost), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  // ==========================================================
  // Comments
  // ==========================================================

  async getComments(postId: string, userId?: string): Promise<DbListResult<Comment>> {
    try {
      const rows = await this.db.comment.findMany({
        where: { post_id: postId, parent_comment_id: null },
        include: {
          author: true,
          votes: true,
          replies: {
            include: { author: true, votes: true },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { created_at: 'asc' },
      });

      const comments = rows.map((row) => {
        const comment = mapComment(row);
        if (userId) {
          const userVote = (row as any).votes?.find((v: any) => v.user_id === userId);
          comment.user_vote = userVote ? (userVote.vote_type as 'up' | 'down') : null;
        }
        if (comment.replies) {
          comment.replies = comment.replies.map((reply: any, _i: number) => {
            const originalReply = (row as any).replies?.[_i];
            if (userId && originalReply?.votes) {
              const uv = originalReply.votes.find((v: any) => v.user_id === userId);
              reply.user_vote = uv ? (uv.vote_type as 'up' | 'down') : null;
            }
            return reply;
          });
        }
        return comment;
      });

      return { data: comments, error: null, count: comments.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async getRecordingComments(recordingId: string, userId?: string): Promise<DbListResult<Comment>> {
    try {
      const rows = await this.db.comment.findMany({
        where: { recording_id: recordingId, parent_comment_id: null },
        include: {
          author: true,
          votes: true,
          replies: {
            include: { author: true, votes: true },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { created_at: 'asc' },
      });

      const comments = rows.map((row) => {
        const comment = mapComment(row);
        if (userId) {
          const userVote = (row as any).votes?.find((v: any) => v.user_id === userId);
          comment.user_vote = userVote ? (userVote.vote_type as 'up' | 'down') : null;
        }
        return comment;
      });

      return { data: comments, error: null, count: comments.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async createComment(data: Partial<Comment>): Promise<DbResult<Comment>> {
    try {
      const row = await this.db.comment.create({
        data: {
          post_id: data.post_id ?? null,
          recording_id: data.recording_id ?? null,
          author_id: data.author_id!,
          content: data.content!,
          parent_comment_id: data.parent_comment_id ?? null,
        },
        include: { author: true },
      });
      return { data: mapComment(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateComment(commentId: string, content: string): Promise<DbResult<Comment>> {
    try {
      const row = await this.db.comment.update({
        where: { id: commentId },
        data: { content, is_edited: true },
        include: { author: true },
      });
      return { data: mapComment(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async deleteComment(commentId: string): Promise<DbResult<null>> {
    try {
      await this.db.comment.delete({ where: { id: commentId } });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async toggleCommentVote(
    userId: string,
    commentId: string,
    voteType: 'up' | 'down'
  ): Promise<DbResult<{ vote_count: number }>> {
    try {
      const existing = await this.db.commentVote.findUnique({
        where: { user_id_comment_id: { user_id: userId, comment_id: commentId } },
      });

      if (existing) {
        if (existing.vote_type === voteType) {
          // Remove vote
          await this.db.commentVote.delete({
            where: { id: existing.id },
          });
          const delta = voteType === 'up' ? -1 : 1;
          const comment = await this.db.comment.update({
            where: { id: commentId },
            data: { vote_count: { increment: delta } },
          });
          return { data: { vote_count: comment.vote_count }, error: null };
        } else {
          // Switch vote
          await this.db.commentVote.update({
            where: { id: existing.id },
            data: { vote_type: voteType },
          });
          const delta = voteType === 'up' ? 2 : -2;
          const comment = await this.db.comment.update({
            where: { id: commentId },
            data: { vote_count: { increment: delta } },
          });
          return { data: { vote_count: comment.vote_count }, error: null };
        }
      } else {
        // Create vote
        await this.db.commentVote.create({
          data: { user_id: userId, comment_id: commentId, vote_type: voteType },
        });
        const delta = voteType === 'up' ? 1 : -1;
        const comment = await this.db.comment.update({
          where: { id: commentId },
          data: { vote_count: { increment: delta } },
        });
        return { data: { vote_count: comment.vote_count }, error: null };
      }
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Reactions
  // ==========================================================

  async getReactions(reactableType: ReactableType, reactableId: string): Promise<DbListResult<Reaction>> {
    try {
      const rows = await this.db.reaction.findMany({
        where: { reactable_type: reactableType, reactable_id: reactableId },
      });
      return { data: rows.map(mapReaction), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async toggleReaction(
    userId: string,
    reactableType: ReactableType,
    reactableId: string,
    reactionType: ReactionType
  ): Promise<DbResult<{ added: boolean }>> {
    try {
      const existing = await this.db.reaction.findUnique({
        where: {
          user_id_reactable_type_reactable_id: {
            user_id: userId,
            reactable_type: reactableType,
            reactable_id: reactableId,
          },
        },
      });

      if (existing) {
        if (existing.reaction_type === reactionType) {
          // Remove reaction
          await this.db.reaction.delete({ where: { id: existing.id } });
          return { data: { added: false }, error: null };
        } else {
          // Change reaction type
          await this.db.reaction.update({
            where: { id: existing.id },
            data: { reaction_type: reactionType },
          });
          return { data: { added: true }, error: null };
        }
      } else {
        // Create reaction
        await this.db.reaction.create({
          data: {
            user_id: userId,
            reactable_type: reactableType,
            reactable_id: reactableId,
            reaction_type: reactionType,
          },
        });
        return { data: { added: true }, error: null };
      }
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getReactionCounts(
    reactableType: ReactableType,
    reactableId: string
  ): Promise<DbResult<Record<ReactionType, number>>> {
    try {
      const rows = await this.db.reaction.groupBy({
        by: ['reaction_type'],
        where: { reactable_type: reactableType, reactable_id: reactableId },
        _count: { reaction_type: true },
      });
      const counts: Record<string, number> = {};
      for (const row of rows) {
        counts[row.reaction_type] = row._count.reaction_type;
      }
      return { data: counts as Record<ReactionType, number>, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getUserReaction(
    userId: string,
    reactableType: ReactableType,
    reactableId: string
  ): Promise<DbResult<ReactionType | null>> {
    try {
      const row = await this.db.reaction.findUnique({
        where: {
          user_id_reactable_type_reactable_id: {
            user_id: userId,
            reactable_type: reactableType,
            reactable_id: reactableId,
          },
        },
      });
      return { data: row ? (row.reaction_type as ReactionType) : null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Messages
  // ==========================================================

  async getConversations(
    userId: string
  ): Promise<DbListResult<Message & { other_user: Profile; unread_count: number }>> {
    try {
      // Get all messages involving this user, grouped by conversation partner
      const allMessages = await this.db.message.findMany({
        where: {
          OR: [{ sender_id: userId }, { recipient_id: userId }],
        },
        include: { sender: true, recipient: true },
        orderBy: { created_at: 'desc' },
      });

      // Group by conversation partner and get latest message + unread count
      const convMap = new Map<
        string,
        { message: any; otherUser: any; unreadCount: number }
      >();
      for (const msg of allMessages) {
        const otherId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
        if (!convMap.has(otherId)) {
          const otherUser = msg.sender_id === userId ? msg.recipient : msg.sender;
          convMap.set(otherId, { message: msg, otherUser, unreadCount: 0 });
        }
        // Count unread messages sent TO this user
        if (msg.recipient_id === userId && !msg.is_read) {
          const entry = convMap.get(otherId)!;
          entry.unreadCount += 1;
        }
      }

      const conversations = Array.from(convMap.values()).map(({ message, otherUser, unreadCount }) => {
        const mapped = mapMessage(message) as Message & { other_user: Profile; unread_count: number };
        mapped.other_user = mapProfile(otherUser);
        mapped.unread_count = unreadCount;
        return mapped;
      });

      return { data: conversations, error: null, count: conversations.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async getMessages(userId: string, otherUserId: string, options?: QueryOptions): Promise<DbListResult<Message>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.MessageWhereInput = {
        OR: [
          { sender_id: userId, recipient_id: otherUserId },
          { sender_id: otherUserId, recipient_id: userId },
        ],
      };
      const [rows, count] = await Promise.all([
        this.db.message.findMany({
          where,
          include: { sender: true, recipient: true, assets: true },
          skip,
          take,
          orderBy: orderBy ?? { created_at: 'asc' },
        }),
        this.db.message.count({ where }),
      ]);
      return { data: rows.map(mapMessage), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async sendMessage(senderId: string, recipientId: string, content: string): Promise<DbResult<Message>> {
    try {
      const row = await this.db.message.create({
        data: { sender_id: senderId, recipient_id: recipientId, content },
        include: { sender: true, recipient: true },
      });
      return { data: mapMessage(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async markMessageRead(messageId: string): Promise<DbResult<null>> {
    try {
      await this.db.message.update({
        where: { id: messageId },
        data: { is_read: true, read_at: new Date() },
      });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async markAllMessagesRead(userId: string, otherUserId: string): Promise<DbResult<null>> {
    try {
      await this.db.message.updateMany({
        where: { sender_id: otherUserId, recipient_id: userId, is_read: false },
        data: { is_read: true, read_at: new Date() },
      });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getUnreadMessageCount(userId: string): Promise<DbResult<number>> {
    try {
      const count = await this.db.message.count({
        where: { recipient_id: userId, is_read: false },
      });
      return { data: count, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Assets
  // ==========================================================

  async createAsset(data: Partial<Asset>): Promise<DbResult<Asset>> {
    try {
      const row = await this.db.asset.create({
        data: {
          filename: data.filename!,
          file_url: data.file_url!,
          file_size: data.file_size != null ? BigInt(data.file_size) : null,
          mime_type: data.mime_type ?? null,
          asset_type: data.asset_type!,
          uploaded_by: data.uploaded_by!,
          post_id: data.post_id ?? null,
          message_id: data.message_id ?? null,
        },
      });
      return { data: mapAsset(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getPostAssets(postId: string): Promise<DbListResult<Asset>> {
    try {
      const rows = await this.db.asset.findMany({
        where: { post_id: postId },
        orderBy: { created_at: 'asc' },
      });
      return { data: rows.map(mapAsset), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async getMessageAssets(messageId: string): Promise<DbListResult<Asset>> {
    try {
      const rows = await this.db.asset.findMany({
        where: { message_id: messageId },
        orderBy: { created_at: 'asc' },
      });
      return { data: rows.map(mapAsset), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async deleteAsset(assetId: string): Promise<DbResult<null>> {
    try {
      await this.db.asset.delete({ where: { id: assetId } });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Notifications
  // ==========================================================

  async getNotifications(userId: string, options?: QueryOptions): Promise<DbListResult<Notification>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.NotificationWhereInput = { user_id: userId };
      const [rows, count] = await Promise.all([
        this.db.notification.findMany({
          where,
          skip,
          take,
          orderBy: orderBy ?? { created_at: 'desc' },
        }),
        this.db.notification.count({ where }),
      ]);
      return { data: rows.map(mapNotification), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<DbResult<number>> {
    try {
      const count = await this.db.notification.count({
        where: { user_id: userId, is_read: false },
      });
      return { data: count, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async markNotificationRead(notificationId: string): Promise<DbResult<null>> {
    try {
      await this.db.notification.update({
        where: { id: notificationId },
        data: { is_read: true },
      });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async markAllNotificationsRead(userId: string): Promise<DbResult<null>> {
    try {
      await this.db.notification.updateMany({
        where: { user_id: userId, is_read: false },
        data: { is_read: true },
      });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async createNotification(data: Partial<Notification>): Promise<DbResult<Notification>> {
    try {
      const row = await this.db.notification.create({
        data: {
          user_id: data.user_id!,
          type: data.type!,
          title: data.title!,
          message: data.message ?? null,
          link: data.link ?? null,
          email_pending: data.email_pending ?? false,
        },
      });
      return { data: mapNotification(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getNotificationPreferences(userId: string): Promise<DbResult<NotificationPreferences>> {
    try {
      let row = await this.db.notificationPreferences.findUnique({ where: { user_id: userId } });
      if (!row) {
        // Create default preferences
        row = await this.db.notificationPreferences.create({
          data: { user_id: userId },
        });
      }
      return { data: mapNotificationPreferences(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateNotificationPreferences(
    userId: string,
    data: Partial<NotificationPreferences>
  ): Promise<DbResult<NotificationPreferences>> {
    try {
      const row = await this.db.notificationPreferences.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          ...(data.notify_comments !== undefined && { notify_comments: data.notify_comments }),
          ...(data.notify_replies !== undefined && { notify_replies: data.notify_replies }),
          ...(data.notify_mentions !== undefined && { notify_mentions: data.notify_mentions }),
          ...(data.notify_messages !== undefined && { notify_messages: data.notify_messages }),
          ...(data.notify_reactions !== undefined && { notify_reactions: data.notify_reactions }),
          ...(data.email_comments !== undefined && { email_comments: data.email_comments }),
          ...(data.email_replies !== undefined && { email_replies: data.email_replies }),
          ...(data.email_mentions !== undefined && { email_mentions: data.email_mentions }),
          ...(data.email_messages !== undefined && { email_messages: data.email_messages }),
          ...(data.email_announcements !== undefined && { email_announcements: data.email_announcements }),
        },
        update: {
          ...(data.notify_comments !== undefined && { notify_comments: data.notify_comments }),
          ...(data.notify_replies !== undefined && { notify_replies: data.notify_replies }),
          ...(data.notify_mentions !== undefined && { notify_mentions: data.notify_mentions }),
          ...(data.notify_messages !== undefined && { notify_messages: data.notify_messages }),
          ...(data.notify_reactions !== undefined && { notify_reactions: data.notify_reactions }),
          ...(data.email_comments !== undefined && { email_comments: data.email_comments }),
          ...(data.email_replies !== undefined && { email_replies: data.email_replies }),
          ...(data.email_mentions !== undefined && { email_mentions: data.email_mentions }),
          ...(data.email_messages !== undefined && { email_messages: data.email_messages }),
          ...(data.email_announcements !== undefined && { email_announcements: data.email_announcements }),
        },
      });
      return { data: mapNotificationPreferences(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Leaderboard
  // ==========================================================

  async getLeaderboard(
    period: string,
    groupId?: string | null,
    options?: QueryOptions
  ): Promise<DbListResult<LeaderboardEntry>> {
    try {
      const { skip, take } = buildQueryArgs(options);
      const where: Prisma.LeaderboardEntryWhereInput = {};

      // Determine period range
      const now = new Date();
      if (period === 'weekly') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        where.period_start = { gte: weekStart };
      } else if (period === 'monthly') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        where.period_start = { gte: monthStart };
      }
      // 'all_time' has no date filter

      if (groupId !== undefined && groupId !== null) {
        where.group_id = groupId;
      } else if (groupId === null) {
        where.group_id = null;
      }

      const [rows, count] = await Promise.all([
        this.db.leaderboardEntry.findMany({
          where,
          include: { user: true },
          orderBy: { points: 'desc' },
          skip,
          take,
        }),
        this.db.leaderboardEntry.count({ where }),
      ]);
      return { data: rows.map(mapLeaderboardEntry), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async getUserRank(
    userId: string,
    period: string,
    groupId?: string | null
  ): Promise<DbResult<{ rank: number; points: number }>> {
    try {
      const where: Prisma.LeaderboardEntryWhereInput = {};
      const now = new Date();
      if (period === 'weekly') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        where.period_start = { gte: weekStart };
      } else if (period === 'monthly') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        where.period_start = { gte: monthStart };
      }

      if (groupId !== undefined && groupId !== null) {
        where.group_id = groupId;
      } else if (groupId === null) {
        where.group_id = null;
      }

      // Get user's entry
      const userEntry = await this.db.leaderboardEntry.findFirst({
        where: { ...where, user_id: userId },
        orderBy: { points: 'desc' },
      });

      if (!userEntry) {
        return { data: { rank: 0, points: 0 }, error: null };
      }

      // Count how many users have more points
      const higherCount = await this.db.leaderboardEntry.count({
        where: { ...where, points: { gt: userEntry.points } },
      });

      return { data: { rank: higherCount + 1, points: userEntry.points }, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getPointActivities(userId: string, options?: QueryOptions): Promise<DbListResult<PointActivity>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.PointActivityWhereInput = { user_id: userId };
      const [rows, count] = await Promise.all([
        this.db.pointActivity.findMany({
          where,
          skip,
          take,
          orderBy: orderBy ?? { created_at: 'desc' },
        }),
        this.db.pointActivity.count({ where }),
      ]);
      return { data: rows.map(mapPointActivity), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  // ==========================================================
  // Events
  // ==========================================================

  async getEvents(groupId?: string, options?: QueryOptions): Promise<DbListResult<Event>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.EventWhereInput = {};
      if (groupId) where.group_id = groupId;

      const [rows, count] = await Promise.all([
        this.db.event.findMany({
          where,
          include: {
            creator: true,
            group: true,
            _count: { select: { attendees: true } },
          },
          skip,
          take,
          orderBy: orderBy ?? { start_time: 'asc' },
        }),
        this.db.event.count({ where }),
      ]);
      return { data: rows.map(mapEvent), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async getEvent(eventId: string, userId?: string): Promise<DbResult<Event>> {
    try {
      const row = await this.db.event.findUnique({
        where: { id: eventId },
        include: {
          creator: true,
          group: true,
          attendees: true,
          _count: { select: { attendees: true } },
        },
      });
      if (!row) return { data: null, error: null };

      const event = mapEvent(row);
      if (userId) {
        const userRsvp = row.attendees.find((a) => a.user_id === userId);
        event.user_rsvp = userRsvp ? (userRsvp.status as RsvpStatus) : null;
      }
      return { data: event, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async createEvent(data: Partial<Event>): Promise<DbResult<Event>> {
    try {
      const row = await this.db.event.create({
        data: {
          title: data.title!,
          description: data.description ?? null,
          start_time: new Date(data.start_time!),
          end_time: new Date(data.end_time!),
          location: data.location ?? null,
          is_virtual: data.is_virtual ?? false,
          meeting_url: data.meeting_url ?? null,
          group_id: data.group_id!,
          created_by: data.created_by!,
        },
        include: { creator: true, group: true, _count: { select: { attendees: true } } },
      });
      return { data: mapEvent(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateEvent(eventId: string, data: Partial<Event>): Promise<DbResult<Event>> {
    try {
      const row = await this.db.event.update({
        where: { id: eventId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.start_time !== undefined && { start_time: new Date(data.start_time!) }),
          ...(data.end_time !== undefined && { end_time: new Date(data.end_time!) }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.is_virtual !== undefined && { is_virtual: data.is_virtual }),
          ...(data.meeting_url !== undefined && { meeting_url: data.meeting_url }),
        },
        include: { creator: true, group: true, _count: { select: { attendees: true } } },
      });
      return { data: mapEvent(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async deleteEvent(eventId: string): Promise<DbResult<null>> {
    try {
      await this.db.event.delete({ where: { id: eventId } });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async rsvpEvent(eventId: string, userId: string, status: RsvpStatus): Promise<DbResult<EventAttendee>> {
    try {
      const row = await this.db.eventAttendee.upsert({
        where: { event_id_user_id: { event_id: eventId, user_id: userId } },
        create: { event_id: eventId, user_id: userId, status },
        update: { status },
        include: { user: true },
      });
      return { data: mapEventAttendee(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getEventAttendees(eventId: string): Promise<DbListResult<EventAttendee>> {
    try {
      const rows = await this.db.eventAttendee.findMany({
        where: { event_id: eventId },
        include: { user: true },
        orderBy: { created_at: 'asc' },
      });
      return { data: rows.map(mapEventAttendee), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  // ==========================================================
  // Announcements
  // ==========================================================

  async getActiveAnnouncements(userId: string, groupId?: string | null): Promise<DbListResult<Announcement>> {
    try {
      const now = new Date();
      const where: Prisma.AnnouncementWhereInput = {
        is_active: true,
        starts_at: { lte: now },
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
        // Exclude dismissed by this user
        NOT: {
          dismissals: { some: { user_id: userId } },
        },
      };

      if (groupId !== undefined && groupId !== null) {
        where.AND = [
          {
            OR: [
              { scope: 'global', group_id: null },
              { scope: 'group', group_id: groupId },
            ],
          },
        ];
      } else {
        where.scope = 'global';
        where.group_id = null;
      }

      const rows = await this.db.announcement.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
      return { data: rows.map(mapAnnouncement), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async createAnnouncement(data: Partial<Announcement>): Promise<DbResult<Announcement>> {
    try {
      const row = await this.db.announcement.create({
        data: {
          title: data.title!,
          content: data.content!,
          type: data.type ?? 'info',
          scope: data.scope ?? 'global',
          group_id: data.group_id ?? null,
          is_active: data.is_active ?? true,
          is_dismissible: data.is_dismissible ?? true,
          starts_at: data.starts_at ? new Date(data.starts_at) : new Date(),
          expires_at: data.expires_at ? new Date(data.expires_at) : null,
          created_by: data.created_by!,
        },
      });
      return { data: mapAnnouncement(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateAnnouncement(announcementId: string, data: Partial<Announcement>): Promise<DbResult<Announcement>> {
    try {
      const row = await this.db.announcement.update({
        where: { id: announcementId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.content !== undefined && { content: data.content }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.is_active !== undefined && { is_active: data.is_active }),
          ...(data.is_dismissible !== undefined && { is_dismissible: data.is_dismissible }),
          ...(data.starts_at !== undefined && { starts_at: new Date(data.starts_at!) }),
          ...(data.expires_at !== undefined && { expires_at: data.expires_at ? new Date(data.expires_at) : null }),
        },
      });
      return { data: mapAnnouncement(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async deleteAnnouncement(announcementId: string): Promise<DbResult<null>> {
    try {
      await this.db.announcement.delete({ where: { id: announcementId } });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async dismissAnnouncement(announcementId: string, userId: string): Promise<DbResult<null>> {
    try {
      await this.db.announcementDismissal.create({
        data: { announcement_id: announcementId, user_id: userId },
      });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Showcases
  // ==========================================================

  async getShowcases(
    options?: QueryOptions & { status?: ShowcaseStatus; category?: string }
  ): Promise<DbListResult<Showcase>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.ShowcaseWhereInput = {};
      if (options?.status) where.status = options.status;
      if (options?.category) where.category = options.category as any;

      const [rows, count] = await Promise.all([
        this.db.showcase.findMany({
          where,
          include: {
            author: true,
            images: { orderBy: { display_order: 'asc' } },
            tag_relations: { include: { tag: true } },
          },
          skip,
          take,
          orderBy: orderBy ?? { created_at: 'desc' },
        }),
        this.db.showcase.count({ where }),
      ]);
      return { data: rows.map(mapShowcase), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async getShowcase(showcaseId: string): Promise<DbResult<Showcase>> {
    try {
      const row = await this.db.showcase.findUnique({
        where: { id: showcaseId },
        include: {
          author: true,
          images: { orderBy: { display_order: 'asc' } },
          tag_relations: { include: { tag: true } },
        },
      });
      return { data: row ? mapShowcase(row) : null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async createShowcase(
    data: Partial<Showcase>,
    images?: Partial<ShowcaseImage>[]
  ): Promise<DbResult<Showcase>> {
    try {
      const row = await this.db.showcase.create({
        data: {
          title: data.title!,
          tagline: data.tagline!,
          description: data.description!,
          url: data.url!,
          thumbnail_url: data.thumbnail_url ?? null,
          category: data.category!,
          tech_stack: data.tech_stack ?? [],
          author_id: data.author_id!,
          status: data.status ?? 'pending',
          launch_date: data.launch_date ? new Date(data.launch_date) : null,
          ...(images && images.length > 0
            ? {
                images: {
                  create: images.map((img, i) => ({
                    image_url: img.image_url!,
                    display_order: img.display_order ?? i,
                    caption: img.caption ?? null,
                  })),
                },
              }
            : {}),
        },
        include: {
          author: true,
          images: { orderBy: { display_order: 'asc' } },
          tag_relations: { include: { tag: true } },
        },
      });
      return { data: mapShowcase(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateShowcase(showcaseId: string, data: Partial<Showcase>): Promise<DbResult<Showcase>> {
    try {
      const row = await this.db.showcase.update({
        where: { id: showcaseId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.tagline !== undefined && { tagline: data.tagline }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.url !== undefined && { url: data.url }),
          ...(data.thumbnail_url !== undefined && { thumbnail_url: data.thumbnail_url }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.tech_stack !== undefined && { tech_stack: data.tech_stack }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.moderation_notes !== undefined && { moderation_notes: data.moderation_notes }),
          ...(data.moderated_by !== undefined && { moderated_by: data.moderated_by }),
          ...(data.moderated_at !== undefined && { moderated_at: data.moderated_at ? new Date(data.moderated_at) : null }),
          ...(data.is_featured !== undefined && { is_featured: data.is_featured }),
          ...(data.featured_at !== undefined && { featured_at: data.featured_at ? new Date(data.featured_at) : null }),
        },
        include: {
          author: true,
          images: { orderBy: { display_order: 'asc' } },
          tag_relations: { include: { tag: true } },
        },
      });
      return { data: mapShowcase(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async deleteShowcase(showcaseId: string): Promise<DbResult<null>> {
    try {
      await this.db.showcase.delete({ where: { id: showcaseId } });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getShowcaseReviews(showcaseId: string, options?: QueryOptions): Promise<DbListResult<ShowcaseReview>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.ShowcaseReviewWhereInput = { showcase_id: showcaseId };
      const [rows, count] = await Promise.all([
        this.db.showcaseReview.findMany({
          where,
          include: { author: true },
          skip,
          take,
          orderBy: orderBy ?? { created_at: 'desc' },
        }),
        this.db.showcaseReview.count({ where }),
      ]);
      return { data: rows.map(mapShowcaseReview), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async createShowcaseReview(data: Partial<ShowcaseReview>): Promise<DbResult<ShowcaseReview>> {
    try {
      const row = await this.db.showcaseReview.create({
        data: {
          showcase_id: data.showcase_id!,
          author_id: data.author_id!,
          content: data.content!,
          rating: data.rating!,
        },
        include: { author: true },
      });

      // Update showcase aggregate fields
      const agg = await this.db.showcaseReview.aggregate({
        where: { showcase_id: data.showcase_id! },
        _avg: { rating: true },
        _count: { id: true },
      });
      await this.db.showcase.update({
        where: { id: data.showcase_id! },
        data: {
          review_count: agg._count.id,
          average_rating: agg._avg.rating ?? 0,
        },
      });

      return { data: mapShowcaseReview(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getShowcaseTags(): Promise<DbListResult<ShowcaseTag>> {
    try {
      const rows = await this.db.showcaseTag.findMany({ orderBy: { name: 'asc' } });
      return { data: rows.map(mapShowcaseTag), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  // ==========================================================
  // Follows
  // ==========================================================

  async followUser(followerId: string, followingId: string): Promise<DbResult<Follow>> {
    try {
      const row = await this.db.follow.create({
        data: { follower_id: followerId, following_id: followingId },
      });
      return { data: mapFollow(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async unfollowUser(followerId: string, followingId: string): Promise<DbResult<null>> {
    try {
      await this.db.follow.delete({
        where: {
          follower_id_following_id: { follower_id: followerId, following_id: followingId },
        },
      });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getFollowers(userId: string, options?: QueryOptions): Promise<DbListResult<Profile>> {
    try {
      const { skip, take } = buildQueryArgs(options);
      const where: Prisma.FollowWhereInput = { following_id: userId };
      const [rows, count] = await Promise.all([
        this.db.follow.findMany({
          where,
          include: { follower: true },
          skip,
          take,
          orderBy: { created_at: 'desc' },
        }),
        this.db.follow.count({ where }),
      ]);
      return { data: rows.map((r) => mapProfile(r.follower)), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async getFollowing(userId: string, options?: QueryOptions): Promise<DbListResult<Profile>> {
    try {
      const { skip, take } = buildQueryArgs(options);
      const where: Prisma.FollowWhereInput = { follower_id: userId };
      const [rows, count] = await Promise.all([
        this.db.follow.findMany({
          where,
          include: { following: true },
          skip,
          take,
          orderBy: { created_at: 'desc' },
        }),
        this.db.follow.count({ where }),
      ]);
      return { data: rows.map((r) => mapProfile(r.following)), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    try {
      const row = await this.db.follow.findUnique({
        where: {
          follower_id_following_id: { follower_id: followerId, following_id: followingId },
        },
      });
      return !!row;
    } catch {
      return false;
    }
  }

  // ==========================================================
  // Live Sessions
  // ==========================================================

  async getLiveSession(): Promise<DbResult<LiveSession>> {
    try {
      // Get the most recent active or scheduled session
      const row = await this.db.liveSession.findFirst({
        where: { status: { in: ['live', 'idle'] } },
        orderBy: { created_at: 'desc' },
      });
      return { data: row ? mapLiveSession(row) : null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async createLiveSession(data: Partial<LiveSession>): Promise<DbResult<LiveSession>> {
    try {
      const row = await this.db.liveSession.create({
        data: {
          title: data.title ?? 'Live Session',
          description: data.description ?? null,
          youtube_embed_url: data.youtube_embed_url ?? null,
          scheduled_at: data.scheduled_at ? new Date(data.scheduled_at) : null,
          status: (data.status as any) ?? 'idle',
          started_at: data.started_at ? new Date(data.started_at) : null,
          created_by: data.created_by ?? null,
        },
      });
      return { data: mapLiveSession(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateLiveSession(sessionId: string, data: Partial<LiveSession>): Promise<DbResult<LiveSession>> {
    try {
      const row = await this.db.liveSession.update({
        where: { id: sessionId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.youtube_embed_url !== undefined && { youtube_embed_url: data.youtube_embed_url }),
          ...(data.scheduled_at !== undefined && { scheduled_at: data.scheduled_at ? new Date(data.scheduled_at) : null }),
          ...(data.status !== undefined && { status: data.status as any }),
          ...(data.started_at !== undefined && { started_at: data.started_at ? new Date(data.started_at) : null }),
          ...(data.ended_at !== undefined && { ended_at: data.ended_at ? new Date(data.ended_at) : null }),
        },
      });
      return { data: mapLiveSession(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getLiveSessionMessages(
    sessionId: string,
    options?: QueryOptions
  ): Promise<DbListResult<LiveSessionMessage>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.LiveSessionMessageWhereInput = { session_id: sessionId };
      const [rows, count] = await Promise.all([
        this.db.liveSessionMessage.findMany({
          where,
          include: { user: true },
          skip,
          take,
          orderBy: orderBy ?? { created_at: 'asc' },
        }),
        this.db.liveSessionMessage.count({ where }),
      ]);
      return { data: rows.map(mapLiveSessionMessage), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async sendLiveMessage(
    sessionId: string,
    userId: string,
    content: string
  ): Promise<DbResult<LiveSessionMessage>> {
    try {
      const row = await this.db.liveSessionMessage.create({
        data: { session_id: sessionId, user_id: userId, content },
        include: { user: true },
      });
      return { data: mapLiveSessionMessage(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Modules (Learn Mode)
  // ==========================================================

  async getModules(groupId: string): Promise<DbListResult<Module>> {
    try {
      const rows = await this.db.module.findMany({
        where: { group_id: groupId },
        orderBy: { display_order: 'asc' },
      });
      return { data: rows.map(mapModule), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async createModule(data: Partial<Module>): Promise<DbResult<Module>> {
    try {
      const row = await this.db.module.create({
        data: {
          group_id: data.group_id!,
          title: data.title!,
          description: data.description ?? null,
          thumbnail_url: data.thumbnail_url ?? null,
          display_order: data.display_order ?? 0,
          created_by: data.created_by!,
        },
      });
      return { data: mapModule(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateModule(moduleId: string, data: Partial<Module>): Promise<DbResult<Module>> {
    try {
      const row = await this.db.module.update({
        where: { id: moduleId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.thumbnail_url !== undefined && { thumbnail_url: data.thumbnail_url }),
          ...(data.display_order !== undefined && { display_order: data.display_order }),
        },
      });
      return { data: mapModule(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async deleteModule(moduleId: string): Promise<DbResult<null>> {
    try {
      await this.db.module.delete({ where: { id: moduleId } });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getRecordings(groupId: string, moduleId?: string): Promise<DbListResult<Recording>> {
    try {
      const where: Prisma.RecordingWhereInput = { group_id: groupId };
      if (moduleId) where.module_id = moduleId;

      const rows = await this.db.recording.findMany({
        where,
        orderBy: { display_order: 'asc' },
      });
      return { data: rows.map(mapRecording), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async createRecording(data: Partial<Recording>): Promise<DbResult<Recording>> {
    try {
      const row = await this.db.recording.create({
        data: {
          group_id: data.group_id!,
          module_id: data.module_id ?? null,
          title: data.title!,
          description: data.description ?? null,
          video_url: data.video_url!,
          video_platform: data.video_platform!,
          video_id: data.video_id!,
          thumbnail_url: data.thumbnail_url ?? null,
          display_order: data.display_order ?? 0,
          published_by: data.published_by!,
        },
      });
      return { data: mapRecording(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateRecording(recordingId: string, data: Partial<Recording>): Promise<DbResult<Recording>> {
    try {
      const row = await this.db.recording.update({
        where: { id: recordingId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.video_url !== undefined && { video_url: data.video_url }),
          ...(data.video_platform !== undefined && { video_platform: data.video_platform }),
          ...(data.video_id !== undefined && { video_id: data.video_id }),
          ...(data.thumbnail_url !== undefined && { thumbnail_url: data.thumbnail_url }),
          ...(data.display_order !== undefined && { display_order: data.display_order }),
          ...(data.module_id !== undefined && { module_id: data.module_id }),
        },
      });
      return { data: mapRecording(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async deleteRecording(recordingId: string): Promise<DbResult<null>> {
    try {
      await this.db.recording.delete({ where: { id: recordingId } });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getLessonCompletions(userId: string, moduleId: string): Promise<DbListResult<LessonCompletion>> {
    try {
      const rows = await this.db.lessonCompletion.findMany({
        where: { user_id: userId, module_id: moduleId },
      });
      return { data: rows.map(mapLessonCompletion), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async completelesson(
    userId: string,
    recordingId: string,
    moduleId: string
  ): Promise<DbResult<LessonCompletion>> {
    try {
      const row = await this.db.lessonCompletion.upsert({
        where: { user_id_recording_id: { user_id: userId, recording_id: recordingId } },
        create: { user_id: userId, recording_id: recordingId, module_id: moduleId },
        update: {}, // Already completed, no-op
      });
      return { data: mapLessonCompletion(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Feature Requests
  // ==========================================================

  async getFeatureRequests(
    options?: QueryOptions & { status?: FeatureRequestStatus }
  ): Promise<DbListResult<FeatureRequest>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.FeatureRequestWhereInput = {};
      if (options?.status) where.status = options.status;

      const [rows, count] = await Promise.all([
        this.db.featureRequest.findMany({
          where,
          include: { author: true },
          skip,
          take,
          orderBy: orderBy ?? { vote_count: 'desc' },
        }),
        this.db.featureRequest.count({ where }),
      ]);
      return { data: rows.map(mapFeatureRequest), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async createFeatureRequest(data: Partial<FeatureRequest>): Promise<DbResult<FeatureRequest>> {
    try {
      const row = await this.db.featureRequest.create({
        data: {
          title: data.title!,
          description: data.description!,
          author_id: data.author_id!,
          status: data.status ?? 'pending',
        },
        include: { author: true },
      });
      return { data: mapFeatureRequest(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateFeatureRequest(
    requestId: string,
    data: Partial<FeatureRequest>
  ): Promise<DbResult<FeatureRequest>> {
    try {
      const row = await this.db.featureRequest.update({
        where: { id: requestId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.status !== undefined && { status: data.status }),
        },
        include: { author: true },
      });
      return { data: mapFeatureRequest(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async voteFeatureRequest(
    requestId: string,
    userId: string
  ): Promise<DbResult<{ voted: boolean }>> {
    try {
      const existing = await this.db.featureRequestVote.findUnique({
        where: { request_id_user_id: { request_id: requestId, user_id: userId } },
      });

      if (existing) {
        // Remove vote
        await this.db.featureRequestVote.delete({ where: { id: existing.id } });
        await this.db.featureRequest.update({
          where: { id: requestId },
          data: { vote_count: { decrement: 1 } },
        });
        return { data: { voted: false }, error: null };
      } else {
        // Add vote
        await this.db.featureRequestVote.create({
          data: { request_id: requestId, user_id: userId },
        });
        await this.db.featureRequest.update({
          where: { id: requestId },
          data: { vote_count: { increment: 1 } },
        });
        return { data: { voted: true }, error: null };
      }
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Activations
  // ==========================================================

  async getActivationProducts(): Promise<DbListResult<ActivationProduct>> {
    try {
      const rows = await this.db.activationProduct.findMany({
        where: { is_active: true },
        orderBy: { name: 'asc' },
      });
      return { data: rows.map(mapActivationProduct), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async createActivationRequest(data: Partial<ActivationRequest>): Promise<DbResult<ActivationRequest>> {
    try {
      const row = await this.db.activationRequest.create({
        data: {
          user_id: data.user_id!,
          product_id: data.product_id!,
          website_url: data.website_url!,
          wp_username: data.wp_username!,
          wp_password: data.wp_password!,
          notes: data.notes ?? null,
          status: data.status ?? 'pending',
        },
      });
      return { data: mapActivationRequest(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getActivationRequests(
    userId?: string,
    status?: ActivationRequestStatus
  ): Promise<DbListResult<ActivationRequest>> {
    try {
      const where: Prisma.ActivationRequestWhereInput = {};
      if (userId) where.user_id = userId;
      if (status) where.status = status;

      const rows = await this.db.activationRequest.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
      return { data: rows.map(mapActivationRequest), error: null, count: rows.length };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  async processActivationRequest(
    requestId: string,
    approved: boolean,
    adminNotes?: string
  ): Promise<DbResult<ActivationRequest>> {
    try {
      const row = await this.db.activationRequest.update({
        where: { id: requestId },
        data: {
          status: approved ? 'completed' : 'rejected',
          admin_notes: adminNotes ?? null,
          processed_at: new Date(),
        },
      });
      return { data: mapActivationRequest(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  // ==========================================================
  // Admin
  // ==========================================================

  async getAdminStats(): Promise<
    DbResult<{
      total_users: number;
      total_posts: number;
      total_comments: number;
      total_groups: number;
      total_events: number;
    }>
  > {
    try {
      const [total_users, total_posts, total_comments, total_groups, total_events] =
        await Promise.all([
          this.db.profile.count(),
          this.db.post.count(),
          this.db.comment.count(),
          this.db.group.count(),
          this.db.event.count(),
        ]);
      return {
        data: { total_users, total_posts, total_comments, total_groups, total_events },
        error: null,
      };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async banUser(
    targetId: string,
    adminId: string,
    reason: string,
    duration?: string
  ): Promise<DbResult<null>> {
    try {
      let banExpiresAt: Date | null = null;
      if (duration) {
        const now = new Date();
        const durationMap: Record<string, number> = {
          '1h': 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000,
        };
        const ms = durationMap[duration];
        if (ms) {
          banExpiresAt = new Date(now.getTime() + ms);
        }
        // 'permanent' or unknown durations leave banExpiresAt as null
      }

      await this.db.profile.update({
        where: { id: targetId },
        data: {
          is_banned: true,
          ban_reason: reason,
          banned_by: adminId,
          banned_at: new Date(),
          ban_expires_at: banExpiresAt,
        },
      });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async unbanUser(targetId: string, _adminId: string): Promise<DbResult<null>> {
    try {
      await this.db.profile.update({
        where: { id: targetId },
        data: {
          is_banned: false,
          ban_reason: null,
          banned_by: null,
          banned_at: null,
          ban_expires_at: null,
        },
      });
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async updateUserRole(userId: string, role: UserRole): Promise<DbResult<Profile>> {
    try {
      const row = await this.db.profile.update({
        where: { id: userId },
        data: { role },
      });
      return { data: mapProfile(row), error: null };
    } catch (err) {
      return { data: null, error: toDbError(err) };
    }
  }

  async getAllUsers(
    options?: QueryOptions & { role?: UserRole; search?: string }
  ): Promise<DbListResult<Profile>> {
    try {
      const { skip, take, orderBy } = buildQueryArgs(options);
      const where: Prisma.ProfileWhereInput = {};
      if (options?.role) where.role = options.role;
      if (options?.search) {
        where.OR = [
          { username: { contains: options.search, mode: 'insensitive' } },
          { display_name: { contains: options.search, mode: 'insensitive' } },
          { email: { contains: options.search, mode: 'insensitive' } },
        ];
      }

      const [rows, count] = await Promise.all([
        this.db.profile.findMany({
          where,
          skip,
          take,
          orderBy: orderBy ?? { created_at: 'desc' },
        }),
        this.db.profile.count({ where }),
      ]);
      return { data: rows.map(mapProfile), error: null, count };
    } catch (err) {
      return { data: [], error: toDbError(err) };
    }
  }

  // ==========================================================
  // Access Control
  // ==========================================================

  async hasPremiumAccess(userId: string): Promise<boolean> {
    try {
      const profile = await this.db.profile.findUnique({
        where: { id: userId },
        select: { membership_type: true, role: true },
      });
      if (!profile) return false;
      // Admins and superadmins always have premium access
      if (profile.role === 'admin' || profile.role === 'superadmin') return true;
      return profile.membership_type === 'premium';
    } catch {
      return false;
    }
  }

  async canAccessGroup(userId: string, groupId: string): Promise<boolean> {
    try {
      const group = await this.db.group.findUnique({
        where: { id: groupId },
        select: { is_private: true, is_premium: true },
      });
      if (!group) return false;

      // Public non-premium groups are accessible to all
      if (!group.is_private && !group.is_premium) return true;

      // Check membership
      const member = await this.db.groupMember.findUnique({
        where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      });
      if (member) return true;

      // Check admin/superadmin role (they can access everything)
      const profile = await this.db.profile.findUnique({
        where: { id: userId },
        select: { role: true, membership_type: true },
      });
      if (!profile) return false;
      if (profile.role === 'admin' || profile.role === 'superadmin') return true;

      // Premium groups require premium membership
      if (group.is_premium && profile.membership_type !== 'premium') return false;

      // Private groups require membership (already checked above)
      if (group.is_private) return false;

      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================
  // Realtime
  // ==========================================================

  subscribeToTable(
    _table: string,
    _filter: Record<string, string>,
    _callback: RealtimeCallback
  ): RealtimeSubscription {
    // TODO: Implement realtime via MongoDB Change Streams + WebSocket layer.
    // MongoDB supports Change Streams on replica sets which can be used to
    // push real-time updates to clients. For now, return a no-op subscription.
    // Consider using:
    //   1. MongoDB Change Streams (requires replica set or Atlas)
    //   2. A WebSocket server (e.g., Socket.IO) to broadcast changes
    //   3. Server-Sent Events (SSE) as a simpler alternative
    console.warn(
      '[MongoDBAdapter] subscribeToTable is a no-op. Implement Change Streams + WebSocket for realtime.'
    );
    return {
      unsubscribe: () => {
        // no-op
      },
    };
  }

  subscribeToPresence(
    _channelName: string,
    _userId: string,
    _onSync: (presences: Record<string, unknown>) => void
  ): RealtimeSubscription {
    // TODO: Implement presence tracking via WebSocket layer.
    // Options:
    //   1. Socket.IO rooms with presence tracking
    //   2. Redis pub/sub for distributed presence
    //   3. A dedicated presence collection with TTL indexes
    console.warn(
      '[MongoDBAdapter] subscribeToPresence is a no-op. Implement WebSocket presence tracking.'
    );
    return {
      unsubscribe: () => {
        // no-op
      },
    };
  }
}
