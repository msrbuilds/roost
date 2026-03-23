// ============================================================
// Roost - Database Interface Types
// All database adapters must work with these types
// ============================================================

// --- Enums ---
export type GroupRole = 'admin' | 'moderator' | 'member';
export type UserRole = 'user' | 'moderator' | 'admin' | 'superadmin';
export type ReactionType = 'like' | 'love' | 'fire' | 'clap' | 'think' | 'haha';
export type ReactableType = 'post' | 'comment' | 'showcase';
export type AssetType = 'image' | 'video' | 'document' | 'other';
export type NotificationType =
  | 'new_comment'
  | 'new_reaction'
  | 'new_message'
  | 'new_follower'
  | 'mention'
  | 'group_invite'
  | 'group_join'
  | 'event_reminder'
  | 'comment_reply';
export type RsvpStatus = 'going' | 'maybe' | 'not_going';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'failed_payment' | 'refunded';
export type AnnouncementType = 'info' | 'warning' | 'success' | 'error';
export type AnnouncementScope = 'global' | 'group';
export type ShowcaseStatus = 'pending' | 'approved' | 'rejected' | 'featured';
export type ShowcaseCategory =
  | 'web_app'
  | 'mobile_app'
  | 'saas'
  | 'tool'
  | 'api'
  | 'website'
  | 'game'
  | 'extension'
  | 'other';
export type PointActionType =
  | 'post_created'
  | 'comment_created'
  | 'reaction_given'
  | 'reaction_received'
  | 'event_attended'
  | 'daily_login'
  | 'profile_completed'
  | 'manual_adjustment';
export type ActivationRequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';
export type FeatureRequestStatus = 'pending' | 'approved' | 'completed' | 'rejected';
export type MembershipType = 'free' | 'premium';
export type LiveSessionStatus = 'idle' | 'live' | 'ended';
export type VideoPlatform = 'youtube' | 'vimeo';

// --- Base Entity ---
export interface BaseEntity {
  id: string;
  created_at: string;
}

// --- Profiles ---
export interface Profile extends BaseEntity {
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  is_online: boolean;
  last_seen_at: string;
  role: UserRole;
  is_banned: boolean;
  ban_reason: string | null;
  ban_expires_at: string | null;
  banned_by: string | null;
  banned_at: string | null;
  membership_type: MembershipType;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  two_factor_verified_at: string | null;
  updated_at: string;
}

// --- Groups ---
export interface Group extends BaseEntity {
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_private: boolean;
  is_premium: boolean;
  layout_mode: 'default' | 'sidebar' | 'learn';
  created_by: string;
  updated_at: string;
}

// --- Group Members ---
export interface GroupMember extends BaseEntity {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  // Joined relations
  profile?: Profile;
}

// --- Categories ---
export interface Category extends BaseEntity {
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  group_id: string | null;
  display_order: number;
  is_active: boolean;
}

// --- Posts ---
export interface Post extends BaseEntity {
  title: string | null;
  content: string;
  author_id: string;
  group_id: string | null;
  category_id: string | null;
  is_pinned: boolean;
  is_edited: boolean;
  updated_at: string;
  // Joined relations
  author?: Profile;
  category?: Category;
  assets?: Asset[];
  reaction_counts?: Record<ReactionType, number>;
  user_reaction?: ReactionType | null;
  comment_count?: number;
}

// --- Comments ---
export interface Comment extends BaseEntity {
  post_id: string | null;
  recording_id: string | null;
  author_id: string;
  content: string;
  parent_comment_id: string | null;
  is_edited: boolean;
  updated_at: string;
  // Joined relations
  author?: Profile;
  replies?: Comment[];
  vote_count?: number;
  user_vote?: 'up' | 'down' | null;
}

// --- Reactions ---
export interface Reaction extends BaseEntity {
  user_id: string;
  reactable_type: ReactableType;
  reactable_id: string;
  reaction_type: ReactionType;
}

// --- Messages ---
export interface Message extends BaseEntity {
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  // Joined relations
  sender?: Profile;
  recipient?: Profile;
  assets?: Asset[];
}

// --- Assets ---
export interface Asset extends BaseEntity {
  filename: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  asset_type: AssetType;
  uploaded_by: string;
  post_id: string | null;
  message_id: string | null;
}

// --- Notifications ---
export interface Notification extends BaseEntity {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  email_pending: boolean;
  email_sent_at: string | null;
}

// --- Leaderboard ---
export interface LeaderboardEntry extends BaseEntity {
  user_id: string;
  group_id: string | null;
  points: number;
  period_start: string;
  period_end: string;
  updated_at: string;
  // Joined
  profile?: Profile;
}

