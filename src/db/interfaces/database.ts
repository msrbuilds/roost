// ============================================================
// Roost - Database Adapter Interface
// All database backends must implement this interface
// ============================================================

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
} from './types';

// --- Realtime Subscription Types ---
export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';
export type RealtimeCallback<T = unknown> = (
  event: RealtimeEvent,
  payload: { new: T; old: T | null }
) => void;

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

// --- Database Adapter Interface ---
export interface DatabaseAdapter {
  // --- Profiles ---
  getProfile(userId: string): Promise<DbResult<Profile>>;
  getProfileByUsername(username: string): Promise<DbResult<Profile>>;
  updateProfile(userId: string, data: Partial<Profile>): Promise<DbResult<Profile>>;
  searchProfiles(query: string, options?: QueryOptions): Promise<DbListResult<Profile>>;
  getOnlineProfiles(options?: QueryOptions): Promise<DbListResult<Profile>>;

  // --- Groups ---
  getGroup(groupId: string): Promise<DbResult<Group>>;
  getGroupBySlug(slug: string): Promise<DbResult<Group>>;
  getGroups(options?: QueryOptions): Promise<DbListResult<Group>>;
  createGroup(data: Partial<Group>): Promise<DbResult<Group>>;
  updateGroup(groupId: string, data: Partial<Group>): Promise<DbResult<Group>>;
  deleteGroup(groupId: string): Promise<DbResult<null>>;

  // --- Group Members ---
  getGroupMembers(groupId: string, options?: QueryOptions): Promise<DbListResult<GroupMember>>;
  getGroupMember(groupId: string, userId: string): Promise<DbResult<GroupMember>>;
  joinGroup(groupId: string, userId: string): Promise<DbResult<GroupMember>>;
  leaveGroup(groupId: string, userId: string): Promise<DbResult<null>>;
  updateMemberRole(groupId: string, userId: string, role: GroupRole): Promise<DbResult<GroupMember>>;
  getUserGroups(userId: string): Promise<DbListResult<Group>>;
  isGroupMember(groupId: string, userId: string): Promise<boolean>;
  isGroupAdminOrMod(groupId: string, userId: string): Promise<boolean>;

  // --- Categories ---
  getCategories(groupId?: string | null): Promise<DbListResult<Category>>;
  createCategory(data: Partial<Category>): Promise<DbResult<Category>>;
  updateCategory(categoryId: string, data: Partial<Category>): Promise<DbResult<Category>>;
  deleteCategory(categoryId: string): Promise<DbResult<null>>;

  // --- Posts ---
  getPost(postId: string, userId?: string): Promise<DbResult<Post>>;
  getPosts(groupId: string | null, options?: QueryOptions & { categoryId?: string; userId?: string }): Promise<DbListResult<Post>>;
  createPost(data: Partial<Post>): Promise<DbResult<Post>>;
  updatePost(postId: string, data: Partial<Post>): Promise<DbResult<Post>>;
  deletePost(postId: string): Promise<DbResult<null>>;
  pinPost(postId: string, pinned: boolean): Promise<DbResult<Post>>;
  searchPosts(query: string, groupId?: string | null): Promise<DbListResult<Post>>;

  // --- Comments ---
  getComments(postId: string, userId?: string): Promise<DbListResult<Comment>>;
  getRecordingComments(recordingId: string, userId?: string): Promise<DbListResult<Comment>>;
  createComment(data: Partial<Comment>): Promise<DbResult<Comment>>;
  updateComment(commentId: string, content: string): Promise<DbResult<Comment>>;
  deleteComment(commentId: string): Promise<DbResult<null>>;
  toggleCommentVote(userId: string, commentId: string, voteType: 'up' | 'down'): Promise<DbResult<{ vote_count: number }>>;

  // --- Reactions ---
  getReactions(reactableType: ReactableType, reactableId: string): Promise<DbListResult<Reaction>>;
  toggleReaction(
    userId: string,
    reactableType: ReactableType,
    reactableId: string,
    reactionType: ReactionType
  ): Promise<DbResult<{ added: boolean }>>;
  getReactionCounts(reactableType: ReactableType, reactableId: string): Promise<DbResult<Record<ReactionType, number>>>;
  getUserReaction(userId: string, reactableType: ReactableType, reactableId: string): Promise<DbResult<ReactionType | null>>;

