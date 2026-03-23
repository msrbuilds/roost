-- =====================================================
-- Migration 020: Fix Group Members RLS Policy
-- Created: 2026-02-01
-- Purpose: Allow users to check membership and join public groups
-- IMPORTANT: Run this AFTER running the rollback if you already applied the broken version
-- =====================================================

-- The current policy requires being a member to SELECT from group_members,
-- which creates a chicken-and-egg problem when trying to join a group.
-- The joinGroup function first checks if user is already a member (SELECT),
-- but that SELECT fails because the user isn't a member yet.

-- PROBLEM: We cannot reference group_members within its own RLS policy
-- because that creates infinite recursion. We need to use SECURITY DEFINER
-- functions to bypass RLS when checking membership.

-- =====================================================
-- 0. DROP ALL EXISTING POLICIES FIRST (clean slate)
-- =====================================================

DROP POLICY IF EXISTS "Group members viewable by group members" ON group_members;
DROP POLICY IF EXISTS "Group members viewable appropriately" ON group_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON group_members;
DROP POLICY IF EXISTS "Admins can add members to groups" ON group_members;
DROP POLICY IF EXISTS "Admins can remove members from groups" ON group_members;

-- =====================================================
-- 1. CREATE SECURITY DEFINER HELPER FUNCTIONS
-- These bypass RLS to check membership without recursion
-- =====================================================

-- Function to check if a user is a member of a group (bypasses RLS)
CREATE OR REPLACE FUNCTION check_group_membership(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if a user is admin/mod of a group (bypasses RLS)
CREATE OR REPLACE FUNCTION check_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
        AND user_id = p_user_id
        AND role IN ('admin', 'moderator')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if a group is public (bypasses RLS)
CREATE OR REPLACE FUNCTION is_group_public(p_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM groups
        WHERE id = p_group_id
        AND is_private = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 2. CREATE SELECT POLICY
-- =====================================================

-- Users can view group_members if:
-- 1. They are checking their own membership (user_id = auth.uid())
-- 2. They are a member of that group (checked via SECURITY DEFINER function)
-- 3. The group is public (anyone can see public group members)
CREATE POLICY "Group members viewable appropriately"
    ON group_members FOR SELECT
    USING (
        -- User can always check their own membership records
        user_id = auth.uid()
        OR
        -- Members can see other members in their groups
        check_group_membership(group_id, auth.uid())
        OR
        -- Anyone can see members of public groups
        is_group_public(group_id)
    );

-- =====================================================
-- 3. CREATE INSERT POLICY
-- =====================================================

-- Users can join groups if:
-- 1. They are inserting themselves (user_id = auth.uid())
-- 2. The role is 'member' (can't self-promote to admin)
-- 3. The group is public
-- OR they are an admin adding someone to the group
CREATE POLICY "Users can join groups"
    ON group_members FOR INSERT
    WITH CHECK (
        (
            -- Self-joining a public group
            auth.uid() = user_id
            AND role = 'member'
            AND is_group_public(group_id)
        )
        OR
        (
            -- Admin adding a member to any group
            check_group_admin(group_id, auth.uid())
        )
    );

-- =====================================================
-- 4. CREATE UPDATE POLICY
-- =====================================================

-- Only admins/mods can update member roles
CREATE POLICY "Admins can update member roles"
    ON group_members FOR UPDATE
    USING (check_group_admin(group_id, auth.uid()))
    WITH CHECK (check_group_admin(group_id, auth.uid()));

-- =====================================================
-- 5. CREATE DELETE POLICY
-- =====================================================

-- Users can leave groups (delete their own membership)
-- Admins can remove other members
CREATE POLICY "Users can leave or admins can remove"
    ON group_members FOR DELETE
    USING (
        -- User can remove themselves (leave)
        user_id = auth.uid()
        OR
        -- Admins can remove others
        check_group_admin(group_id, auth.uid())
    );

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 020: Group members RLS policies fixed!';
    RAISE NOTICE '🔓 Users can now:';
    RAISE NOTICE '   - Check their own membership status';
    RAISE NOTICE '   - View members of public groups';
    RAISE NOTICE '   - Join public groups';
    RAISE NOTICE '   - Leave any group they are in';
    RAISE NOTICE '🔑 Using SECURITY DEFINER functions to avoid infinite recursion';
END $$;
