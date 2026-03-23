-- =============================================================================
-- Roost Community Platform - Consolidated Database Schema
-- =============================================================================
-- This is the COMPLETE schema for fresh installations.
-- It represents the final state after all migrations (001-059) and fixes.
-- Run this in Supabase SQL Editor for a new deployment.
--
-- Generated: 2026-03-23
-- Tables: 40+
-- Functions: 30+
-- Triggers: 20+
-- RLS Policies: 80+
-- =============================================================================

-- #############################################################################
-- SECTION 1: EXTENSIONS
-- #############################################################################

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- #############################################################################
-- SECTION 2: ENUM TYPES
-- #############################################################################

-- Group member roles
CREATE TYPE group_role AS ENUM ('admin', 'moderator', 'member');

-- Platform-level user roles
CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'superadmin');

-- Reaction types (includes haha from migration 042)
CREATE TYPE reaction_type AS ENUM ('like', 'love', 'fire', 'clap', 'think', 'haha');

-- What entity a reaction is attached to (includes showcase, feature_request)
CREATE TYPE reactable_type AS ENUM ('post', 'comment', 'showcase', 'feature_request');

-- Asset file types
CREATE TYPE asset_type AS ENUM ('image', 'video', 'document', 'other');

-- Notification types (includes comment_reply from migration 025)
CREATE TYPE notification_type AS ENUM (
    'new_comment',
    'new_reaction',
    'new_message',
    'new_follower',
    'mention',
    'group_invite',
    'group_join',
    'event_reminder',
    'comment_reply'
);

-- RSVP status for events
CREATE TYPE rsvp_status AS ENUM ('going', 'maybe', 'not_going');

-- Point activity types (includes showcase_approved from migration 023)
CREATE TYPE point_action_type AS ENUM (
    'post_created',
    'comment_created',
    'reaction_given',
    'reaction_received',
    'event_attended',
    'daily_login',
    'profile_completed',
    'manual_adjustment',
    'showcase_approved'
);

-- Announcement types
CREATE TYPE announcement_type AS ENUM ('info', 'warning', 'success', 'error');
CREATE TYPE announcement_scope AS ENUM ('global', 'group');

-- Showcase types
CREATE TYPE showcase_status AS ENUM ('pending', 'approved', 'rejected', 'featured');
CREATE TYPE showcase_category AS ENUM (
    'web_app', 'mobile_app', 'saas', 'tool', 'api',
    'website', 'game', 'extension', 'other'
);

-- Activation request status
CREATE TYPE activation_request_status AS ENUM (
    'pending', 'in_progress', 'completed', 'rejected'
);

-- Feature request types
CREATE TYPE feature_request_status AS ENUM (
    'under_review', 'planned', 'in_progress', 'released', 'declined', 'duplicate'
);
CREATE TYPE feature_request_type AS ENUM (
    'feature_request', 'bug_report', 'improvement'
);


-- #############################################################################
-- SECTION 3: CORE TABLES
-- #############################################################################

-- =============================================================================
-- 3.1 PROFILES (User Profiles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    cover_url TEXT,                                     -- Profile cover/banner photo (migration 057)
    bio TEXT,
    location TEXT,
    website TEXT,
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),

    -- Platform role (migration 003_platform_roles)
    role user_role DEFAULT 'user',

    -- Membership tier (migration 029)
    membership_type TEXT DEFAULT 'free' CHECK (membership_type IN ('free', 'premium')),

    -- Ban system (migration 017)
    is_banned BOOLEAN DEFAULT false,
    ban_reason TEXT,
    ban_expires_at TIMESTAMPTZ,
    banned_by UUID REFERENCES profiles(id),
    banned_at TIMESTAMPTZ,

    -- Two-factor auth (migration 024)
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    two_factor_verified_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_online ON profiles(is_online) WHERE is_online = true;
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_membership_type ON profiles(membership_type);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON profiles(is_banned) WHERE is_banned = true;
CREATE INDEX IF NOT EXISTS idx_profiles_ban_expires ON profiles(ban_expires_at) WHERE ban_expires_at IS NOT NULL;

-- =============================================================================
-- 3.2 GROUPS (Communities/Groups)
-- =============================================================================
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    is_private BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,                   -- Premium-only groups (migration 029)
    layout_mode TEXT NOT NULL DEFAULT 'sidebar'          -- default, sidebar, learn (migration 006, 058)
        CHECK (layout_mode IN ('default', 'sidebar', 'learn')),
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT group_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
    CONSTRAINT group_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_groups_slug ON groups(slug);
CREATE INDEX idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_groups_is_premium ON groups(is_premium);

-- =============================================================================
-- 3.3 GROUP_MEMBERS (Group Membership)
-- =============================================================================
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role group_role DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_role ON group_members(role);

-- =============================================================================
-- 3.4 CATEGORIES (Post Categories)
-- =============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,                     -- migration 017
    is_active BOOLEAN DEFAULT true,                      -- migration 017
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT category_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 50)
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_group ON categories(group_id);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);

-- =============================================================================
-- 3.5 POSTS (Community Posts) - group_id is NULLABLE (migration 004)
-- =============================================================================
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE, -- NULLABLE for general feed
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_pinned BOOLEAN DEFAULT false,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT post_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 10000)
);

CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_group ON posts(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_posts_no_group ON posts(created_at DESC) WHERE group_id IS NULL;
CREATE INDEX idx_posts_category ON posts(category_id);
CREATE INDEX idx_posts_pinned ON posts(is_pinned) WHERE is_pinned = true;
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- =============================================================================
-- 3.6 COMMENTS (Post & Recording Comments)
-- =============================================================================
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,           -- NULLABLE (migration 058)
    recording_id UUID,                                              -- FK added after recordings table
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT comment_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 5000),
    CONSTRAINT comments_target_check CHECK (post_id IS NOT NULL OR recording_id IS NOT NULL)
);

CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON comments(created_at ASC);

-- =============================================================================
-- 3.7 REACTIONS (Likes/Reactions to Posts, Comments, Showcases, Feature Requests)
-- =============================================================================
CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reactable_type reactable_type NOT NULL,
    reactable_id UUID NOT NULL,
    reaction_type reaction_type DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, reactable_type, reactable_id)
);

CREATE INDEX idx_reactions_user ON reactions(user_id);
CREATE INDEX idx_reactions_reactable ON reactions(reactable_type, reactable_id);

-- =============================================================================
-- 3.8 MESSAGES (Direct Messages)
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT message_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 5000),
    CONSTRAINT no_self_message CHECK (sender_id != recipient_id)
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_unread ON messages(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC
);

-- =============================================================================
-- 3.9 ASSETS (Uploaded Files/Media)
-- =============================================================================
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    asset_type asset_type NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    feature_request_id UUID,                             -- FK added after feature_requests table (migration 049)
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT file_size_check CHECK (file_size <= 104857600) -- 100MB max
);

CREATE INDEX idx_assets_uploader ON assets(uploaded_by);
CREATE INDEX idx_assets_post ON assets(post_id);
CREATE INDEX idx_assets_message ON assets(message_id);
CREATE INDEX idx_assets_type ON assets(asset_type);

-- =============================================================================
-- 3.10 NOTIFICATIONS (User Notifications)
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    email_pending BOOLEAN DEFAULT FALSE,                 -- migration 025
    email_sent_at TIMESTAMPTZ,                           -- migration 025
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT notification_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 200)
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_email_pending ON notifications(email_pending) WHERE email_pending = TRUE;

-- =============================================================================
-- 3.11 LEADERBOARD_ENTRIES (Points and Ranking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0,
    rank INTEGER,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_user ON leaderboard_entries(user_id);
CREATE INDEX idx_leaderboard_group ON leaderboard_entries(group_id);
CREATE INDEX idx_leaderboard_points ON leaderboard_entries(total_points DESC);
CREATE INDEX idx_leaderboard_period ON leaderboard_entries(period_start, period_end);

-- Unique index that properly handles NULL group_id
CREATE UNIQUE INDEX idx_leaderboard_unique_entry
ON leaderboard_entries (
    user_id,
    COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period_start,
    period_end
);

-- =============================================================================
-- 3.12 EVENTS (Calendar Events) - group_id is NULLABLE (migration 015)
-- =============================================================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location TEXT,
    is_virtual BOOLEAN DEFAULT false,
    meeting_url TEXT,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE, -- NULLABLE for community-wide events
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT event_title_length CHECK (char_length(title) >= 2 AND char_length(title) <= 200),
    CONSTRAINT event_time_check CHECK (end_time > start_time)
);

CREATE INDEX idx_events_group ON events(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_events_no_group ON events(start_time) WHERE group_id IS NULL;
CREATE INDEX idx_events_creator ON events(created_by);
CREATE INDEX idx_events_start_time ON events(start_time ASC);

-- =============================================================================
-- 3.13 EVENT_ATTENDEES (Event RSVPs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS event_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status rsvp_status DEFAULT 'going',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX idx_event_attendees_user ON event_attendees(user_id);
CREATE INDEX idx_event_attendees_status ON event_attendees(status);

-- =============================================================================
-- 3.14 POINT_ACTIVITIES (Points Tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS point_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    action_type point_action_type NOT NULL,
    points INTEGER NOT NULL,
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_point_activities_user ON point_activities(user_id);
CREATE INDEX idx_point_activities_group ON point_activities(group_id);
CREATE INDEX idx_point_activities_action ON point_activities(action_type);
CREATE INDEX idx_point_activities_created ON point_activities(created_at DESC);
CREATE INDEX idx_point_activities_user_created ON point_activities(user_id, created_at DESC);

-- =============================================================================
-- 3.15 GROUP_ASSETS (Group File Attachments)
-- =============================================================================
CREATE TABLE IF NOT EXISTS group_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    module_id UUID,                                      -- FK added after modules table (migration 058)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, asset_id)
);

CREATE INDEX idx_group_assets_group ON group_assets(group_id);
CREATE INDEX idx_group_assets_asset ON group_assets(asset_id);

-- =============================================================================
-- 3.16 RECORDINGS (Video Recordings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    video_platform TEXT NOT NULL CHECK (video_platform IN ('youtube', 'vimeo')),
    video_id TEXT NOT NULL,
    thumbnail_url TEXT,
    module_id UUID,                                      -- FK added after modules table (migration 058)
    display_order INTEGER NOT NULL DEFAULT 0,            -- migration 058
    published_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recordings_group ON recordings(group_id);
CREATE INDEX idx_recordings_created ON recordings(created_at DESC);

-- Now add FK for comments.recording_id
ALTER TABLE comments ADD CONSTRAINT comments_recording_id_fkey
    FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE;
CREATE INDEX idx_comments_recording ON comments(recording_id);


-- #############################################################################
-- SECTION 4: FEATURE TABLES
-- #############################################################################

-- =============================================================================
-- 4.1 ANNOUNCEMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type announcement_type DEFAULT 'info',
    scope announcement_scope DEFAULT 'global',
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    is_dismissible BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_announcements_scope ON announcements(scope);
CREATE INDEX IF NOT EXISTS idx_announcements_group ON announcements(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_dates ON announcements(starts_at, expires_at);

-- =============================================================================
-- 4.2 ANNOUNCEMENT_DISMISSALS
-- =============================================================================
CREATE TABLE IF NOT EXISTS announcement_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    dismissed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_dismissals_user ON announcement_dismissals(user_id);

-- =============================================================================
-- 4.3 PASSWORD_RESET_TOKENS
-- =============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- =============================================================================
-- 4.4 TWO_FACTOR_BACKUP_CODES
-- =============================================================================
CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_two_factor_backup_codes_user_id ON two_factor_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_backup_codes_code_hash ON two_factor_backup_codes(code_hash);

-- =============================================================================
-- 4.5 NOTIFICATION_PREFERENCES
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notify_comments BOOLEAN DEFAULT TRUE,
    notify_replies BOOLEAN DEFAULT TRUE,
    notify_mentions BOOLEAN DEFAULT TRUE,
    notify_messages BOOLEAN DEFAULT TRUE,
    notify_reactions BOOLEAN DEFAULT TRUE,
    email_comments BOOLEAN DEFAULT TRUE,
    email_replies BOOLEAN DEFAULT TRUE,
    email_mentions BOOLEAN DEFAULT TRUE,
    email_messages BOOLEAN DEFAULT TRUE,
    email_announcements BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);

-- =============================================================================
-- 4.6 SHOWCASES (ProductHunt-style showcase)
-- =============================================================================
CREATE TABLE IF NOT EXISTS showcases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    tagline VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    category showcase_category NOT NULL,
    tech_stack TEXT[] DEFAULT '{}',
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status showcase_status DEFAULT 'pending',
    moderation_notes TEXT,
    moderated_by UUID REFERENCES profiles(id),
    moderated_at TIMESTAMPTZ,
    launch_date DATE,
    is_featured BOOLEAN DEFAULT false,
    featured_at TIMESTAMPTZ,
    vote_count INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    average_rating NUMERIC(2,1) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT showcase_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 255),
    CONSTRAINT showcase_tagline_length CHECK (char_length(tagline) >= 10 AND char_length(tagline) <= 150),
    CONSTRAINT showcase_description_length CHECK (char_length(description) >= 50 AND char_length(description) <= 10000),
    CONSTRAINT showcase_url_format CHECK (url ~ '^https?://')
);

