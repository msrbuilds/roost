-- Migration 002: Row Level Security (RLS) Policies
-- Run this in Supabase SQL Editor AFTER running 001_initial_schema.sql
-- Created: 2026-01-17

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
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

-- =============================================================================
-- HELPER FUNCTIONS FOR RLS POLICIES
-- =============================================================================

-- Check if user is a group member
CREATE OR REPLACE FUNCTION is_group_member(group_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = $1
        AND group_members.user_id = $2
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a group admin or moderator
CREATE OR REPLACE FUNCTION is_group_admin_or_mod(group_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = $1
        AND group_members.user_id = $2
        AND group_members.role IN ('admin', 'moderator')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PROFILES TABLE POLICIES
-- =============================================================================

-- Anyone can view profiles
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "Users can delete their own profile"
    ON profiles FOR DELETE
    USING (auth.uid() = id);

-- =============================================================================
-- GROUPS TABLE POLICIES
-- =============================================================================

-- Public groups are viewable by everyone
-- Private groups are viewable by members only
CREATE POLICY "Groups are viewable based on privacy"
    ON groups FOR SELECT
    USING (
        is_private = false
        OR is_group_member(id, auth.uid())
    );

-- Authenticated users can create groups
CREATE POLICY "Authenticated users can create groups"
    ON groups FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

-- Group creators can update their groups
CREATE POLICY "Group creators can update their groups"
    ON groups FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- Group creators can delete their groups
CREATE POLICY "Group creators can delete their groups"
    ON groups FOR DELETE
    USING (auth.uid() = created_by);

-- =============================================================================
-- GROUP_MEMBERS TABLE POLICIES
-- =============================================================================

-- Group members are viewable by group members
CREATE POLICY "Group members viewable by group members"
    ON group_members FOR SELECT
    USING (is_group_member(group_id, auth.uid()));

-- Users can join public groups
CREATE POLICY "Users can join groups"
    ON group_members FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            -- Join public groups freely
            EXISTS (SELECT 1 FROM groups WHERE groups.id = group_id AND is_private = false)
            -- Or if already invited (future feature)
        )
    );

-- Users can leave groups (delete their own membership)
CREATE POLICY "Users can leave groups"
    ON group_members FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can update member roles
CREATE POLICY "Admins can update member roles"
    ON group_members FOR UPDATE
    USING (is_group_admin_or_mod(group_id, auth.uid()));

-- =============================================================================
-- CATEGORIES TABLE POLICIES
-- =============================================================================

-- Categories are viewable by group members
CREATE POLICY "Categories viewable by group members"
    ON categories FOR SELECT
    USING (
        group_id IS NULL -- Global categories
        OR is_group_member(group_id, auth.uid())
    );

-- Group admins can manage categories
CREATE POLICY "Group admins can create categories"
    ON categories FOR INSERT
    WITH CHECK (is_group_admin_or_mod(group_id, auth.uid()));

CREATE POLICY "Group admins can update categories"
    ON categories FOR UPDATE
    USING (is_group_admin_or_mod(group_id, auth.uid()));

CREATE POLICY "Group admins can delete categories"
    ON categories FOR DELETE
    USING (is_group_admin_or_mod(group_id, auth.uid()));

-- =============================================================================
-- POSTS TABLE POLICIES
-- =============================================================================

-- Posts are viewable by group members
CREATE POLICY "Posts viewable by group members"
    ON posts FOR SELECT
    USING (is_group_member(group_id, auth.uid()));

-- Group members can create posts
CREATE POLICY "Group members can create posts"
    ON posts FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
        AND is_group_member(group_id, auth.uid())
    );

-- Authors can update their own posts
-- Admins/Mods can update any post (for pinning)
CREATE POLICY "Authors and admins can update posts"
    ON posts FOR UPDATE
    USING (
        auth.uid() = author_id
        OR is_group_admin_or_mod(group_id, auth.uid())
    );

-- Authors can delete their own posts
-- Admins/Mods can delete any post
CREATE POLICY "Authors and admins can delete posts"
    ON posts FOR DELETE
    USING (
        auth.uid() = author_id
        OR is_group_admin_or_mod(group_id, auth.uid())
    );

-- =============================================================================
-- COMMENTS TABLE POLICIES
-- =============================================================================

-- Comments are viewable by anyone who can see the post
CREATE POLICY "Comments viewable with posts"
    ON comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM posts
            WHERE posts.id = post_id
            AND is_group_member(posts.group_id, auth.uid())
        )
    );

-- Authenticated users can create comments on posts they can see
CREATE POLICY "Users can create comments"
    ON comments FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
        AND EXISTS (
            SELECT 1 FROM posts
            WHERE posts.id = post_id
            AND is_group_member(posts.group_id, auth.uid())
        )
    );

