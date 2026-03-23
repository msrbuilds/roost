-- Migration 001: Initial Database Schema for Skool Clone
-- Run this in Supabase SQL Editor
-- Created: 2026-01-17

-- =============================================================================
-- 1. PROFILES TABLE (User Profiles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    website TEXT,
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);

-- Index for username lookups
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_online ON profiles(is_online) WHERE is_online = true;

-- =============================================================================
-- 2. GROUPS TABLE (Communities/Groups)
-- =============================================================================
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    is_private BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT group_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
    CONSTRAINT group_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Index for slug lookups
CREATE INDEX idx_groups_slug ON groups(slug);
CREATE INDEX idx_groups_created_by ON groups(created_by);

-- =============================================================================
-- 3. GROUP_MEMBERS TABLE (Group Membership)
-- =============================================================================
CREATE TYPE group_role AS ENUM ('admin', 'moderator', 'member');

CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role group_role DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one user can only be in a group once
    UNIQUE(group_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_role ON group_members(role);

-- =============================================================================
-- 4. CATEGORIES TABLE (Post Categories)
-- =============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#6366f1', -- Hex color code
    icon TEXT, -- Icon name or emoji
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT category_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 50)
);

-- Index for slug lookups
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_group ON categories(group_id);

-- =============================================================================
-- 5. POSTS TABLE (Community Posts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_pinned BOOLEAN DEFAULT false,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT post_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 10000)
);

-- Indexes for efficient queries
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_group ON posts(group_id);
CREATE INDEX idx_posts_category ON posts(category_id);
CREATE INDEX idx_posts_pinned ON posts(is_pinned) WHERE is_pinned = true;
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- =============================================================================
-- 6. COMMENTS TABLE (Post Comments)
-- =============================================================================
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For threaded comments
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT comment_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 5000)
);

-- Indexes for efficient queries
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON comments(created_at ASC);

-- =============================================================================
-- 7. REACTIONS TABLE (Likes/Reactions to Posts and Comments)
-- =============================================================================
CREATE TYPE reaction_type AS ENUM ('like', 'love', 'fire', 'clap', 'think');
CREATE TYPE reactable_type AS ENUM ('post', 'comment');

CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reactable_type reactable_type NOT NULL,
    reactable_id UUID NOT NULL, -- Can be post_id or comment_id
    reaction_type reaction_type DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one user can only react once per item
    UNIQUE(user_id, reactable_type, reactable_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_reactions_user ON reactions(user_id);
CREATE INDEX idx_reactions_reactable ON reactions(reactable_type, reactable_id);

-- =============================================================================
-- 8. MESSAGES TABLE (Direct Messages)
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT message_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 5000),
    CONSTRAINT no_self_message CHECK (sender_id != recipient_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_unread ON messages(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- =============================================================================
-- 9. ASSETS TABLE (Uploaded Files/Media)
-- =============================================================================
CREATE TYPE asset_type AS ENUM ('image', 'video', 'document', 'other');

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT, -- in bytes
    mime_type TEXT,
    asset_type asset_type NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT file_size_check CHECK (file_size <= 104857600) -- 100MB max
);

-- Indexes for efficient queries
CREATE INDEX idx_assets_uploader ON assets(uploaded_by);
CREATE INDEX idx_assets_post ON assets(post_id);
CREATE INDEX idx_assets_message ON assets(message_id);
CREATE INDEX idx_assets_type ON assets(asset_type);

-- =============================================================================
-- 10. NOTIFICATIONS TABLE (User Notifications)
-- =============================================================================
CREATE TYPE notification_type AS ENUM (
    'new_comment',
    'new_reaction',
    'new_message',
    'new_follower',
    'mention',
    'group_invite',
    'group_join',
    'event_reminder'
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    link TEXT, -- URL to navigate to
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT notification_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 200)
);

-- Indexes for efficient queries
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =============================================================================
-- 11. LEADERBOARD_ENTRIES TABLE (Points and Ranking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    period_start DATE NOT NULL, -- For 30-day leaderboards
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one entry per user per group per period
    UNIQUE(user_id, group_id, period_start)
);

-- Indexes for efficient queries
CREATE INDEX idx_leaderboard_user ON leaderboard_entries(user_id);
CREATE INDEX idx_leaderboard_group ON leaderboard_entries(group_id);
CREATE INDEX idx_leaderboard_points ON leaderboard_entries(points DESC);
CREATE INDEX idx_leaderboard_period ON leaderboard_entries(period_start, period_end);

-- =============================================================================
-- 12. EVENTS TABLE (Calendar Events)
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
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT event_title_length CHECK (char_length(title) >= 2 AND char_length(title) <= 200),
    CONSTRAINT event_time_check CHECK (end_time > start_time)
);

-- Indexes for efficient queries
CREATE INDEX idx_events_group ON events(group_id);
CREATE INDEX idx_events_creator ON events(created_by);
CREATE INDEX idx_events_start_time ON events(start_time ASC);

-- =============================================================================
-- 13. EVENT_ATTENDEES TABLE (Event RSVPs)
-- =============================================================================
CREATE TYPE rsvp_status AS ENUM ('going', 'maybe', 'not_going');

CREATE TABLE IF NOT EXISTS event_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status rsvp_status DEFAULT 'going',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one RSVP per user per event
    UNIQUE(event_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX idx_event_attendees_user ON event_attendees(user_id);
CREATE INDEX idx_event_attendees_status ON event_attendees(status);

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
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

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 001: Initial schema created successfully!';
END $$;
