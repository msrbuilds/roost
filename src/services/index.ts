// Re-export all services for easy importing
export { supabase, auth, db, realtime, getCurrentUser, getCurrentSession } from './supabase';
export { default as s3, uploadFile, uploadImage, uploadAvatar, uploadVideo, uploadDocument, deleteFile, getPublicUrl, getSignedDownloadUrl, getAssetType } from './s3';
export {
    getProfile,
    getProfileByUsername,
    updateProfile,
    isUsernameAvailable,
    updateOnlineStatus,
    getOnlineUsersCount,
    getMembersCount,
    isValidUsername,
    isValidWebsite,
} from './profile';
export {
    getPosts,
    getPostById,
    createPost,
    updatePost,
    deletePost,
    togglePinPost,
    getCategories,
} from './post';
export type { PostWithDetails, GetPostsOptions } from './post';
export {
    getComments,
    createComment,
    updateComment,
    deleteComment,
    getCommentCount,
    getRecordingComments,
    createRecordingComment,
    getRecordingCommentCount,
} from './comment';
export type { CommentWithAuthor } from './comment';
export {
    toggleReaction,
    getReactionCounts,
    getUserReaction,
    getUserReactionsForItems,
    getReactors,
} from './reaction';
export type { ReactableType, ReactionCounts, ReactorInfo } from './reaction';
export {
    createAsset,
    linkAssetsToPost,
    getPostAssets,
    linkAssetsToFeatureRequest,
    getFeatureRequestAssets,
    deleteAssetRecord,
} from './asset';
export type { Asset, AssetInsert } from './asset';
export {
    getGroups,
    getGroupBySlug,
    getGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    joinGroup,
    leaveGroup,
    getGroupMembers,
    updateMemberRole,
    removeMember,
    checkMembership,
    getMemberCount,
    getUserGroups,
    generateSlug,
    isSlugAvailable,
    hasPermission,
} from './group';
export type { GroupWithDetails, GroupMemberWithProfile, GetGroupsOptions } from './group';
export {
    getConversations,
    getConversationMessages,
    sendMessage,
    markConversationAsRead,
    getUnreadMessageCount,
    getMessageById,
    deleteMessage,
    searchUsers,
} from './message';
export type { MessageWithSender, Conversation } from './message';
export {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getUnreadNotificationCount,
    getNotificationIconInfo,
} from './notification';
export {
    getGlobalLeaderboard,
    getGroupLeaderboard,
    getUserRank,
    getUserPointActivities,
    adjustUserPoints,
    getLeaderboardStats,
    getTopUsers,
    subscribeToLeaderboardChanges,
} from './leaderboard';
export type { LeaderboardRank, LeaderboardStats, UserRankInfo } from '../types';
export {
    getEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    rsvpToEvent,
    getEventAttendees,
    getAttendeeCounts,
    getUserRSVP,
    getUserEvents,
    getEventsInRange,
    getUpcomingEvents,
    subscribeToEventChanges,
    subscribeToEventRSVPs,
} from './event';
export type { EventWithDetails, CalendarEvent } from '../types';
export {
    // User Management
    getUsers,
    banUser,
    unbanUser,
    updateUserRole,
    updateMembershipType,
    checkIsAdmin,
    checkIsSuperadmin,
    // Content Moderation
    getPostsForModeration,
    deletePostAsAdmin,
    getCommentsForModeration,
    deleteCommentAsAdmin,
    // Category Management
    getCategories as getAdminCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    // Announcements
    getAnnouncements,
    getActiveAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    dismissAnnouncement,
    getDismissedAnnouncementIds,
    // Analytics
    getDashboardStats,
    getUserGrowth,
    getActivityStats,
    getTopContributors,
    // Types and Constants
    BAN_DURATIONS,
} from './admin';
export type {
    Announcement,
    AnnouncementType,
    AnnouncementScope,
    AdminStats,
    UserGrowthData,
    ActivityStatsData,
    BanDuration,
    UserWithBanInfo,
} from './admin';

// Follow
export {
    toggleFollow,
    isFollowing,
    getFollowedUserIds,
    getFollowStatusForUsers,
    getFollowerCount,
    getFollowingCount,
    getFollowers,
    getFollowing,
} from './follow';

// Showcase
export {
    // CRUD
    createShowcase,
    updateShowcase,
    deleteShowcase,
    getShowcaseById,
    getApprovedShowcases,
    getFeaturedShowcases,
    getUserShowcases,
    // Images
    addShowcaseImage,
    removeShowcaseImage,
    reorderShowcaseImages,
    // Tags
    getAllTags,
    addTagToShowcase,
    removeTagFromShowcase,
    setShowcaseTags,
    // Voting
    voteForShowcase,
    removeVote,
    toggleVote,
    hasUserVoted,
    getUserVotesForShowcases,
    // Reviews
    getShowcaseReviews,
    createReview,
    updateReview,
    deleteReview,
    addMakerReply,
    // Admin
    getShowcasesForModeration,
    approveShowcase,
    rejectShowcase,
    featureShowcase,
    unfeatureShowcase,
    getShowcaseStats,
    // Admin Tags
    createTag,
    updateTag,
    deleteTag,
} from './showcase';

// Comment Votes
export {
    toggleCommentVote,
    getCommentVoteCounts,
    getUserVotesForComments,
} from './commentVote';
export type { VoteType, VoteCounts } from './commentVote';

// Modules (Learn Mode)
export {
    getModulesWithProgress,
    getModuleById,
    createModule,
    updateModule,
    deleteModule,
    reorderModules,
    getModuleRecordings,
    getModuleAssets,
    markLessonComplete,
    markLessonIncomplete,
    getAdjacentRecordings,
    getUserCompletionsForGroup,
    getRecordingById,
} from './module';