  // --- Messages ---
  getConversations(userId: string): Promise<DbListResult<Message & { other_user: Profile; unread_count: number }>>;
  getMessages(userId: string, otherUserId: string, options?: QueryOptions): Promise<DbListResult<Message>>;
  sendMessage(senderId: string, recipientId: string, content: string): Promise<DbResult<Message>>;
  markMessageRead(messageId: string): Promise<DbResult<null>>;
  markAllMessagesRead(userId: string, otherUserId: string): Promise<DbResult<null>>;
  getUnreadMessageCount(userId: string): Promise<DbResult<number>>;

  // --- Assets ---
  createAsset(data: Partial<Asset>): Promise<DbResult<Asset>>;
  getPostAssets(postId: string): Promise<DbListResult<Asset>>;
  getMessageAssets(messageId: string): Promise<DbListResult<Asset>>;
  deleteAsset(assetId: string): Promise<DbResult<null>>;

  // --- Notifications ---
  getNotifications(userId: string, options?: QueryOptions): Promise<DbListResult<Notification>>;
  getUnreadNotificationCount(userId: string): Promise<DbResult<number>>;
  markNotificationRead(notificationId: string): Promise<DbResult<null>>;
  markAllNotificationsRead(userId: string): Promise<DbResult<null>>;
  createNotification(data: Partial<Notification>): Promise<DbResult<Notification>>;
  getNotificationPreferences(userId: string): Promise<DbResult<NotificationPreferences>>;
  updateNotificationPreferences(userId: string, data: Partial<NotificationPreferences>): Promise<DbResult<NotificationPreferences>>;

  // --- Leaderboard ---
  getLeaderboard(period: string, groupId?: string | null, options?: QueryOptions): Promise<DbListResult<LeaderboardEntry>>;
  getUserRank(userId: string, period: string, groupId?: string | null): Promise<DbResult<{ rank: number; points: number }>>;
  getPointActivities(userId: string, options?: QueryOptions): Promise<DbListResult<PointActivity>>;

  // --- Events ---
  getEvents(groupId?: string, options?: QueryOptions): Promise<DbListResult<Event>>;
  getEvent(eventId: string, userId?: string): Promise<DbResult<Event>>;
  createEvent(data: Partial<Event>): Promise<DbResult<Event>>;
  updateEvent(eventId: string, data: Partial<Event>): Promise<DbResult<Event>>;
  deleteEvent(eventId: string): Promise<DbResult<null>>;
  rsvpEvent(eventId: string, userId: string, status: RsvpStatus): Promise<DbResult<EventAttendee>>;
  getEventAttendees(eventId: string): Promise<DbListResult<EventAttendee>>;

  // --- Announcements ---
  getActiveAnnouncements(userId: string, groupId?: string | null): Promise<DbListResult<Announcement>>;
  createAnnouncement(data: Partial<Announcement>): Promise<DbResult<Announcement>>;
  updateAnnouncement(announcementId: string, data: Partial<Announcement>): Promise<DbResult<Announcement>>;
  deleteAnnouncement(announcementId: string): Promise<DbResult<null>>;
  dismissAnnouncement(announcementId: string, userId: string): Promise<DbResult<null>>;

  // --- Showcases ---
  getShowcases(options?: QueryOptions & { status?: ShowcaseStatus; category?: string }): Promise<DbListResult<Showcase>>;
  getShowcase(showcaseId: string): Promise<DbResult<Showcase>>;
  createShowcase(data: Partial<Showcase>, images?: Partial<ShowcaseImage>[]): Promise<DbResult<Showcase>>;
  updateShowcase(showcaseId: string, data: Partial<Showcase>): Promise<DbResult<Showcase>>;
  deleteShowcase(showcaseId: string): Promise<DbResult<null>>;
  getShowcaseReviews(showcaseId: string, options?: QueryOptions): Promise<DbListResult<ShowcaseReview>>;
  createShowcaseReview(data: Partial<ShowcaseReview>): Promise<DbResult<ShowcaseReview>>;
  getShowcaseTags(): Promise<DbListResult<ShowcaseTag>>;