CREATE INDEX idx_showcases_status ON showcases(status);
CREATE INDEX idx_showcases_author ON showcases(author_id);
CREATE INDEX idx_showcases_category ON showcases(category);
CREATE INDEX idx_showcases_launch_date ON showcases(launch_date DESC NULLS LAST);
CREATE INDEX idx_showcases_vote_count ON showcases(vote_count DESC);
CREATE INDEX idx_showcases_featured ON showcases(is_featured) WHERE is_featured = true;
CREATE INDEX idx_showcases_created_at ON showcases(created_at DESC);

-- =============================================================================
-- 4.7 SHOWCASE_IMAGES
-- =============================================================================
CREATE TABLE IF NOT EXISTS showcase_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    showcase_id UUID NOT NULL REFERENCES showcases(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    display_order INTEGER DEFAULT 0,
    caption VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_showcase_images_showcase ON showcase_images(showcase_id);
CREATE INDEX idx_showcase_images_order ON showcase_images(showcase_id, display_order);

-- =============================================================================
-- 4.8 SHOWCASE_TAGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS showcase_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#6B7280',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT showcase_tag_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 50),
    CONSTRAINT showcase_tag_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_showcase_tags_slug ON showcase_tags(slug);

-- =============================================================================
-- 4.9 SHOWCASE_TAG_RELATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS showcase_tag_relations (
    showcase_id UUID NOT NULL REFERENCES showcases(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES showcase_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (showcase_id, tag_id)
);

CREATE INDEX idx_showcase_tag_relations_tag ON showcase_tag_relations(tag_id);

-- =============================================================================
-- 4.10 SHOWCASE_REVIEWS
-- =============================================================================
CREATE TABLE IF NOT EXISTS showcase_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    showcase_id UUID NOT NULL REFERENCES showcases(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    maker_reply TEXT,
    maker_replied_at TIMESTAMPTZ,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(showcase_id, author_id),
    CONSTRAINT showcase_review_content_length CHECK (char_length(content) >= 10 AND char_length(content) <= 2000)
);

CREATE INDEX idx_showcase_reviews_showcase ON showcase_reviews(showcase_id);
CREATE INDEX idx_showcase_reviews_author ON showcase_reviews(author_id);
CREATE INDEX idx_showcase_reviews_rating ON showcase_reviews(rating);
CREATE INDEX idx_showcase_reviews_created_at ON showcase_reviews(created_at DESC);

-- =============================================================================
-- 4.11 ACTIVATION_PRODUCTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS activation_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    product_type TEXT NOT NULL DEFAULT 'plugin',
    monthly_limit INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    icon_url TEXT,
    instructions TEXT,
    license_key TEXT DEFAULT NULL,                        -- migration 044
    file_url TEXT DEFAULT NULL,                           -- migration 045
    file_name TEXT DEFAULT NULL,                          -- migration 045
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT monthly_limit_positive CHECK (monthly_limit > 0)
);

CREATE INDEX IF NOT EXISTS idx_activation_products_slug ON activation_products(slug);
CREATE INDEX IF NOT EXISTS idx_activation_products_type ON activation_products(product_type);
CREATE INDEX IF NOT EXISTS idx_activation_products_active ON activation_products(is_active) WHERE is_active = true;

-- =============================================================================
-- 4.12 ACTIVATION_REQUESTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS activation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES activation_products(id) ON DELETE CASCADE,
    status activation_request_status DEFAULT 'pending',
    website_url TEXT NOT NULL,
    wp_username TEXT NOT NULL,
    wp_password TEXT NOT NULL,
    notes TEXT,
    admin_notes TEXT,
    processed_by UUID REFERENCES profiles(id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activation_requests_user ON activation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_activation_requests_product ON activation_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_activation_requests_status ON activation_requests(status);
CREATE INDEX IF NOT EXISTS idx_activation_requests_pending ON activation_requests(status, created_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_activation_requests_month ON activation_requests(user_id, product_id, created_at);

-- =============================================================================
-- 4.13 ACTIVATION_USAGE
-- =============================================================================
CREATE TABLE IF NOT EXISTS activation_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES activation_products(id) ON DELETE CASCADE,
    month_year DATE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_product_month UNIQUE (user_id, product_id, month_year),
    CONSTRAINT usage_count_positive CHECK (usage_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_activation_usage_lookup ON activation_usage(user_id, product_id, month_year);

-- =============================================================================
-- 4.14 FEATURE_REQUESTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type feature_request_type NOT NULL DEFAULT 'feature_request',
    status feature_request_status NOT NULL DEFAULT 'under_review',
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    admin_response TEXT,
    is_pinned BOOLEAN DEFAULT false,
    vote_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fr_title_length CHECK (char_length(title) >= 5 AND char_length(title) <= 255),
    CONSTRAINT fr_description_length CHECK (char_length(description) >= 20 AND char_length(description) <= 10000)
);

CREATE INDEX idx_feature_requests_status ON feature_requests(status);
CREATE INDEX idx_feature_requests_type ON feature_requests(type);
CREATE INDEX idx_feature_requests_author ON feature_requests(author_id);
CREATE INDEX idx_feature_requests_vote_count ON feature_requests(vote_count DESC);
CREATE INDEX idx_feature_requests_created_at ON feature_requests(created_at DESC);
CREATE INDEX idx_feature_requests_pinned ON feature_requests(is_pinned) WHERE is_pinned = true;

-- Add FK for assets.feature_request_id
ALTER TABLE assets ADD CONSTRAINT assets_feature_request_id_fkey
    FOREIGN KEY (feature_request_id) REFERENCES feature_requests(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_assets_feature_request_id ON assets(feature_request_id)
    WHERE feature_request_id IS NOT NULL;

-- =============================================================================
-- 4.15 FEATURE_REQUEST_COMMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS feature_request_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES feature_request_comments(id) ON DELETE CASCADE,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fr_comment_length CHECK (char_length(content) >= 1 AND char_length(content) <= 5000)
);

CREATE INDEX idx_fr_comments_request ON feature_request_comments(feature_request_id);
CREATE INDEX idx_fr_comments_author ON feature_request_comments(author_id);
CREATE INDEX idx_fr_comments_parent ON feature_request_comments(parent_comment_id);
CREATE INDEX idx_fr_comments_created ON feature_request_comments(created_at);

-- =============================================================================
-- 4.16 FOLLOWS (User Following)
-- =============================================================================
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- =============================================================================
-- 4.17 LIVE_SESSIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Live Session',
    description TEXT,
    youtube_embed_url TEXT,
    scheduled_at TIMESTAMPTZ,
    visibility TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('unlisted', 'private')),
    status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'live', 'ended')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_sessions_status ON live_sessions(status) WHERE status = 'live';
CREATE INDEX idx_live_sessions_created_at ON live_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_sessions_scheduled ON live_sessions(scheduled_at) WHERE status = 'idle';

-- =============================================================================
-- 4.18 LIVE_SESSION_RSVPS
-- =============================================================================
CREATE TABLE IF NOT EXISTS live_session_rsvps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

CREATE INDEX idx_live_session_rsvps_session ON live_session_rsvps(session_id);
CREATE INDEX idx_live_session_rsvps_user ON live_session_rsvps(user_id);

-- =============================================================================
-- 4.19 LIVE_SESSION_MESSAGES
-- =============================================================================
CREATE TABLE IF NOT EXISTS live_session_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_messages_session ON live_session_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_messages_user ON live_session_messages(user_id);

-- =============================================================================
-- 4.20 COMMENT_VOTES (Upvote/Downvote)
-- =============================================================================
CREATE TABLE IF NOT EXISTS comment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, comment_id)
);

CREATE INDEX idx_comment_votes_comment ON comment_votes(comment_id);
CREATE INDEX idx_comment_votes_user ON comment_votes(user_id);

-- =============================================================================
-- 4.21 MODULES (Learn Mode)
-- =============================================================================
CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_modules_group ON modules(group_id);
CREATE INDEX idx_modules_order ON modules(group_id, display_order);

-- Add FK for recordings.module_id and group_assets.module_id
ALTER TABLE recordings ADD CONSTRAINT recordings_module_id_fkey
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL;
CREATE INDEX idx_recordings_module ON recordings(module_id);

ALTER TABLE group_assets ADD CONSTRAINT group_assets_module_id_fkey
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL;
CREATE INDEX idx_group_assets_module ON group_assets(module_id);

-- =============================================================================
-- 4.22 LESSON_COMPLETIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS lesson_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, recording_id)
);

CREATE INDEX idx_lesson_completions_user ON lesson_completions(user_id);
CREATE INDEX idx_lesson_completions_module ON lesson_completions(user_id, module_id);
CREATE INDEX idx_lesson_completions_recording ON lesson_completions(recording_id);


-- #############################################################################
-- SECTION 5: PAYMENT TABLES (Stripe)
-- #############################################################################

-- =============================================================================
-- 5.1 STRIPE_CUSTOMERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_customer_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);
CREATE INDEX idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX idx_stripe_customers_email ON stripe_customers(email);

-- =============================================================================
-- 5.2 STRIPE_SUBSCRIPTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    stripe_price_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT stripe_sub_status_check CHECK (
        status IN ('active', 'cancelled', 'expired', 'failed_payment', 'refunded', 'past_due', 'trialing')
    )
);

CREATE INDEX idx_stripe_subscriptions_sub_id ON stripe_subscriptions(stripe_subscription_id);
CREATE INDEX idx_stripe_subscriptions_customer_id ON stripe_subscriptions(stripe_customer_id);
CREATE INDEX idx_stripe_subscriptions_user_id ON stripe_subscriptions(user_id);
CREATE INDEX idx_stripe_subscriptions_status ON stripe_subscriptions(status);

-- =============================================================================
-- 5.3 STRIPE_WEBHOOK_LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS stripe_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    stripe_event_id TEXT UNIQUE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_stripe_webhook_logs_event_id ON stripe_webhook_logs(stripe_event_id);
CREATE INDEX idx_stripe_webhook_logs_created_at ON stripe_webhook_logs(created_at DESC);
CREATE INDEX idx_stripe_webhook_logs_processed ON stripe_webhook_logs(processed);


-- #############################################################################
-- SECTION 6: HELPER FUNCTIONS (RLS helpers, platform role checks)
-- #############################################################################

