-- Migration 018: Fix Categories RLS for Platform Admins
-- Run this in Supabase SQL Editor
-- Created: 2026-01-30
--
-- Issue: Platform admins cannot create/manage global categories (group_id = NULL)
-- because existing policies only check is_group_admin_or_mod which fails for NULL group_id

-- =============================================================================
-- 1. DROP EXISTING CATEGORY POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Categories viewable by group members" ON categories;
DROP POLICY IF EXISTS "Group admins can create categories" ON categories;
DROP POLICY IF EXISTS "Group admins can update categories" ON categories;
DROP POLICY IF EXISTS "Group admins can delete categories" ON categories;
DROP POLICY IF EXISTS "Platform admins can manage categories" ON categories;

-- =============================================================================
-- 2. CREATE NEW CATEGORY POLICIES WITH PLATFORM ADMIN SUPPORT
-- =============================================================================

-- Categories are viewable by:
-- 1. Global categories (group_id IS NULL) - all authenticated users
-- 2. Group categories - group members
-- 3. Platform admins - all categories
CREATE POLICY "Categories viewable by authenticated users"
    ON categories FOR SELECT
    TO authenticated
    USING (
        group_id IS NULL
        OR is_group_member(group_id, auth.uid())
        OR is_platform_admin(auth.uid())
    );

-- Platform admins can create any category (global or group-specific)
-- Group admins can create categories for their groups
CREATE POLICY "Admins can create categories"
    ON categories FOR INSERT
    TO authenticated
    WITH CHECK (
        is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

-- Platform admins can update any category
-- Group admins can update their group's categories
CREATE POLICY "Admins can update categories"
    ON categories FOR UPDATE
    TO authenticated
    USING (
        is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    )
    WITH CHECK (
        is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

-- Platform admins can delete any category
-- Group admins can delete their group's categories
CREATE POLICY "Admins can delete categories"
    ON categories FOR DELETE
    TO authenticated
    USING (
        is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 018: Categories RLS policies fixed!';
    RAISE NOTICE '📁 Platform admins can now create/manage global categories';
    RAISE NOTICE '📁 Group admins can still manage their group categories';
END $$;