  // --- Follows ---
  followUser(followerId: string, followingId: string): Promise<DbResult<Follow>>;
  unfollowUser(followerId: string, followingId: string): Promise<DbResult<null>>;
  getFollowers(userId: string, options?: QueryOptions): Promise<DbListResult<Profile>>;
  getFollowing(userId: string, options?: QueryOptions): Promise<DbListResult<Profile>>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;

  // --- Live Sessions ---
  getLiveSession(): Promise<DbResult<LiveSession>>;
  createLiveSession(data: Partial<LiveSession>): Promise<DbResult<LiveSession>>;
  updateLiveSession(sessionId: string, data: Partial<LiveSession>): Promise<DbResult<LiveSession>>;
  getLiveSessionMessages(sessionId: string, options?: QueryOptions): Promise<DbListResult<LiveSessionMessage>>;
  sendLiveMessage(sessionId: string, userId: string, content: string): Promise<DbResult<LiveSessionMessage>>;

  // --- Modules (Learn Mode) ---
  getModules(groupId: string): Promise<DbListResult<Module>>;
  createModule(data: Partial<Module>): Promise<DbResult<Module>>;
  updateModule(moduleId: string, data: Partial<Module>): Promise<DbResult<Module>>;
  deleteModule(moduleId: string): Promise<DbResult<null>>;
  getRecordings(groupId: string, moduleId?: string): Promise<DbListResult<Recording>>;
  createRecording(data: Partial<Recording>): Promise<DbResult<Recording>>;
  updateRecording(recordingId: string, data: Partial<Recording>): Promise<DbResult<Recording>>;
  deleteRecording(recordingId: string): Promise<DbResult<null>>;
  getLessonCompletions(userId: string, moduleId: string): Promise<DbListResult<LessonCompletion>>;
  completelesson(userId: string, recordingId: string, moduleId: string): Promise<DbResult<LessonCompletion>>;

  // --- Feature Requests ---
  getFeatureRequests(options?: QueryOptions & { status?: FeatureRequestStatus }): Promise<DbListResult<FeatureRequest>>;
  createFeatureRequest(data: Partial<FeatureRequest>): Promise<DbResult<FeatureRequest>>;
  updateFeatureRequest(requestId: string, data: Partial<FeatureRequest>): Promise<DbResult<FeatureRequest>>;
  voteFeatureRequest(requestId: string, userId: string): Promise<DbResult<{ voted: boolean }>>;

  // --- Activations ---
  getActivationProducts(): Promise<DbListResult<ActivationProduct>>;
  createActivationRequest(data: Partial<ActivationRequest>): Promise<DbResult<ActivationRequest>>;
  getActivationRequests(userId?: string, status?: ActivationRequestStatus): Promise<DbListResult<ActivationRequest>>;
  processActivationRequest(requestId: string, approved: boolean, adminNotes?: string): Promise<DbResult<ActivationRequest>>;

  // --- Admin ---
  getAdminStats(): Promise<DbResult<{
    total_users: number;
    total_posts: number;
    total_comments: number;
    total_groups: number;
    total_events: number;
  }>>;
  banUser(targetId: string, adminId: string, reason: string, duration?: string): Promise<DbResult<null>>;
  unbanUser(targetId: string, adminId: string): Promise<DbResult<null>>;
  updateUserRole(userId: string, role: UserRole): Promise<DbResult<Profile>>;
  getAllUsers(options?: QueryOptions & { role?: UserRole; search?: string }): Promise<DbListResult<Profile>>;

  // --- Access Control ---
  hasPremiumAccess(userId: string): Promise<boolean>;
  canAccessGroup(userId: string, groupId: string): Promise<boolean>;

  // --- Realtime ---
  subscribeToTable(
    table: string,
    filter: Record<string, string>,
    callback: RealtimeCallback
  ): RealtimeSubscription;
  subscribeToPresence(
    channelName: string,
    userId: string,
    onSync: (presences: Record<string, unknown>) => void
  ): RealtimeSubscription;
}
