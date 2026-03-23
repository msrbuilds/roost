-- Migration 003: Platform-Level User Roles
-- Run this in Supabase SQL Editor AFTER running 002_rls_policies.sql
-- Created: 2026-01-23

-- =============================================================================
-- 1. CREATE PLATFORM ROLE ENUM
-- =============================================================================
CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'superadmin');

-- =============================================================================
-- 2. ADD ROLE COLUMN TO PROFILES
-- =============================================================================
ALTER TABLE profiles ADD COLUMN role user_role DEFAULT 'user';

-- Index for efficient role-based queries
CREATE INDEX idx_profiles_role ON profiles(role);

-- =============================================================================
-- 3. HELPER FUNCTIONS FOR PLATFORM ROLE CHECKS
-- =============================================================================

-- Check if user is a platform admin (admin or superadmin)
CREATE OR REPLACE FUNCTION is_platform_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = $1
        AND profiles.role IN ('admin', 'superadmin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a platform moderator or higher
CREATE OR REPLACE FUNCTION is_platform_moderator(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = $1
        AND profiles.role IN ('moderator', 'admin', 'superadmin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a superadmin
CREATE OR REPLACE FUNCTION is_superadmin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = $1
        AND profiles.role = 'superadmin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's platform role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
DECLARE
    user_platform_role user_role;
BEGIN
    SELECT role INTO user_platform_role
    FROM profiles
    WHERE profiles.id = $1;

    RETURN COALESCE(user_platform_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. UPDATE RLS POLICIES FOR PLATFORM ADMIN ACCESS
-- =============================================================================

-- Platform admins can view all groups (including private)
DROP POLICY IF EXISTS "Groups are viewable based on privacy" ON groups;
CREATE POLICY "Groups are viewable based on privacy"
    ON groups FOR SELECT
    USING (
        is_private = false
        OR is_group_member(id, auth.uid())
        OR is_platform_admin(auth.uid())
    );

-- Platform admins can update any group
DROP POLICY IF EXISTS "Group creators can update their groups" ON groups;
CREATE POLICY "Group creators and platform admins can update groups"
    ON groups FOR UPDATE
    USING (
        auth.uid() = created_by
        OR is_platform_admin(auth.uid())
    )
    WITH CHECK (
        auth.uid() = created_by
        OR is_platform_admin(auth.uid())
    );

-- Platform admins can delete any group
DROP POLICY IF EXISTS "Group creators can delete their groups" ON groups;
CREATE POLICY "Group creators and platform admins can delete groups"
    ON groups FOR DELETE
    USING (
        auth.uid() = created_by
        OR is_platform_admin(auth.uid())
    );

-- Platform admins can view all group members
DROP POLICY IF EXISTS "Group members viewable by group members" ON group_members;
CREATE POLICY "Group members viewable by members and platform admins"
    ON group_members FOR SELECT
    USING (
        is_group_member(group_id, auth.uid())
        OR is_platform_admin(auth.uid())
    );

-- Platform admins can manage group memberships
CREATE POLICY "Platform admins can manage group members"
    ON group_members FOR ALL
    USING (is_platform_admin(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()));

-- Platform admins can view all posts
DROP POLICY IF EXISTS "Posts viewable by group members" ON posts;
CREATE POLICY "Posts viewable by group members and platform admins"
    ON posts FOR SELECT
    USING (
        is_group_member(group_id, auth.uid())
        OR is_platform_admin(auth.uid())
    );

-- Platform moderators can delete any post
DROP POLICY IF EXISTS "Authors and admins can delete posts" ON posts;
CREATE POLICY "Authors, group admins, and platform mods can delete posts"
    ON posts FOR DELETE
    USING (
        auth.uid() = author_id
        OR is_group_admin_or_mod(group_id, auth.uid())
        OR is_platform_moderator(auth.uid())
    );

-- Platform moderators can delete any comment
DROP POLICY IF EXISTS "Authors and admins can delete comments" ON comments;
CREATE POLICY "Authors, group admins, and platform mods can delete comments"
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
        OR is_platform_moderator(auth.uid())
    );

-- Platform admins can view all events
DROP POLICY IF EXISTS "Events viewable by group members" ON events;
CREATE POLICY "Events viewable by group members and platform admins"
    ON events FOR SELECT
    USING (
        is_group_member(group_id, auth.uid())
        OR is_platform_admin(auth.uid())
    );

-- Platform admins can manage any event
DROP POLICY IF EXISTS "Creators and admins can update events" ON events;
CREATE POLICY "Creators, group admins, and platform admins can update events"
    ON events FOR UPDATE
    USING (
        auth.uid() = created_by
        OR is_group_admin_or_mod(group_id, auth.uid())
        OR is_platform_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Creators and admins can delete events" ON events;
CREATE POLICY "Creators, group admins, and platform admins can delete events"
    ON events FOR DELETE
    USING (
        auth.uid() = created_by
        OR is_group_admin_or_mod(group_id, auth.uid())
        OR is_platform_admin(auth.uid())
    );

-- =============================================================================
-- 5. ADMIN-ONLY POLICIES FOR USER MANAGEMENT
-- =============================================================================

-- Platform admins can update any profile (for moderation)
CREATE POLICY "Platform admins can update any profile"
    ON profiles FOR UPDATE
    USING (is_platform_admin(auth.uid()));

-- Only superadmins can change user roles
-- This is enforced at application level, but we add a safeguard
CREATE OR REPLACE FUNCTION check_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If role is being changed
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- Only superadmins can change roles
        IF NOT is_superadmin(auth.uid()) THEN
            RAISE EXCEPTION 'Only superadmins can change user roles';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_role_change
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION check_role_change();

-- =============================================================================
-- 6. SEED INITIAL SUPERADMIN (Optional - Update with your user ID)
-- =============================================================================
-- Uncomment and replace with your user ID to set yourself as superadmin:
-- UPDATE profiles SET role = 'superadmin' WHERE id = 'your-user-uuid-here';

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 003: Platform roles created successfully!';
    RAISE NOTICE '👑 Role hierarchy: user < moderator < admin < superadmin';
    RAISE NOTICE '🔧 Remember to set your superadmin user in the database!';
END $$;
