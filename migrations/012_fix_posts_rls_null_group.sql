-- Migration 012: Fix Posts RLS Policies for NULL group_id
-- This allows posts with NULL group_id (general/community-wide posts)
-- Run this in Supabase SQL Editor
-- Created: 2026-01-27

-- =============================================================================
-- DROP EXISTING POSTS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Posts viewable by group members" ON posts;
DROP POLICY IF EXISTS "Group members can create posts" ON posts;
DROP POLICY IF EXISTS "Authors and admins can update posts" ON posts;
DROP POLICY IF EXISTS "Authors and admins can delete posts" ON posts;

-- =============================================================================
-- CREATE NEW POSTS POLICIES (WITH NULL group_id SUPPORT)
-- =============================================================================

-- Posts are viewable by:
-- 1. Everyone if group_id is NULL (general/community feed)
-- 2. Group members if group_id is set
CREATE POLICY "Posts viewable by everyone or group members"
    ON posts FOR SELECT
    USING (
        group_id IS NULL  -- General feed posts visible to all authenticated users
        OR is_group_member(group_id, auth.uid())  -- Group posts visible to members
    );

-- Authenticated users can create posts:
-- 1. With NULL group_id (general feed posts)
-- 2. In groups they are members of
CREATE POLICY "Authenticated users can create posts"
    ON posts FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
        AND (
            group_id IS NULL  -- Allow general feed posts
            OR is_group_member(group_id, auth.uid())  -- Or group posts if member
        )
    );

-- Authors can update their own posts
-- Admins/Mods can update any post in their group (for pinning)
CREATE POLICY "Authors and admins can update posts"
    ON posts FOR UPDATE
    USING (
        auth.uid() = author_id
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    )
    WITH CHECK (
        auth.uid() = author_id
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

-- Authors can delete their own posts
-- Admins/Mods can delete any post in their group
CREATE POLICY "Authors and admins can delete posts"
    ON posts FOR DELETE
    USING (
        auth.uid() = author_id
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 012: Posts RLS policies updated successfully!';
    RAISE NOTICE '📝 Posts with NULL group_id are now allowed for general feed.';
END $$;
