-- Migration 004: Make group_id nullable in posts table
-- This allows posts to exist independently of groups (for the main community feed)
-- Run this in Supabase SQL Editor
-- Created: 2026-01-23

-- =============================================================================
-- 1. Make group_id nullable in posts table
-- =============================================================================

-- Drop the NOT NULL constraint on group_id
ALTER TABLE posts
ALTER COLUMN group_id DROP NOT NULL;

-- Update the index to include posts with null group_id
DROP INDEX IF EXISTS idx_posts_group;
CREATE INDEX idx_posts_group ON posts(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_posts_no_group ON posts(created_at DESC) WHERE group_id IS NULL;

-- =============================================================================
-- 2. Update RLS Policies for posts with null group_id
-- =============================================================================

-- Drop existing posts SELECT policy
DROP POLICY IF EXISTS "posts_select_policy" ON posts;

-- Recreate SELECT policy to handle both group posts and general posts
CREATE POLICY "posts_select_policy" ON posts
FOR SELECT USING (
    -- General posts (no group) are visible to all authenticated users
    group_id IS NULL
    OR
    -- Public group posts are visible to members
    (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = posts.group_id
            AND groups.is_private = false
        )
        AND is_group_member(posts.group_id, auth.uid())
    )
    OR
    -- Private group posts are only visible to members
    (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = posts.group_id
            AND groups.is_private = true
        )
        AND is_group_member(posts.group_id, auth.uid())
    )
    OR
    -- Platform admins can see all posts
    is_platform_admin(auth.uid())
);

-- Drop existing posts INSERT policy
DROP POLICY IF EXISTS "posts_insert_policy" ON posts;

-- Recreate INSERT policy to handle both group posts and general posts
CREATE POLICY "posts_insert_policy" ON posts
FOR INSERT WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    AND
    -- Must be the author
    author_id = auth.uid()
    AND
    (
        -- General posts (no group) allowed for all authenticated users
        group_id IS NULL
        OR
        -- Group posts require membership
        is_group_member(group_id, auth.uid())
    )
);

-- Drop existing posts UPDATE policy
DROP POLICY IF EXISTS "posts_update_policy" ON posts;

-- Recreate UPDATE policy to handle both group posts and general posts
CREATE POLICY "posts_update_policy" ON posts
FOR UPDATE USING (
    -- Author can edit their own posts
    author_id = auth.uid()
    OR
    -- Group admins/mods can edit posts in their group
    (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    OR
    -- Platform admins can edit any post
    is_platform_admin(auth.uid())
);

-- Drop existing posts DELETE policy
DROP POLICY IF EXISTS "posts_delete_policy" ON posts;

-- Recreate DELETE policy to handle both group posts and general posts
CREATE POLICY "posts_delete_policy" ON posts
FOR DELETE USING (
    -- Author can delete their own posts
    author_id = auth.uid()
    OR
    -- Group admins/mods can delete posts in their group
    (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    OR
    -- Platform admins can delete any post
    is_platform_admin(auth.uid())
);

-- =============================================================================
-- 3. Update group_members INSERT policy to allow group creators to add themselves
-- =============================================================================

-- Drop existing group_members INSERT policy
DROP POLICY IF EXISTS "Users can join groups" ON group_members;

-- Recreate INSERT policy to allow:
-- 1. Group creators to add themselves with any role (especially admin)
-- 2. Users to join public groups
-- 3. Group admins/mods to add other users
-- 4. Platform admins to add anyone
CREATE POLICY "Users can join groups" ON group_members
FOR INSERT WITH CHECK (
    -- Platform admins can add anyone
    is_platform_admin(auth.uid())
    OR
    -- Group creator adding themselves (when creating the group)
    (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_id
            AND groups.created_by = auth.uid()
        )
    )
    OR
    -- Group admins/mods can add members
    (
        is_group_admin_or_mod(group_id, auth.uid())
    )
    OR
    -- Users can join public groups themselves
    (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_id
            AND is_private = false
        )
    )
);

-- =============================================================================
-- 4. Restrict classroom creation to platform admins only
-- =============================================================================

-- Drop existing groups INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;

-- Recreate INSERT policy to only allow platform admins to create classrooms
CREATE POLICY "Platform admins can create groups" ON groups
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = created_by
    AND is_platform_admin(auth.uid())
);

-- =============================================================================
-- 5. Update helper functions
-- =============================================================================

-- No changes needed to helper functions as they already handle null values correctly