-- Authors can update their own comments
CREATE POLICY "Authors can update their comments"
    ON comments FOR UPDATE
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

-- Authors can delete their own comments
-- Post authors and admins can delete any comment on their posts
CREATE POLICY "Authors and admins can delete comments"
    ON comments FOR DELETE
    USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM posts
            WHERE posts.id = post_id
            AND (
                auth.uid() = posts.author_id
                OR is_group_admin_or_mod(posts.group_id, auth.uid())
            )
        )
    );

-- =============================================================================
-- REACTIONS TABLE POLICIES
-- =============================================================================

-- Reactions are viewable by everyone (to show counts)
CREATE POLICY "Reactions are viewable by everyone"
    ON reactions FOR SELECT
    USING (true);

-- Users can add reactions
CREATE POLICY "Users can add reactions"
    ON reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own reactions (change reaction type)
CREATE POLICY "Users can update their reactions"
    ON reactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can delete their reactions"
    ON reactions FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- ASSETS TABLE POLICIES
-- =============================================================================

-- Assets are viewable by everyone who can see the associated post/message
CREATE POLICY "Assets are viewable based on context"
    ON assets FOR SELECT
    USING (
        -- Public access (for now, refine later based on post/message visibility)
        true
    );

-- Users can upload assets
CREATE POLICY "Users can upload assets"
    ON assets FOR INSERT
    WITH CHECK (auth.uid() = uploaded_by);

-- Uploaders can delete their own assets
CREATE POLICY "Uploaders can delete their assets"
    ON assets FOR DELETE
    USING (auth.uid() = uploaded_by);

-- =============================================================================
-- MESSAGES TABLE POLICIES
-- =============================================================================

-- Users can view messages where they are sender or recipient
CREATE POLICY "Users can view their messages"
    ON messages FOR SELECT
    USING (
        auth.uid() = sender_id
        OR auth.uid() = recipient_id
    );

-- Users can send messages
CREATE POLICY "Users can send messages"
    ON messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Recipients can update messages (mark as read)
CREATE POLICY "Recipients can update messages"
    ON messages FOR UPDATE
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- Senders and recipients can delete messages
CREATE POLICY "Users can delete their messages"
    ON messages FOR DELETE
    USING (
        auth.uid() = sender_id
        OR auth.uid() = recipient_id
    );

-- =============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- =============================================================================

-- Users can view their own notifications
CREATE POLICY "Users can view their notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- System can create notifications (INSERT allowed for functions)
CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- Users can update their notifications (mark as read)
CREATE POLICY "Users can update their notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- LEADERBOARD_ENTRIES TABLE POLICIES
-- =============================================================================

-- Leaderboard entries are viewable by group members
CREATE POLICY "Leaderboard viewable by group members"
    ON leaderboard_entries FOR SELECT
    USING (
        group_id IS NULL -- Global leaderboard
        OR is_group_member(group_id, auth.uid())
    );

-- System/Functions can manage leaderboard entries
CREATE POLICY "System can manage leaderboard"
    ON leaderboard_entries FOR ALL
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- EVENTS TABLE POLICIES
-- =============================================================================

-- Events are viewable by group members
CREATE POLICY "Events viewable by group members"
    ON events FOR SELECT
    USING (is_group_member(group_id, auth.uid()));

-- Group members can create events
CREATE POLICY "Group members can create events"
    ON events FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
        AND is_group_member(group_id, auth.uid())
    );

-- Event creators and admins can update events
CREATE POLICY "Creators and admins can update events"
    ON events FOR UPDATE
    USING (
        auth.uid() = created_by
        OR is_group_admin_or_mod(group_id, auth.uid())
    );

-- Event creators and admins can delete events
CREATE POLICY "Creators and admins can delete events"
    ON events FOR DELETE
    USING (
        auth.uid() = created_by
        OR is_group_admin_or_mod(group_id, auth.uid())
    );

-- =============================================================================
-- EVENT_ATTENDEES TABLE POLICIES
-- =============================================================================

-- Event attendees are viewable by group members
CREATE POLICY "Event attendees viewable by group members"
    ON event_attendees FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_id
            AND is_group_member(events.group_id, auth.uid())
        )
    );

-- Users can RSVP to events
CREATE POLICY "Users can RSVP to events"
    ON event_attendees FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_id
            AND is_group_member(events.group_id, auth.uid())
        )
    );

-- Users can update their own RSVP
CREATE POLICY "Users can update their RSVP"
    ON event_attendees FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own RSVP
CREATE POLICY "Users can delete their RSVP"
    ON event_attendees FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 002: RLS policies created successfully!';
    RAISE NOTICE '🔒 All tables are now protected with Row Level Security.';
END $$;