-- =============================================================================
-- 6.1 RLS Helper: Check group membership
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_group_member(group_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = $1
        AND group_members.user_id = $2
    );
END;
$$;

-- =============================================================================
-- 6.2 RLS Helper: Check group admin/mod status
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_group_admin_or_mod(group_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = $1
        AND group_members.user_id = $2
        AND group_members.role IN ('admin', 'moderator')
    );
END;
$$;

-- =============================================================================
-- 6.3 Platform role check functions (migration 036 final versions)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_platform_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_uuid
        AND role IN ('admin', 'superadmin')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_moderator(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_uuid
        AND role IN ('moderator', 'admin', 'superadmin')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_uuid
        AND role = 'superadmin'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    SELECT role::TEXT INTO v_user_role
    FROM profiles
    WHERE id = user_uuid;
    RETURN COALESCE(v_user_role, 'user');
END;
$$;

-- =============================================================================
-- 6.4 Group membership helpers for RLS (migration 020 - avoid recursion)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_group_membership(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id AND user_id = p_user_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id AND user_id = p_user_id
        AND role IN ('admin', 'moderator')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_group_public(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM groups WHERE id = p_group_id AND is_private = false
    );
END;
$$;

-- =============================================================================
-- 6.5 Ban check functions (migration 047 final versions)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_user_banned(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_uuid
        AND is_banned = true
        AND (ban_expires_at IS NULL OR ban_expires_at > NOW())
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.ban_user(
    target_user_id UUID,
    admin_user_id UUID,
    ban_reason TEXT DEFAULT NULL,
    ban_duration INTERVAL DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_role TEXT;
    target_role TEXT;
BEGIN
    SELECT role INTO admin_role FROM profiles WHERE id = admin_user_id;
    SELECT role INTO target_role FROM profiles WHERE id = target_user_id;

    IF admin_role NOT IN ('admin', 'superadmin') THEN
        RAISE EXCEPTION 'Insufficient permissions to ban users';
    END IF;

    IF target_role = 'superadmin' AND admin_role != 'superadmin' THEN
        RAISE EXCEPTION 'Cannot ban a superadmin';
    END IF;

    UPDATE profiles
    SET
        is_banned = true,
        ban_reason = ban_user.ban_reason,
        banned_by = admin_user_id,
        banned_at = NOW(),
        ban_expires_at = CASE WHEN ban_duration IS NULL THEN NULL ELSE NOW() + ban_duration END
    WHERE id = target_user_id;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.unban_user(
    target_user_id UUID,
    admin_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_role TEXT;
BEGIN
    SELECT role INTO admin_role FROM profiles WHERE id = admin_user_id;

    IF admin_role NOT IN ('admin', 'superadmin') THEN
        RAISE EXCEPTION 'Insufficient permissions to unban users';
    END IF;

    UPDATE profiles
    SET is_banned = false, ban_reason = NULL, banned_by = NULL, banned_at = NULL, ban_expires_at = NULL
    WHERE id = target_user_id;

    RETURN true;
END;
$$;

-- =============================================================================
-- 6.6 Premium/Subscription functions (migration 029, 059)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM stripe_subscriptions
        WHERE user_id = p_user_id
        AND status = 'active'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_premium_access(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_membership_type TEXT;
BEGIN
    SELECT membership_type INTO v_membership_type
    FROM profiles WHERE id = p_user_id;

    IF v_membership_type = 'premium' THEN
        RETURN TRUE;
    END IF;

    RETURN has_active_subscription(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_group(p_user_id UUID, p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_premium BOOLEAN;
BEGIN
    SELECT is_premium INTO v_is_premium FROM groups WHERE id = p_group_id;
    IF NOT COALESCE(v_is_premium, false) THEN
        RETURN TRUE;
    END IF;
    RETURN has_premium_access(p_user_id);
END;
$$;

-- =============================================================================
-- 6.7 Mention extraction (migration 025)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.extract_mentions(content TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    mentions TEXT[];
BEGIN
    SELECT ARRAY_AGG(DISTINCT LOWER(m[1]))
    INTO mentions
    FROM regexp_matches(content, '@([a-zA-Z0-9_-]{3,30})', 'g') AS m;
    RETURN COALESCE(mentions, ARRAY[]::TEXT[]);
END;
$$;

-- =============================================================================
-- 6.8 Notification preferences helper (migration 041 final version)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_notification_preferences(p_user_id UUID)
RETURNS public.notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result public.notification_preferences;
BEGIN
    SELECT * INTO result
    FROM notification_preferences
    WHERE user_id = p_user_id;

    IF result IS NULL THEN
        result.user_id := p_user_id;
        result.notify_comments := TRUE;
        result.notify_replies := TRUE;
        result.notify_mentions := TRUE;
        result.notify_messages := TRUE;
        result.notify_reactions := TRUE;
        result.email_comments := TRUE;
        result.email_replies := TRUE;
        result.email_mentions := TRUE;
        result.email_messages := TRUE;
        result.email_announcements := TRUE;
    END IF;

    RETURN result;
END;
$$;

-- =============================================================================
-- 6.9 Utility functions
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_post_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM posts WHERE author_id = p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_comment_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM comments WHERE author_id = p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_group_member_count(p_group_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM group_members WHERE group_id = p_group_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_group_online_count(p_group_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM group_members gm
        JOIN profiles p ON gm.user_id = p.id
        WHERE gm.group_id = p_group_id
        AND p.is_online = true
        AND p.last_seen_at > NOW() - INTERVAL '5 minutes'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE messages
    SET is_read = true, read_at = NOW()
    WHERE id = p_message_id AND recipient_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE user_id = auth.uid() AND is_read = false;
END;
$$;

-- =============================================================================
-- 6.10 Search functions
-- =============================================================================
CREATE OR REPLACE FUNCTION public.search_posts(
    p_search_term TEXT,
    p_group_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID, title TEXT, content TEXT, author_id UUID,
    group_id UUID, created_at TIMESTAMPTZ, rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.title, p.content, p.author_id, p.group_id, p.created_at,
        ts_rank(
            to_tsvector('english', COALESCE(p.title, '') || ' ' || p.content),
            plainto_tsquery('english', p_search_term)
        ) AS rank
    FROM posts p
    WHERE (p_group_id IS NULL OR p.group_id = p_group_id)
        AND to_tsvector('english', COALESCE(p.title, '') || ' ' || p.content)
            @@ plainto_tsquery('english', p_search_term)
    ORDER BY rank DESC, p.created_at DESC
    LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_users(p_search_term TEXT)
RETURNS TABLE (
    id UUID, username TEXT, display_name TEXT, avatar_url TEXT, bio TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio
    FROM profiles p
    WHERE (p.username ILIKE '%' || p_search_term || '%'
        OR p.display_name ILIKE '%' || p_search_term || '%')
        AND p.is_banned = false
    ORDER BY
        CASE WHEN p.username ILIKE p_search_term || '%' THEN 1
             WHEN p.display_name ILIKE p_search_term || '%' THEN 2
             ELSE 3 END,
        p.username
    LIMIT 20;
END;
$$;

-- =============================================================================
-- 6.11 Cleanup functions
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days' AND is_read = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_reset_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- =============================================================================
-- 6.12 Leaderboard functions (final version from FIX_LEADERBOARD_DUPLICATES)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_user_points(
    p_user_id UUID,
    p_group_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_points INTEGER;
BEGIN
    SELECT COALESCE(SUM(points), 0)
    INTO v_total_points
    FROM point_activities
    WHERE user_id = p_user_id
        AND (p_group_id IS NULL OR group_id = p_group_id)
        AND created_at >= p_start_date::TIMESTAMPTZ
        AND created_at <= (p_end_date + INTERVAL '1 day')::TIMESTAMPTZ;
    RETURN v_total_points;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_leaderboard_entry(
    p_user_id UUID,
    p_group_id UUID DEFAULT NULL,
    p_period_start DATE DEFAULT CURRENT_DATE - INTERVAL '29 days',
    p_period_end DATE DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_points INTEGER;
    v_existing_id UUID;
BEGIN
    v_points := calculate_user_points(p_user_id, p_group_id, p_period_start, p_period_end);

    SELECT id INTO v_existing_id
    FROM leaderboard_entries
    WHERE user_id = p_user_id
      AND COALESCE(group_id, '00000000-0000-0000-0000-000000000000') = COALESCE(p_group_id, '00000000-0000-0000-0000-000000000000')
      AND period_start = p_period_start
      AND period_end = p_period_end;

    IF v_existing_id IS NOT NULL THEN
        UPDATE leaderboard_entries
        SET total_points = v_points, updated_at = NOW()
        WHERE id = v_existing_id;
    ELSE
        INSERT INTO leaderboard_entries (user_id, group_id, period_start, period_end, total_points, updated_at)
        VALUES (p_user_id, p_group_id, p_period_start, p_period_end, v_points, NOW());
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_points(
    p_user_id UUID,
    p_action_type point_action_type,
    p_points INTEGER,
    p_group_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    INSERT INTO point_activities (user_id, group_id, action_type, points, description, reference_id)
    VALUES (p_user_id, p_group_id, p_action_type, p_points, p_description, p_reference_id)
    RETURNING id INTO v_activity_id;

    PERFORM update_leaderboard_entry(p_user_id, p_group_id, (CURRENT_DATE - INTERVAL '29 days')::DATE, CURRENT_DATE);
    PERFORM update_leaderboard_entry(p_user_id, p_group_id, '2000-01-01'::DATE, '2099-12-31'::DATE);

    RETURN v_activity_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_rank(
    p_user_id UUID,
    p_group_id UUID DEFAULT NULL,
    p_period_start DATE DEFAULT '2000-01-01'::DATE,
    p_period_end DATE DEFAULT '2099-12-31'::DATE
)
RETURNS TABLE(rank BIGINT, points INTEGER, total_users BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_users AS (
        SELECT
            le.user_id,
            le.total_points,
            ROW_NUMBER() OVER (ORDER BY le.total_points DESC, le.updated_at ASC) as user_rank
        FROM leaderboard_entries le
        WHERE le.period_start = p_period_start
            AND le.period_end = p_period_end
            AND (
                (p_group_id IS NULL AND le.group_id IS NULL)
                OR le.group_id = p_group_id
            )
    )
    SELECT
        ru.user_rank,
        ru.total_points,
        (SELECT COUNT(*) FROM ranked_users)::BIGINT as total
    FROM ranked_users ru
    WHERE ru.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_leaderboard_for_period(
    p_group_id UUID DEFAULT NULL,
    p_period_start TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    user_id UUID,
    total_points BIGINT,
    activity_count BIGINT,
    "user" JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pa.user_id,
        COALESCE(SUM(pa.points), 0)::BIGINT as total_points,
        COUNT(*)::BIGINT as activity_count,
        jsonb_build_object(
            'id', p.id, 'username', p.username, 'display_name', p.display_name,
            'avatar_url', p.avatar_url, 'location', p.location
        ) as "user"
    FROM point_activities pa
    INNER JOIN profiles p ON p.id = pa.user_id
    WHERE pa.created_at >= p_period_start
        AND (p_group_id IS NULL OR pa.group_id = p_group_id OR (p_group_id IS NULL AND pa.group_id IS NULL))
    GROUP BY pa.user_id, p.id, p.username, p.display_name, p.avatar_url, p.location
    HAVING COALESCE(SUM(pa.points), 0) > 0
    ORDER BY total_points DESC, pa.user_id
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =============================================================================
-- 6.13 Admin dashboard functions (migration 017)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_members', (SELECT COUNT(*) FROM profiles WHERE is_banned = false),
        'banned_members', (SELECT COUNT(*) FROM profiles WHERE is_banned = true),
        'new_members_30d', (SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '30 days' AND is_banned = false),
        'total_posts', (SELECT COUNT(*) FROM posts),
        'posts_30d', (SELECT COUNT(*) FROM posts WHERE created_at >= NOW() - INTERVAL '30 days'),
        'total_comments', (SELECT COUNT(*) FROM comments),
        'comments_30d', (SELECT COUNT(*) FROM comments WHERE created_at >= NOW() - INTERVAL '30 days'),
        'total_groups', (SELECT COUNT(*) FROM groups),
        'active_groups', (SELECT COUNT(DISTINCT group_id) FROM posts WHERE created_at >= NOW() - INTERVAL '7 days' AND group_id IS NOT NULL),
        'total_events', (SELECT COUNT(*) FROM events),
        'upcoming_events', (SELECT COUNT(*) FROM events WHERE start_time > NOW()),
        'active_announcements', (SELECT COUNT(*) FROM announcements WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW()))
    ) INTO result;
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_growth(days INTEGER DEFAULT 30)
RETURNS TABLE(date DATE, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM profiles
    WHERE created_at >= NOW() - (days || ' days')::INTERVAL
    GROUP BY DATE(created_at)
    ORDER BY date;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_activity_stats(days INTEGER DEFAULT 30)
RETURNS TABLE(date DATE, posts BIGINT, comments BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH dates AS (
        SELECT generate_series(
            (NOW() - (days || ' days')::INTERVAL)::DATE, NOW()::DATE, '1 day'::INTERVAL
        )::DATE as date
    ),
    post_counts AS (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM posts WHERE created_at >= NOW() - (days || ' days')::INTERVAL
        GROUP BY DATE(created_at)
    ),
    comment_counts AS (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM comments WHERE created_at >= NOW() - (days || ' days')::INTERVAL
        GROUP BY DATE(created_at)
    )
    SELECT d.date, COALESCE(p.count, 0) as posts, COALESCE(c.count, 0) as comments
    FROM dates d
    LEFT JOIN post_counts p ON p.date = d.date
    LEFT JOIN comment_counts c ON c.date = d.date
    ORDER BY d.date;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_announcements(user_id UUID, p_group_id UUID DEFAULT NULL)
RETURNS TABLE(
    id UUID, title VARCHAR(200), content TEXT, type announcement_type,
    scope announcement_scope, group_id UUID, is_dismissible BOOLEAN, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, a.title, a.content, a.type, a.scope, a.group_id, a.is_dismissible, a.created_at
    FROM announcements a
    LEFT JOIN announcement_dismissals ad ON ad.announcement_id = a.id AND ad.user_id = $1
    WHERE a.is_active = true
        AND (a.starts_at IS NULL OR a.starts_at <= NOW())
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND ad.id IS NULL
        AND (a.scope = 'global' OR (a.scope = 'group' AND a.group_id = p_group_id))
    ORDER BY a.created_at DESC;
END;
$$;

-- =============================================================================
-- 6.14 Activation functions (migration 027)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_remaining_activations(p_user_id UUID, p_product_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_monthly_limit INTEGER;
    v_used_count INTEGER;
    v_month_start DATE;
BEGIN
    v_month_start := date_trunc('month', NOW())::DATE;
    SELECT monthly_limit INTO v_monthly_limit
    FROM activation_products WHERE id = p_product_id AND is_active = true;
    IF v_monthly_limit IS NULL THEN RETURN 0; END IF;
    SELECT COALESCE(usage_count, 0) INTO v_used_count
    FROM activation_usage
    WHERE user_id = p_user_id AND product_id = p_product_id AND month_year = v_month_start;
    RETURN GREATEST(v_monthly_limit - COALESCE(v_used_count, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.has_active_request(p_user_id UUID, p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM activation_requests
        WHERE user_id = p_user_id AND product_id = p_product_id AND status IN ('pending', 'in_progress')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_activation(
    p_user_id UUID, p_product_id UUID, p_website_url TEXT,
    p_wp_username TEXT, p_wp_password TEXT, p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_remaining INTEGER;
    v_request_id UUID;
BEGIN
    v_remaining := get_remaining_activations(p_user_id, p_product_id);
    IF v_remaining <= 0 THEN
        RAISE EXCEPTION 'Monthly activation limit reached for this product';
    END IF;
    IF has_active_request(p_user_id, p_product_id) THEN
        RAISE EXCEPTION 'You already have an active request for this product';
    END IF;
    INSERT INTO activation_requests (user_id, product_id, website_url, wp_username, wp_password, notes, status)
    VALUES (p_user_id, p_product_id, p_website_url, p_wp_username, p_wp_password, p_notes, 'pending')
    RETURNING id INTO v_request_id;
    RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_activation_request(
    p_request_id UUID, p_processor_id UUID,
    p_status activation_request_status, p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request RECORD;
    v_month_start DATE;
BEGIN
    IF NOT (is_platform_admin(p_processor_id) OR is_platform_moderator(p_processor_id)) THEN
        RAISE EXCEPTION 'Only platform admins or moderators can process activation requests';
    END IF;

    SELECT ar.*, ap.name as product_name INTO v_request
    FROM activation_requests ar JOIN activation_products ap ON ap.id = ar.product_id
    WHERE ar.id = p_request_id;

    IF v_request IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;

    UPDATE activation_requests
    SET status = p_status, admin_notes = p_admin_notes, processed_by = p_processor_id,
        processed_at = NOW(), updated_at = NOW()
    WHERE id = p_request_id;

    IF p_status = 'completed' THEN
        v_month_start := date_trunc('month', v_request.created_at)::DATE;
        INSERT INTO activation_usage (user_id, product_id, month_year, usage_count)
        VALUES (v_request.user_id, v_request.product_id, v_month_start, 1)
        ON CONFLICT (user_id, product_id, month_year)
        DO UPDATE SET usage_count = activation_usage.usage_count + 1, updated_at = NOW();
    END IF;

    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
        v_request.user_id, 'new_message',
        CASE WHEN p_status = 'completed' THEN 'Activation Completed'
             WHEN p_status = 'in_progress' THEN 'Activation In Progress'
             ELSE 'Activation Request Update' END,
        CASE WHEN p_status = 'completed' THEN 'Your ' || v_request.product_name || ' activation has been completed!'
             WHEN p_status = 'in_progress' THEN 'Your ' || v_request.product_name || ' activation is being processed.'
             ELSE 'Your activation request status has been updated.' END,
        '/activations'
    );

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_activation_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
    v_month_start DATE;
BEGIN
    v_month_start := date_trunc('month', NOW())::DATE;
    SELECT json_build_object(
        'total_products', (SELECT COUNT(*) FROM activation_products WHERE is_active = true),
        'total_requests', (SELECT COUNT(*) FROM activation_requests),
        'pending_requests', (SELECT COUNT(*) FROM activation_requests WHERE status = 'pending'),
        'in_progress_requests', (SELECT COUNT(*) FROM activation_requests WHERE status = 'in_progress'),
        'completed_this_month', (SELECT COUNT(*) FROM activation_requests WHERE status = 'completed' AND date_trunc('month', processed_at) = v_month_start),
        'rejected_this_month', (SELECT COUNT(*) FROM activation_requests WHERE status = 'rejected' AND date_trunc('month', processed_at) = v_month_start),
        'total_users_with_activations', (SELECT COUNT(DISTINCT user_id) FROM activation_requests WHERE status = 'completed')
    ) INTO result;
    RETURN result;
END;
$$;

-- =============================================================================
-- 6.15 Email notification helpers (migration 025)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_notification_emails(batch_size INTEGER DEFAULT 50)
RETURNS TABLE (
    notification_id UUID, user_id UUID, user_email TEXT, user_name TEXT,
    notification_type notification_type, title TEXT, message TEXT,
    link TEXT, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT n.id, n.user_id, au.email, p.display_name, n.type, n.title, n.message, n.link, n.created_at
    FROM notifications n
    JOIN profiles p ON p.id = n.user_id
    JOIN auth.users au ON au.id = n.user_id
    WHERE n.email_pending = TRUE
    ORDER BY n.created_at ASC LIMIT batch_size;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_email_sent(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE notifications SET email_pending = FALSE, email_sent_at = NOW() WHERE id = p_notification_id;
END;
$$;

-- =============================================================================
-- 6.16 Auth helper: get user by email (migration 035)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(user_email TEXT)
RETURNS TABLE(id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT au.id, au.email::TEXT
    FROM auth.users au
    WHERE LOWER(au.email) = LOWER(user_email)
    LIMIT 1;
END;
$$;

-- =============================================================================
-- 6.17 Toggle reaction function (migration 052)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.toggle_reaction(
    p_user_id UUID, p_reactable_type TEXT, p_reactable_id UUID, p_reaction_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    existing_id UUID;
    existing_type TEXT;
    v_reactable_type reactable_type;
    v_reaction_type reaction_type;
BEGIN
    v_reactable_type := p_reactable_type::reactable_type;
    v_reaction_type := p_reaction_type::reaction_type;

    SELECT id, reaction_type::TEXT INTO existing_id, existing_type
    FROM reactions
    WHERE user_id = p_user_id AND reactable_type = v_reactable_type AND reactable_id = p_reactable_id;

    IF existing_id IS NOT NULL AND existing_type = p_reaction_type THEN
        DELETE FROM reactions WHERE id = existing_id;
        RETURN json_build_object('added', false, 'reactionType', NULL);
    ELSIF existing_id IS NOT NULL THEN
        UPDATE reactions SET reaction_type = v_reaction_type WHERE id = existing_id;
        RETURN json_build_object('added', true, 'reactionType', p_reaction_type);
    ELSE
        INSERT INTO reactions (user_id, reactable_type, reactable_id, reaction_type)
        VALUES (p_user_id, v_reactable_type, p_reactable_id, v_reaction_type);
        RETURN json_build_object('added', true, 'reactionType', p_reaction_type);
    END IF;
END;
$$;

-- =============================================================================
-- 6.18 Toggle comment vote function (migration 056)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.toggle_comment_vote(
    p_user_id UUID, p_comment_id UUID, p_vote_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    existing_id UUID;
    existing_type TEXT;
BEGIN
    SELECT id, vote_type INTO existing_id, existing_type
    FROM comment_votes WHERE user_id = p_user_id AND comment_id = p_comment_id;

    IF existing_id IS NOT NULL AND existing_type = p_vote_type THEN
        DELETE FROM comment_votes WHERE id = existing_id;
        RETURN json_build_object('action', 'removed', 'voteType', NULL);
    ELSIF existing_id IS NOT NULL THEN
        UPDATE comment_votes SET vote_type = p_vote_type WHERE id = existing_id;
        RETURN json_build_object('action', 'switched', 'voteType', p_vote_type);
    ELSE
        INSERT INTO comment_votes (user_id, comment_id, vote_type)
        VALUES (p_user_id, p_comment_id, p_vote_type);
        RETURN json_build_object('action', 'added', 'voteType', p_vote_type);
    END IF;
END;
$$;


-- #############################################################################
-- SECTION 7: TRIGGER FUNCTIONS
-- #############################################################################

-- =============================================================================
-- 7.1 updated_at timestamp trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7.2 Auto-create profile on signup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO profiles (id, username, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'New User'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
    );
    RETURN NEW;
END;
$$;

-- =============================================================================
-- 7.3 Auto-add group creator as admin
-- =============================================================================
CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
    RETURN NEW;
END;
$$;

-- =============================================================================
-- 7.4 Notification trigger functions (migration 040 final versions)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    post_author_id UUID;
    parent_author_id UUID;
    post_title TEXT;
    commenter_name TEXT;
    user_prefs notification_preferences;
    should_email BOOLEAN;
BEGIN
    SELECT display_name INTO commenter_name FROM profiles WHERE id = NEW.author_id;

    IF NEW.parent_comment_id IS NOT NULL THEN
        SELECT author_id INTO parent_author_id FROM comments WHERE id = NEW.parent_comment_id;
        IF parent_author_id IS NOT NULL AND parent_author_id != NEW.author_id THEN
            user_prefs := get_notification_preferences(parent_author_id);
            should_email := COALESCE(user_prefs.email_replies, TRUE);
            IF COALESCE(user_prefs.notify_replies, TRUE) THEN
                INSERT INTO notifications (user_id, type, title, message, link, email_pending)
                VALUES (parent_author_id, 'comment_reply', commenter_name || ' replied to your comment',
                    LEFT(NEW.content, 100), '/post/' || NEW.post_id, should_email);
            END IF;
        END IF;
    END IF;

    SELECT author_id, COALESCE(title, LEFT(content, 50)) INTO post_author_id, post_title
    FROM posts WHERE id = NEW.post_id;

    IF post_author_id != NEW.author_id AND (parent_author_id IS NULL OR post_author_id != parent_author_id) THEN
        user_prefs := get_notification_preferences(post_author_id);
        should_email := COALESCE(user_prefs.email_comments, TRUE);
        IF COALESCE(user_prefs.notify_comments, TRUE) THEN
            INSERT INTO notifications (user_id, type, title, message, link, email_pending)
            VALUES (post_author_id, 'new_comment', commenter_name || ' commented on your post',
                LEFT(NEW.content, 100), '/post/' || NEW.post_id, should_email);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    content_author_id UUID;
    reactor_name TEXT;
    notification_title TEXT;
    notification_link TEXT;
    user_prefs notification_preferences;
BEGIN
    SELECT display_name INTO reactor_name FROM profiles WHERE id = NEW.user_id;

    IF NEW.reactable_type = 'post' THEN
        SELECT author_id INTO content_author_id FROM posts WHERE id = NEW.reactable_id;
        notification_link := '/posts/' || NEW.reactable_id;
        notification_title := reactor_name || ' reacted to your post';
    ELSIF NEW.reactable_type = 'comment' THEN
        SELECT author_id INTO content_author_id FROM comments WHERE id = NEW.reactable_id;
        SELECT '/posts/' || post_id INTO notification_link FROM comments WHERE id = NEW.reactable_id;
        notification_title := reactor_name || ' reacted to your comment';
    ELSIF NEW.reactable_type = 'showcase' THEN
        SELECT author_id INTO content_author_id FROM showcases WHERE id = NEW.reactable_id;
        notification_link := '/showcase/' || NEW.reactable_id;
        notification_title := reactor_name || ' reacted to your showcase';
    END IF;

    IF content_author_id IS NOT NULL AND content_author_id != NEW.user_id THEN
        user_prefs := get_notification_preferences(content_author_id);
        IF COALESCE(user_prefs.notify_reactions, TRUE) THEN
            INSERT INTO notifications (user_id, type, title, link, email_pending)
            VALUES (content_author_id, 'new_reaction', notification_title, notification_link, FALSE);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sender_name TEXT;
    user_prefs notification_preferences;
    should_email BOOLEAN;
BEGIN
    SELECT display_name INTO sender_name FROM profiles WHERE id = NEW.sender_id;
    user_prefs := get_notification_preferences(NEW.recipient_id);
    should_email := COALESCE(user_prefs.email_messages, TRUE);

    IF COALESCE(user_prefs.notify_messages, TRUE) THEN
        INSERT INTO notifications (user_id, type, title, message, link, email_pending)
        VALUES (NEW.recipient_id, 'new_message', 'New message from ' || sender_name,
            LEFT(NEW.content, 100), '/messages/' || NEW.sender_id, should_email);
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    mentioned_usernames TEXT[];
    mentioned_user RECORD;
    commenter_name TEXT;
    user_prefs notification_preferences;
    should_email BOOLEAN;
BEGIN
    mentioned_usernames := extract_mentions(NEW.content);
    IF array_length(mentioned_usernames, 1) IS NULL THEN RETURN NEW; END IF;

    SELECT display_name INTO commenter_name FROM profiles WHERE id = NEW.author_id;

    FOR mentioned_user IN
        SELECT id, username FROM profiles
        WHERE LOWER(username) = ANY(mentioned_usernames) AND id != NEW.author_id
    LOOP
        user_prefs := get_notification_preferences(mentioned_user.id);
        should_email := COALESCE(user_prefs.email_mentions, TRUE);
        IF COALESCE(user_prefs.notify_mentions, TRUE) THEN
            INSERT INTO notifications (user_id, type, title, message, link, email_pending)
            VALUES (mentioned_user.id, 'mention', commenter_name || ' mentioned you',
                LEFT(NEW.content, 100), '/post/' || NEW.post_id, should_email);
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    follower_name TEXT;
    follower_username TEXT;
BEGIN
    SELECT display_name, username INTO follower_name, follower_username
    FROM profiles WHERE id = NEW.follower_id;

    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (NEW.following_id, 'new_follower', follower_name || ' started following you',
        NULL, '/profile/' || follower_username);
    RETURN NEW;
END;
$$;

-- =============================================================================
-- 7.5 Point trigger functions (final version from FIX_FINAL_V2)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trigger_post_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM award_points(
        p_user_id := NEW.author_id,
        p_action_type := 'post_created'::point_action_type,
        p_points := 10,
        p_group_id := NEW.group_id,
        p_description := 'Created a new post',
        p_reference_id := NEW.id
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_comment_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group_id UUID;
BEGIN
    SELECT group_id INTO v_group_id FROM posts WHERE id = NEW.post_id;
    PERFORM award_points(
        p_user_id := NEW.author_id,
        p_action_type := 'comment_created'::point_action_type,
        p_points := 5,
        p_group_id := v_group_id,
        p_description := 'Created a new comment',
        p_reference_id := NEW.id
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_reaction_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_content_author_id UUID;
    v_group_id UUID;
BEGIN
    IF NEW.reactable_type = 'post' THEN
        SELECT author_id, group_id INTO v_content_author_id, v_group_id
        FROM posts WHERE id = NEW.reactable_id;
    ELSIF NEW.reactable_type = 'comment' THEN
        SELECT c.author_id, p.group_id INTO v_content_author_id, v_group_id
        FROM comments c JOIN posts p ON p.id = c.post_id
        WHERE c.id = NEW.reactable_id;
    END IF;

    PERFORM award_points(
        p_user_id := NEW.user_id, p_action_type := 'reaction_given'::point_action_type,
        p_points := 1, p_group_id := v_group_id,
        p_description := 'Gave a reaction', p_reference_id := NEW.id
    );

    IF v_content_author_id IS NOT NULL AND v_content_author_id != NEW.user_id THEN
        PERFORM award_points(
            p_user_id := v_content_author_id, p_action_type := 'reaction_received'::point_action_type,
            p_points := 2, p_group_id := v_group_id,
            p_description := 'Received a reaction', p_reference_id := NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_event_attendance_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group_id UUID;
BEGIN
    IF NEW.status = 'going' THEN
        SELECT group_id INTO v_group_id FROM events WHERE id = NEW.event_id;
        PERFORM award_points(
            NEW.user_id, 'event_attended', 15, v_group_id,
            'RSVP''d to an event', NEW.event_id
        );
    END IF;
    RETURN NEW;
END;
$$;

-- =============================================================================
-- 7.6 Showcase trigger functions
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_showcase_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.reactable_type = 'showcase' THEN
        UPDATE showcases SET vote_count = vote_count + 1, updated_at = NOW() WHERE id = NEW.reactable_id;
    ELSIF TG_OP = 'DELETE' AND OLD.reactable_type = 'showcase' THEN
        UPDATE showcases SET vote_count = GREATEST(0, vote_count - 1), updated_at = NOW() WHERE id = OLD.reactable_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_showcase_review_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_showcase_id UUID;
    v_avg_rating NUMERIC(2,1);
    v_review_count INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN v_showcase_id := OLD.showcase_id;
    ELSE v_showcase_id := NEW.showcase_id; END IF;

    SELECT COUNT(*)::INTEGER, COALESCE(ROUND(AVG(rating)::NUMERIC, 1), 0)
    INTO v_review_count, v_avg_rating
    FROM showcase_reviews WHERE showcase_id = v_showcase_id;

    UPDATE showcases SET review_count = v_review_count, average_rating = v_avg_rating, updated_at = NOW()
    WHERE id = v_showcase_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_showcase_approval_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status IN ('approved', 'featured') AND OLD.status = 'pending' THEN
        INSERT INTO point_activities (user_id, action_type, points, description, reference_id, group_id)
        VALUES (NEW.author_id, 'showcase_approved', 10, 'Showcase approved: ' || NEW.title, NEW.id, NULL);
    END IF;
    RETURN NEW;
END;
$$;

-- =============================================================================
-- 7.7 Feature request trigger functions
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_feature_request_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.reactable_type = 'feature_request' THEN
        UPDATE feature_requests SET vote_count = vote_count + 1, updated_at = NOW() WHERE id = NEW.reactable_id;
    ELSIF TG_OP = 'DELETE' AND OLD.reactable_type = 'feature_request' THEN
        UPDATE feature_requests SET vote_count = GREATEST(0, vote_count - 1), updated_at = NOW() WHERE id = OLD.reactable_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_feature_request_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN v_request_id := OLD.feature_request_id;
    ELSE v_request_id := NEW.feature_request_id; END IF;

    UPDATE feature_requests SET comment_count = (
        SELECT COUNT(*) FROM feature_request_comments WHERE feature_request_id = v_request_id
    ), updated_at = NOW() WHERE id = v_request_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- =============================================================================
-- 7.8 Profile column protection trigger (migration 046)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;

    IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')) THEN
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin') THEN
                RAISE EXCEPTION 'Only superadmins can change user roles';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    IF OLD.role IS DISTINCT FROM NEW.role THEN
        RAISE EXCEPTION 'Only superadmins can change user roles';
    END IF;
    IF OLD.is_banned IS DISTINCT FROM NEW.is_banned OR OLD.ban_reason IS DISTINCT FROM NEW.ban_reason
       OR OLD.ban_expires_at IS DISTINCT FROM NEW.ban_expires_at OR OLD.banned_by IS DISTINCT FROM NEW.banned_by
       OR OLD.banned_at IS DISTINCT FROM NEW.banned_at THEN
        RAISE EXCEPTION 'Only admins can modify ban status';
    END IF;
    IF OLD.membership_type IS DISTINCT FROM NEW.membership_type THEN
        RAISE EXCEPTION 'Membership type cannot be changed directly';
    END IF;
    IF OLD.two_factor_secret IS DISTINCT FROM NEW.two_factor_secret
       OR OLD.two_factor_verified_at IS DISTINCT FROM NEW.two_factor_verified_at THEN
        RAISE EXCEPTION '2FA secrets can only be modified through the verification flow';
    END IF;

    RETURN NEW;
END;
$$;

-- =============================================================================
-- 7.9 Live sessions updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_live_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =============================================================================
-- 7.10 Modules updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_modules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- #############################################################################
-- SECTION 8: TRIGGERS
-- #############################################################################

-- updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leaderboard_entries_updated_at BEFORE UPDATE ON leaderboard_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_event_attendees_updated_at BEFORE UPDATE ON event_attendees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activation_products_updated_at BEFORE UPDATE ON activation_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activation_requests_updated_at BEFORE UPDATE ON activation_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activation_usage_updated_at BEFORE UPDATE ON activation_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stripe_customers_updated_at BEFORE UPDATE ON stripe_customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stripe_subscriptions_updated_at BEFORE UPDATE ON stripe_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Announcement updated_at
CREATE TRIGGER update_announcement_timestamp BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Feature request updated_at
CREATE TRIGGER trg_feature_request_updated_at BEFORE UPDATE ON feature_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fr_comment_updated_at BEFORE UPDATE ON feature_request_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Live sessions and modules updated_at
CREATE TRIGGER trigger_live_sessions_updated_at BEFORE UPDATE ON live_sessions
    FOR EACH ROW EXECUTE FUNCTION update_live_sessions_updated_at();
CREATE TRIGGER set_modules_updated_at BEFORE UPDATE ON modules
    FOR EACH ROW EXECUTE FUNCTION update_modules_updated_at();

-- Auth trigger: auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Group trigger: auto-add creator as admin
CREATE TRIGGER on_group_created
    AFTER INSERT ON groups
    FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_admin();

-- Profile protection trigger
CREATE TRIGGER protect_profile_columns
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- Notification triggers
CREATE TRIGGER on_comment_created
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();
CREATE TRIGGER on_comment_mention
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_mention();
CREATE TRIGGER on_reaction_created
    AFTER INSERT ON reactions
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();
CREATE TRIGGER on_message_created
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();
CREATE TRIGGER on_follow_created
    AFTER INSERT ON follows
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- Point award triggers
CREATE TRIGGER award_points_for_post
    AFTER INSERT ON posts
    FOR EACH ROW EXECUTE FUNCTION trigger_post_points();
CREATE TRIGGER award_points_for_comment
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION trigger_comment_points();
CREATE TRIGGER award_points_for_reaction
    AFTER INSERT ON reactions
    FOR EACH ROW EXECUTE FUNCTION trigger_reaction_points();

-- Showcase triggers
CREATE TRIGGER trg_showcase_vote_count
    AFTER INSERT OR DELETE ON reactions
    FOR EACH ROW EXECUTE FUNCTION update_showcase_vote_count();
CREATE TRIGGER trg_showcase_review_stats
    AFTER INSERT OR UPDATE OR DELETE ON showcase_reviews
    FOR EACH ROW EXECUTE FUNCTION update_showcase_review_stats();
CREATE TRIGGER trg_showcase_approval_points
    AFTER UPDATE ON showcases
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION award_showcase_approval_points();

-- Feature request triggers
CREATE TRIGGER trg_feature_request_vote_count
    AFTER INSERT OR DELETE ON reactions
    FOR EACH ROW EXECUTE FUNCTION update_feature_request_vote_count();
CREATE TRIGGER trg_feature_request_comment_count
    AFTER INSERT OR DELETE ON feature_request_comments
    FOR EACH ROW EXECUTE FUNCTION update_feature_request_comment_count();


-- #############################################################################
-- SECTION 9: ROW LEVEL SECURITY (RLS)
-- #############################################################################

-- =============================================================================
-- 9.0 ENABLE RLS ON ALL TABLES
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE two_factor_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcases ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 9.1 PROFILES POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Platform admins can update any profile" ON profiles;
CREATE POLICY "Platform admins can update any profile"
    ON profiles FOR UPDATE USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
CREATE POLICY "Users can delete their own profile"
    ON profiles FOR DELETE USING (auth.uid() = id);

-- =============================================================================
-- 9.2 GROUPS POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Groups are viewable based on privacy" ON groups;
CREATE POLICY "Groups are viewable based on privacy"
    ON groups FOR SELECT USING (
        is_private = false OR is_group_member(id, auth.uid()) OR is_platform_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Platform admins can create groups" ON groups;
CREATE POLICY "Platform admins can create groups"
    ON groups FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND auth.uid() = created_by AND is_platform_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Group creators and platform admins can update groups" ON groups;
CREATE POLICY "Group creators and platform admins can update groups"
    ON groups FOR UPDATE
    USING (auth.uid() = created_by OR is_platform_admin(auth.uid()))
    WITH CHECK (auth.uid() = created_by OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Group creators and platform admins can delete groups" ON groups;
CREATE POLICY "Group creators and platform admins can delete groups"
    ON groups FOR DELETE
    USING (auth.uid() = created_by OR is_platform_admin(auth.uid()));

-- =============================================================================
-- 9.3 GROUP_MEMBERS POLICIES (migration 020 final)
-- =============================================================================
DROP POLICY IF EXISTS "Group members viewable appropriately" ON group_members;
CREATE POLICY "Group members viewable appropriately"
    ON group_members FOR SELECT USING (
        user_id = auth.uid()
        OR check_group_membership(group_id, auth.uid())
        OR is_group_public(group_id)
    );

DROP POLICY IF EXISTS "Users can join groups" ON group_members;
CREATE POLICY "Users can join groups"
    ON group_members FOR INSERT WITH CHECK (
        (auth.uid() = user_id AND role = 'member' AND is_group_public(group_id))
        OR check_group_admin(group_id, auth.uid())
    );

DROP POLICY IF EXISTS "Admins can update member roles" ON group_members;
CREATE POLICY "Admins can update member roles"
    ON group_members FOR UPDATE
    USING (check_group_admin(group_id, auth.uid()))
    WITH CHECK (check_group_admin(group_id, auth.uid()));

DROP POLICY IF EXISTS "Users can leave or admins can remove" ON group_members;
CREATE POLICY "Users can leave or admins can remove"
    ON group_members FOR DELETE USING (
        user_id = auth.uid() OR check_group_admin(group_id, auth.uid())
    );

DROP POLICY IF EXISTS "Platform admins can manage group members" ON group_members;
CREATE POLICY "Platform admins can manage group members"
    ON group_members FOR ALL
    USING (is_platform_admin(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()));

-- =============================================================================
-- 9.4 CATEGORIES POLICIES (migration 018/036 final)
-- =============================================================================
DROP POLICY IF EXISTS "Categories viewable by authenticated users" ON categories;
CREATE POLICY "Categories viewable by authenticated users"
    ON categories FOR SELECT TO authenticated USING (
        group_id IS NULL OR is_group_member(group_id, auth.uid()) OR is_platform_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Admins can create categories" ON categories;
CREATE POLICY "Admins can create categories"
    ON categories FOR INSERT TO authenticated WITH CHECK (
        is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Admins can update categories" ON categories;
CREATE POLICY "Admins can update categories"
    ON categories FOR UPDATE TO authenticated
    USING (is_platform_admin(auth.uid()) OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid())))
    WITH CHECK (is_platform_admin(auth.uid()) OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid())));

DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
CREATE POLICY "Admins can delete categories"
    ON categories FOR DELETE TO authenticated USING (
        is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

-- =============================================================================
-- 9.5 POSTS POLICIES (migration 012/036 final - handles NULL group_id)
-- =============================================================================
DROP POLICY IF EXISTS "Posts viewable by everyone or group members" ON posts;
CREATE POLICY "Posts viewable by everyone or group members"
    ON posts FOR SELECT USING (
        group_id IS NULL OR is_group_member(group_id, auth.uid()) OR is_platform_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
CREATE POLICY "Authenticated users can create posts"
    ON posts FOR INSERT WITH CHECK (
        auth.uid() = author_id AND (group_id IS NULL OR is_group_member(group_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Authors and admins can update posts" ON posts;
CREATE POLICY "Authors and admins can update posts"
    ON posts FOR UPDATE
    USING (auth.uid() = author_id OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid())) OR is_platform_admin(auth.uid()))
    WITH CHECK (auth.uid() = author_id OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid())) OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Authors, group admins, and platform mods can delete posts" ON posts;
CREATE POLICY "Authors, group admins, and platform mods can delete posts"
    ON posts FOR DELETE USING (
        auth.uid() = author_id
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
        OR is_platform_moderator(auth.uid())
    );

-- =============================================================================
-- 9.6 COMMENTS POLICIES (migration 019/058 final)
-- =============================================================================
DROP POLICY IF EXISTS "Comments viewable based on post visibility" ON comments;
CREATE POLICY "Comments viewable based on post visibility"
    ON comments FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM posts
            WHERE posts.id = comments.post_id
            AND (posts.group_id IS NULL OR EXISTS (
                SELECT 1 FROM group_members WHERE group_members.group_id = posts.group_id AND group_members.user_id = auth.uid()
            ))
        )
    );

DROP POLICY IF EXISTS "Users can view recording comments" ON comments;
CREATE POLICY "Users can view recording comments"
    ON comments FOR SELECT USING (recording_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can create comments" ON comments;
CREATE POLICY "Users can create comments"
    ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can create recording comments" ON comments;
CREATE POLICY "Users can create recording comments"
    ON comments FOR INSERT WITH CHECK (recording_id IS NOT NULL AND auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can update their comments" ON comments;
CREATE POLICY "Authors can update their comments"
    ON comments FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors, group admins, and platform mods can delete comments" ON comments;
CREATE POLICY "Authors, group admins, and platform mods can delete comments"
    ON comments FOR DELETE USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM posts WHERE posts.id = post_id
            AND (auth.uid() = posts.author_id OR is_group_admin_or_mod(posts.group_id, auth.uid()))
        )
        OR is_platform_moderator(auth.uid())
    );

-- =============================================================================
-- 9.7 REACTIONS POLICIES (migration 019 final)
-- =============================================================================
DROP POLICY IF EXISTS "Reactions viewable based on content visibility" ON reactions;
CREATE POLICY "Reactions viewable based on content visibility"
    ON reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can add reactions" ON reactions;
CREATE POLICY "Users can add reactions"
    ON reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their reactions" ON reactions;
CREATE POLICY "Users can update their reactions"
    ON reactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reactions" ON reactions;
CREATE POLICY "Users can delete own reactions"
    ON reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- 9.8 ASSETS POLICIES (migration 019 final)
-- =============================================================================
DROP POLICY IF EXISTS "Assets viewable based on parent visibility" ON assets;
CREATE POLICY "Assets viewable based on parent visibility"
    ON assets FOR SELECT TO authenticated USING (
        (post_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM posts WHERE posts.id = assets.post_id
            AND (posts.group_id IS NULL OR EXISTS (
                SELECT 1 FROM group_members WHERE group_members.group_id = posts.group_id AND group_members.user_id = auth.uid()
            ))
        ))
        OR (message_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM messages WHERE messages.id = assets.message_id
            AND (messages.sender_id = auth.uid() OR messages.recipient_id = auth.uid())
        ))
        OR uploaded_by = auth.uid()
    );

DROP POLICY IF EXISTS "Users can upload assets" ON assets;
CREATE POLICY "Users can upload assets"
    ON assets FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Uploaders can update their own assets" ON assets;
CREATE POLICY "Uploaders can update their own assets"
    ON assets FOR UPDATE USING (auth.uid() = uploaded_by) WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Uploaders can delete their assets" ON assets;
CREATE POLICY "Uploaders can delete their assets"
    ON assets FOR DELETE USING (auth.uid() = uploaded_by);

-- =============================================================================
-- 9.9 MESSAGES POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view their messages"
    ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages"
    ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Recipients can update messages" ON messages;
CREATE POLICY "Recipients can update messages"
    ON messages FOR UPDATE USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can delete their messages" ON messages;
CREATE POLICY "Users can delete their messages"
    ON messages FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- =============================================================================
-- 9.10 NOTIFICATIONS POLICIES (migration 031 final)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
    ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================================================
-- 9.11 LEADERBOARD_ENTRIES POLICIES (migration 019 final)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view leaderboard entries" ON leaderboard_entries;
CREATE POLICY "Users can view leaderboard entries"
    ON leaderboard_entries FOR SELECT TO authenticated USING (
        group_id IS NULL OR EXISTS (
            SELECT 1 FROM group_members WHERE group_members.group_id = leaderboard_entries.group_id
            AND group_members.user_id = auth.uid()
        )
    );

-- =============================================================================
-- 9.12 EVENTS POLICIES (migration 015/036 final - handles NULL group_id)
-- =============================================================================
DROP POLICY IF EXISTS "Events viewable by group members and platform admins" ON events;
CREATE POLICY "Events viewable by group members and platform admins"
    ON events FOR SELECT USING (
        group_id IS NULL OR is_group_member(group_id, auth.uid()) OR is_platform_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Users can create events" ON events;
CREATE POLICY "Users can create events"
    ON events FOR INSERT WITH CHECK (
        auth.uid() = created_by AND (group_id IS NULL OR is_group_member(group_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Creators, group admins, and platform admins can update events" ON events;
CREATE POLICY "Creators, group admins, and platform admins can update events"
    ON events FOR UPDATE USING (
        auth.uid() = created_by OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
        OR is_platform_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Creators, group admins, and platform admins can delete events" ON events;
CREATE POLICY "Creators, group admins, and platform admins can delete events"
    ON events FOR DELETE USING (
        auth.uid() = created_by OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
        OR is_platform_admin(auth.uid())
    );

-- =============================================================================
-- 9.13 EVENT_ATTENDEES POLICIES (migration 016 final)
-- =============================================================================
DROP POLICY IF EXISTS "Event attendees viewable by everyone or group members" ON event_attendees;
CREATE POLICY "Event attendees viewable by everyone or group members"
    ON event_attendees FOR SELECT USING (
        EXISTS (SELECT 1 FROM events WHERE events.id = event_id
            AND (events.group_id IS NULL OR is_group_member(events.group_id, auth.uid())))
    );

DROP POLICY IF EXISTS "Users can RSVP to events" ON event_attendees;
CREATE POLICY "Users can RSVP to events"
    ON event_attendees FOR INSERT WITH CHECK (
        auth.uid() = user_id AND EXISTS (
            SELECT 1 FROM events WHERE events.id = event_id
            AND (events.group_id IS NULL OR is_group_member(events.group_id, auth.uid()))
        )
    );

DROP POLICY IF EXISTS "Users can update their RSVP" ON event_attendees;
CREATE POLICY "Users can update their RSVP"
    ON event_attendees FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their RSVP" ON event_attendees;
CREATE POLICY "Users can delete their RSVP"
    ON event_attendees FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 9.14 POINT_ACTIVITIES POLICIES (migration 019 final)
-- =============================================================================
DROP POLICY IF EXISTS "Platform admins can view all point activities" ON point_activities;
CREATE POLICY "Platform admins can view all point activities"
    ON point_activities FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR is_platform_admin(auth.uid())
    );

-- =============================================================================
-- 9.15 GROUP_ASSETS POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Group members can view group assets" ON group_assets;
CREATE POLICY "Group members can view group assets"
    ON group_assets FOR SELECT USING (is_group_member(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Group admins can upload assets" ON group_assets;
CREATE POLICY "Group admins can upload assets"
    ON group_assets FOR INSERT WITH CHECK (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Group admins can delete assets" ON group_assets;
CREATE POLICY "Group admins can delete assets"
    ON group_assets FOR DELETE USING (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

-- =============================================================================
-- 9.16 RECORDINGS POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Group members can view recordings" ON recordings;
CREATE POLICY "Group members can view recordings"
    ON recordings FOR SELECT USING (is_group_member(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Group admins can create recordings" ON recordings;
CREATE POLICY "Group admins can create recordings"
    ON recordings FOR INSERT WITH CHECK (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Group admins can update recordings" ON recordings;
CREATE POLICY "Group admins can update recordings"
    ON recordings FOR UPDATE USING (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Group admins can delete recordings" ON recordings;
CREATE POLICY "Group admins can delete recordings"
    ON recordings FOR DELETE USING (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

-- =============================================================================
-- 9.17 ANNOUNCEMENTS POLICIES (migration 036 final)
-- =============================================================================
DROP POLICY IF EXISTS "Active announcements are viewable by authenticated users" ON announcements;
CREATE POLICY "Active announcements are viewable by authenticated users"
    ON announcements FOR SELECT TO authenticated USING (
        is_active = true AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW())
        AND (scope = 'global' OR (scope = 'group' AND is_group_member(group_id, auth.uid())))
    );

DROP POLICY IF EXISTS "Platform admins can view all announcements" ON announcements;
CREATE POLICY "Platform admins can view all announcements"
    ON announcements FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can create announcements" ON announcements;
CREATE POLICY "Platform admins can create announcements"
    ON announcements FOR INSERT TO authenticated WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can update announcements" ON announcements;
CREATE POLICY "Platform admins can update announcements"
    ON announcements FOR UPDATE TO authenticated
    USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can delete announcements" ON announcements;
CREATE POLICY "Platform admins can delete announcements"
    ON announcements FOR DELETE TO authenticated USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view their own dismissals" ON announcement_dismissals;
CREATE POLICY "Users can view their own dismissals"
    ON announcement_dismissals FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can dismiss announcements" ON announcement_dismissals;
CREATE POLICY "Users can dismiss announcements"
    ON announcement_dismissals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 9.18 PASSWORD_RESET_TOKENS POLICIES (migration 034)
-- =============================================================================
DROP POLICY IF EXISTS "Service role full access" ON password_reset_tokens;
CREATE POLICY "Service role full access"
    ON password_reset_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- 9.19 TWO_FACTOR_BACKUP_CODES POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own backup codes" ON two_factor_backup_codes;
CREATE POLICY "Users can view own backup codes"
    ON two_factor_backup_codes FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own backup codes" ON two_factor_backup_codes;
CREATE POLICY "Users can insert own backup codes"
    ON two_factor_backup_codes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own backup codes" ON two_factor_backup_codes;
CREATE POLICY "Users can update own backup codes"
    ON two_factor_backup_codes FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own backup codes" ON two_factor_backup_codes;
CREATE POLICY "Users can delete own backup codes"
    ON two_factor_backup_codes FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 9.20 NOTIFICATION_PREFERENCES POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own notification preferences" ON notification_preferences;
CREATE POLICY "Users can view own notification preferences"
    ON notification_preferences FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
    ON notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notification preferences" ON notification_preferences;
CREATE POLICY "Users can update own notification preferences"
    ON notification_preferences FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================================
-- 9.21 SHOWCASES POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can view approved showcases" ON showcases;
CREATE POLICY "Anyone can view approved showcases"
    ON showcases FOR SELECT USING (status IN ('approved', 'featured'));
DROP POLICY IF EXISTS "Authors can view own showcases" ON showcases;
CREATE POLICY "Authors can view own showcases"
    ON showcases FOR SELECT USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "Admins can view all showcases" ON showcases;
CREATE POLICY "Admins can view all showcases"
    ON showcases FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin', 'superadmin'))
    );
DROP POLICY IF EXISTS "Authenticated users can create showcases" ON showcases;
CREATE POLICY "Authenticated users can create showcases"
    ON showcases FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Authors can update pending showcases" ON showcases;
CREATE POLICY "Authors can update pending showcases"
    ON showcases FOR UPDATE USING (auth.uid() = author_id AND status = 'pending')
    WITH CHECK (auth.uid() = author_id AND status = 'pending');
DROP POLICY IF EXISTS "Admins can update any showcase" ON showcases;
CREATE POLICY "Admins can update any showcase"
    ON showcases FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin', 'superadmin'))
    );
DROP POLICY IF EXISTS "Authors can delete pending showcases" ON showcases;
CREATE POLICY "Authors can delete pending showcases"
    ON showcases FOR DELETE USING (auth.uid() = author_id AND status = 'pending');
DROP POLICY IF EXISTS "Admins can delete any showcase" ON showcases;
CREATE POLICY "Admins can delete any showcase"
    ON showcases FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- SHOWCASE_IMAGES
DROP POLICY IF EXISTS "View images of visible showcases" ON showcase_images;
CREATE POLICY "View images of visible showcases"
    ON showcase_images FOR SELECT USING (
        EXISTS (SELECT 1 FROM showcases WHERE id = showcase_images.showcase_id
            AND (status IN ('approved', 'featured') OR author_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin', 'superadmin'))))
    );
DROP POLICY IF EXISTS "Authors can insert showcase images" ON showcase_images;
CREATE POLICY "Authors can insert showcase images"
    ON showcase_images FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM showcases WHERE id = showcase_images.showcase_id AND author_id = auth.uid())
    );
DROP POLICY IF EXISTS "Authors can update showcase images" ON showcase_images;
CREATE POLICY "Authors can update showcase images"
    ON showcase_images FOR UPDATE USING (
        EXISTS (SELECT 1 FROM showcases WHERE id = showcase_images.showcase_id AND author_id = auth.uid())
    );
DROP POLICY IF EXISTS "Authors can delete showcase images" ON showcase_images;
CREATE POLICY "Authors can delete showcase images"
    ON showcase_images FOR DELETE USING (
        EXISTS (SELECT 1 FROM showcases WHERE id = showcase_images.showcase_id AND author_id = auth.uid())
    );

-- SHOWCASE_TAGS
DROP POLICY IF EXISTS "Anyone can view tags" ON showcase_tags;
CREATE POLICY "Anyone can view tags" ON showcase_tags FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can insert tags" ON showcase_tags;
CREATE POLICY "Admins can insert tags"
    ON showcase_tags FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );
DROP POLICY IF EXISTS "Admins can update tags" ON showcase_tags;
CREATE POLICY "Admins can update tags"
    ON showcase_tags FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );
DROP POLICY IF EXISTS "Admins can delete tags" ON showcase_tags;
CREATE POLICY "Admins can delete tags"
    ON showcase_tags FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- SHOWCASE_TAG_RELATIONS
DROP POLICY IF EXISTS "Anyone can view tag relations" ON showcase_tag_relations;
CREATE POLICY "Anyone can view tag relations" ON showcase_tag_relations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authors can add tags to showcases" ON showcase_tag_relations;
CREATE POLICY "Authors can add tags to showcases"
    ON showcase_tag_relations FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM showcases WHERE id = showcase_tag_relations.showcase_id AND author_id = auth.uid())
    );
DROP POLICY IF EXISTS "Authors can remove tags from showcases" ON showcase_tag_relations;
CREATE POLICY "Authors can remove tags from showcases"
    ON showcase_tag_relations FOR DELETE USING (
        EXISTS (SELECT 1 FROM showcases WHERE id = showcase_tag_relations.showcase_id AND author_id = auth.uid())
    );

-- SHOWCASE_REVIEWS
DROP POLICY IF EXISTS "Anyone can view reviews" ON showcase_reviews;
CREATE POLICY "Anyone can view reviews"
    ON showcase_reviews FOR SELECT USING (
        EXISTS (SELECT 1 FROM showcases WHERE id = showcase_reviews.showcase_id AND status IN ('approved', 'featured'))
    );
DROP POLICY IF EXISTS "Users can create reviews" ON showcase_reviews;
CREATE POLICY "Users can create reviews"
    ON showcase_reviews FOR INSERT WITH CHECK (
        auth.uid() = author_id AND EXISTS (SELECT 1 FROM showcases WHERE id = showcase_reviews.showcase_id AND status IN ('approved', 'featured'))
    );
DROP POLICY IF EXISTS "Authors can update their reviews" ON showcase_reviews;
CREATE POLICY "Authors can update their reviews"
    ON showcase_reviews FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Makers can reply to reviews" ON showcase_reviews;
CREATE POLICY "Makers can reply to reviews"
    ON showcase_reviews FOR UPDATE USING (
        EXISTS (SELECT 1 FROM showcases WHERE id = showcase_reviews.showcase_id AND author_id = auth.uid())
    );
DROP POLICY IF EXISTS "Authors can delete their reviews" ON showcase_reviews;
CREATE POLICY "Authors can delete their reviews"
    ON showcase_reviews FOR DELETE USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "Admins can delete any review" ON showcase_reviews;
CREATE POLICY "Admins can delete any review"
    ON showcase_reviews FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- =============================================================================
-- 9.22 ACTIVATION POLICIES (migration 043 final)
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can view active products" ON activation_products;
CREATE POLICY "Anyone can view active products"
    ON activation_products FOR SELECT TO authenticated
    USING (is_active = true OR is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can insert products" ON activation_products;
CREATE POLICY "Platform admins can insert products"
    ON activation_products FOR INSERT TO authenticated WITH CHECK (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can update products" ON activation_products;
CREATE POLICY "Platform admins can update products"
    ON activation_products FOR UPDATE TO authenticated
    USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can delete products" ON activation_products;
CREATE POLICY "Platform admins can delete products"
    ON activation_products FOR DELETE TO authenticated USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view own activation requests" ON activation_requests;
CREATE POLICY "Users can view own activation requests"
    ON activation_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can view all activation requests" ON activation_requests;
CREATE POLICY "Admins can view all activation requests"
    ON activation_requests FOR SELECT TO authenticated
    USING (is_platform_admin(auth.uid()) OR is_platform_moderator(auth.uid()));
DROP POLICY IF EXISTS "Only system can create activation requests" ON activation_requests;
CREATE POLICY "Only system can create activation requests"
    ON activation_requests FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "Admins can update activation requests" ON activation_requests;
CREATE POLICY "Admins can update activation requests"
    ON activation_requests FOR UPDATE TO authenticated
    USING (is_platform_admin(auth.uid()) OR is_platform_moderator(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()) OR is_platform_moderator(auth.uid()));

DROP POLICY IF EXISTS "Users can view own activation usage" ON activation_usage;
CREATE POLICY "Users can view own activation usage"
    ON activation_usage FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can view all activation usage" ON activation_usage;
CREATE POLICY "Admins can view all activation usage"
    ON activation_usage FOR SELECT TO authenticated
    USING (is_platform_admin(auth.uid()) OR is_platform_moderator(auth.uid()));

-- =============================================================================
-- 9.23 FEATURE_REQUESTS POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Authenticated users can view feature requests" ON feature_requests;
CREATE POLICY "Authenticated users can view feature requests"
    ON feature_requests FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can create feature requests" ON feature_requests;
CREATE POLICY "Authenticated users can create feature requests"
    ON feature_requests FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Authors can update own feature requests" ON feature_requests;
CREATE POLICY "Authors can update own feature requests"
    ON feature_requests FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Admins can update any feature request" ON feature_requests;
CREATE POLICY "Admins can update any feature request"
    ON feature_requests FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin', 'superadmin'))
    );
DROP POLICY IF EXISTS "Authors can delete own feature requests" ON feature_requests;
CREATE POLICY "Authors can delete own feature requests"
    ON feature_requests FOR DELETE USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "Admins can delete any feature request" ON feature_requests;
CREATE POLICY "Admins can delete any feature request"
    ON feature_requests FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- FEATURE_REQUEST_COMMENTS
DROP POLICY IF EXISTS "Authenticated users can view fr comments" ON feature_request_comments;
CREATE POLICY "Authenticated users can view fr comments"
    ON feature_request_comments FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can create fr comments" ON feature_request_comments;
CREATE POLICY "Authenticated users can create fr comments"
    ON feature_request_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Authors can update own fr comments" ON feature_request_comments;
CREATE POLICY "Authors can update own fr comments"
    ON feature_request_comments FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Authors can delete own fr comments" ON feature_request_comments;
CREATE POLICY "Authors can delete own fr comments"
    ON feature_request_comments FOR DELETE USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "Admins can delete any fr comment" ON feature_request_comments;
CREATE POLICY "Admins can delete any fr comment"
    ON feature_request_comments FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- =============================================================================
-- 9.24 FOLLOWS POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON follows;
CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can follow others" ON follows;
CREATE POLICY "Users can follow others" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS "Users can unfollow" ON follows;
CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- =============================================================================
-- 9.25 LIVE_SESSIONS POLICIES (migration 054 final)
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage live sessions" ON live_sessions;
CREATE POLICY "Admins can manage live sessions"
    ON live_sessions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

DROP POLICY IF EXISTS "Premium users can view live sessions" ON live_sessions;
CREATE POLICY "Premium users can view live sessions"
    ON live_sessions FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND (role IN ('admin', 'superadmin', 'moderator') OR membership_type = 'premium'))
        OR has_premium_access(auth.uid())
    );

-- LIVE_SESSION_RSVPS
DROP POLICY IF EXISTS "Users can manage own RSVPs" ON live_session_rsvps;
CREATE POLICY "Users can manage own RSVPs"
    ON live_session_rsvps FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can view all RSVPs" ON live_session_rsvps;
CREATE POLICY "Admins can view all RSVPs"
    ON live_session_rsvps FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );
DROP POLICY IF EXISTS "Admins can delete RSVPs" ON live_session_rsvps;
CREATE POLICY "Admins can delete RSVPs"
    ON live_session_rsvps FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- LIVE_SESSION_MESSAGES
DROP POLICY IF EXISTS "Premium users can view live chat" ON live_session_messages;
CREATE POLICY "Premium users can view live chat"
    ON live_session_messages FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND (role IN ('admin', 'superadmin', 'moderator') OR membership_type = 'premium'))
        OR has_premium_access(auth.uid())
    );
DROP POLICY IF EXISTS "Premium users can send live chat messages" ON live_session_messages;
CREATE POLICY "Premium users can send live chat messages"
    ON live_session_messages FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid() AND (
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                AND (role IN ('admin', 'superadmin', 'moderator') OR membership_type = 'premium'))
            OR has_premium_access(auth.uid())
        )
    );
DROP POLICY IF EXISTS "Users can delete own live chat messages" ON live_session_messages;
CREATE POLICY "Users can delete own live chat messages"
    ON live_session_messages FOR DELETE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can delete any live chat message" ON live_session_messages;
CREATE POLICY "Admins can delete any live chat message"
    ON live_session_messages FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- =============================================================================
-- 9.26 COMMENT_VOTES POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Comment votes are viewable by everyone" ON comment_votes;
CREATE POLICY "Comment votes are viewable by everyone" ON comment_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can add comment votes" ON comment_votes;
CREATE POLICY "Users can add comment votes" ON comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their comment votes" ON comment_votes;
CREATE POLICY "Users can update their comment votes"
    ON comment_votes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their comment votes" ON comment_votes;
CREATE POLICY "Users can delete their comment votes" ON comment_votes FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 9.27 MODULES POLICIES (migration 058)
-- =============================================================================
DROP POLICY IF EXISTS "Group members can view modules" ON modules;
CREATE POLICY "Group members can view modules"
    ON modules FOR SELECT USING (is_group_member(group_id, auth.uid()) OR is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Group admins can create modules" ON modules;
CREATE POLICY "Group admins can create modules"
    ON modules FOR INSERT WITH CHECK (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Group admins can update modules" ON modules;
CREATE POLICY "Group admins can update modules"
    ON modules FOR UPDATE USING (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Group admins can delete modules" ON modules;
CREATE POLICY "Group admins can delete modules"
    ON modules FOR DELETE USING (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

-- LESSON_COMPLETIONS
DROP POLICY IF EXISTS "Users can view own completions" ON lesson_completions;
CREATE POLICY "Users can view own completions"
    ON lesson_completions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can mark lessons complete" ON lesson_completions;
CREATE POLICY "Users can mark lessons complete"
    ON lesson_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can unmark lessons" ON lesson_completions;
CREATE POLICY "Users can unmark lessons"
    ON lesson_completions FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 9.28 STRIPE POLICIES (migration 059)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own stripe customer" ON stripe_customers;
CREATE POLICY "Users can view own stripe customer"
    ON stripe_customers FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own stripe subscriptions" ON stripe_subscriptions;
CREATE POLICY "Users can view own stripe subscriptions"
    ON stripe_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());


-- #############################################################################
-- SECTION 10: TABLE-LEVEL GRANTS
-- #############################################################################

-- Feature requests
GRANT SELECT, INSERT, UPDATE, DELETE ON feature_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON feature_request_comments TO authenticated;
GRANT SELECT ON feature_requests TO anon;
GRANT SELECT ON feature_request_comments TO anon;

-- Follows
GRANT SELECT ON follows TO anon;
GRANT SELECT, INSERT, DELETE ON follows TO authenticated;

-- Live sessions
GRANT ALL ON live_sessions TO service_role;
GRANT ALL ON live_sessions TO authenticated;
GRANT ALL ON live_session_rsvps TO service_role;
GRANT ALL ON live_session_rsvps TO authenticated;
GRANT ALL ON live_session_messages TO service_role;
GRANT ALL ON live_session_messages TO authenticated;

-- Modules and lesson completions
GRANT SELECT, INSERT, UPDATE, DELETE ON modules TO authenticated;
GRANT SELECT, INSERT, DELETE ON lesson_completions TO authenticated;

-- Function grants
GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_premium_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_moderator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reset_tokens() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.toggle_reaction(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_comment_vote(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_activation(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_remaining_activations(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_activation_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_for_period(UUID, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_rank(UUID, UUID, DATE, DATE) TO authenticated;


-- #############################################################################
-- SECTION 11: SEED DATA
-- #############################################################################

-- Default showcase tags
INSERT INTO showcase_tags (name, slug, color) VALUES
    ('Open Source', 'open-source', '#22C55E'),
    ('AI/ML', 'ai-ml', '#8B5CF6'),
    ('No-Code', 'no-code', '#F59E0B'),
    ('Developer Tool', 'developer-tool', '#3B82F6'),
    ('Productivity', 'productivity', '#EC4899'),
    ('Design', 'design', '#14B8A6'),
    ('Marketing', 'marketing', '#F97316'),
    ('Finance', 'finance', '#06B6D4'),
    ('Education', 'education', '#84CC16'),
    ('Social', 'social', '#EF4444')
ON CONFLICT (slug) DO NOTHING;


-- #############################################################################
-- SECTION 12: REALTIME (Optional - Supabase specific)
-- #############################################################################

-- Enable realtime for live sessions
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE live_session_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- SECTION 13: FIRST ADMIN SETUP
-- =============================================================================
-- Use this function to promote the first user to superadmin.
-- Run in SQL Editor AFTER your first user has signed up:
--
--   SELECT setup_first_admin('your-email@example.com');
--
-- This bypasses the role protection trigger since it runs as service role.
-- The function deletes itself after first use for security.

CREATE OR REPLACE FUNCTION public.setup_first_admin(admin_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id UUID;
    existing_admins INTEGER;
BEGIN
    -- Check if any superadmin already exists
    SELECT COUNT(*) INTO existing_admins FROM profiles WHERE role = 'superadmin';
    IF existing_admins > 0 THEN
        RETURN 'ERROR: A superadmin already exists. Use the admin panel to manage roles.';
    END IF;

    -- Find user by email in auth.users
    SELECT id INTO target_user_id FROM auth.users WHERE email = admin_email;
    IF target_user_id IS NULL THEN
        RETURN 'ERROR: No user found with email ' || admin_email || '. Sign up first, then run this again.';
    END IF;

    -- Promote to superadmin (trigger allows NULL auth.uid, which is the case for service role)
    UPDATE profiles
    SET role = 'superadmin', membership_type = 'premium'
    WHERE id = target_user_id;

    -- Self-destruct: drop this function after first use
    DROP FUNCTION IF EXISTS public.setup_first_admin(TEXT);

    RETURN 'SUCCESS: User ' || admin_email || ' is now a superadmin. This setup function has been removed.';
END;
$$;

-- Grant execute to service_role only (SQL Editor uses service role)
REVOKE ALL ON FUNCTION public.setup_first_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.setup_first_admin(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.setup_first_admin(TEXT) FROM anon;

-- =============================================================================
-- SCHEMA COMPLETE
-- =============================================================================