export interface PointActivity extends BaseEntity {
  user_id: string;
  group_id: string | null;
  action_type: PointActionType;
  points: number;
  description: string | null;
  reference_id: string | null;
}

// --- Events ---
export interface Event extends BaseEntity {
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  is_virtual: boolean;
  meeting_url: string | null;
  group_id: string;
  created_by: string;
  updated_at: string;
  // Joined
  creator?: Profile;
  group?: Group;
  attendee_count?: number;
  user_rsvp?: RsvpStatus | null;
}

export interface EventAttendee extends BaseEntity {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  updated_at: string;
  // Joined
  profile?: Profile;
}

// --- Announcements ---
export interface Announcement extends BaseEntity {
  title: string;
  content: string;
  type: AnnouncementType;
  scope: AnnouncementScope;
  group_id: string | null;
  is_active: boolean;
  is_dismissible: boolean;
  starts_at: string;
  expires_at: string | null;
  created_by: string;
  updated_at: string;
}

// --- Showcases ---
export interface Showcase extends BaseEntity {
  title: string;
  tagline: string;
  description: string;
  url: string;
  thumbnail_url: string | null;
  category: ShowcaseCategory;
  tech_stack: string[];
  author_id: string;
  status: ShowcaseStatus;
  moderation_notes: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  launch_date: string | null;
  is_featured: boolean;
  featured_at: string | null;
  vote_count: number;
  review_count: number;
  average_rating: number;
  updated_at: string;
  // Joined
  author?: Profile;
  images?: ShowcaseImage[];
  tags?: ShowcaseTag[];
}

export interface ShowcaseImage extends BaseEntity {
  showcase_id: string;
  image_url: string;
  display_order: number;
  caption: string | null;
}

export interface ShowcaseTag extends BaseEntity {
  name: string;
  slug: string;
  color: string;
}

export interface ShowcaseReview extends BaseEntity {
  showcase_id: string;
  author_id: string;
  content: string;
  rating: number;
  maker_reply: string | null;
  maker_replied_at: string | null;
  is_edited: boolean;
  updated_at: string;
  // Joined
  author?: Profile;
}

// --- Follows ---
export interface Follow extends BaseEntity {
  follower_id: string;
  following_id: string;
}

// --- Live Sessions ---
export interface LiveSession extends BaseEntity {
  title: string;
  description: string | null;
  youtube_embed_url: string | null;
  scheduled_at: string | null;
  status: LiveSessionStatus;
  started_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  updated_at: string;
}

export interface LiveSessionMessage extends BaseEntity {
  session_id: string;
  user_id: string;
  content: string;
  // Joined
  user?: Profile;
}

// --- Modules (Learn Mode) ---
export interface Module extends BaseEntity {
  group_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  display_order: number;
  created_by: string;
  updated_at: string;
}

export interface Recording extends BaseEntity {
  group_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  video_url: string;
  video_platform: VideoPlatform;
  video_id: string;
  thumbnail_url: string | null;
  display_order: number;
  published_by: string;
}

export interface LessonCompletion extends BaseEntity {
  user_id: string;
  recording_id: string;
  module_id: string;
  completed_at: string;
}

// --- Feature Requests ---
export interface FeatureRequest extends BaseEntity {
  title: string;
  description: string;
  author_id: string;
  status: FeatureRequestStatus;
  vote_count: number;
  updated_at: string;
  // Joined
  author?: Profile;
  user_voted?: boolean;
}

// --- Notification Preferences ---
export interface NotificationPreferences extends BaseEntity {
  user_id: string;
  notify_comments: boolean;
  notify_replies: boolean;
  notify_mentions: boolean;
  notify_messages: boolean;
  notify_reactions: boolean;
  email_comments: boolean;
  email_replies: boolean;
  email_mentions: boolean;
  email_messages: boolean;
  email_announcements: boolean;
  updated_at: string;
}

// --- Activation Products ---
export interface ActivationProduct extends BaseEntity {
  name: string;
  slug: string;
  description: string | null;
  product_type: string;
  monthly_limit: number;
  is_active: boolean;
  icon_url: string | null;
  instructions: string | null;
  updated_at: string;
}

export interface ActivationRequest extends BaseEntity {
  user_id: string;
  product_id: string;
  status: ActivationRequestStatus;
  website_url: string;
  wp_username: string;
  wp_password: string;
  notes: string | null;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  updated_at: string;
}

// --- Query Options ---
export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryOptions {
  pagination?: PaginationOptions;
  sort?: SortOptions;
  filters?: Record<string, unknown>;
}

// --- Database Result ---
export interface DbResult<T> {
  data: T | null;
  error: DbError | null;
}

export interface DbListResult<T> {
  data: T[];
  error: DbError | null;
  count?: number;
}

export interface DbError {
  message: string;
  code?: string;
  details?: string;
}
