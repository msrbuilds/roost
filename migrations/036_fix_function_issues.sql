-- Migration: Fix broken functions after security migrations
-- Issues:
-- 1. has_premium_access: parameter renamed from p_user_id to user_uuid (breaks frontend)
-- 2. is_platform_admin/moderator/superadmin/get_user_role: reference platform_role but column is named 'role'

-- ============================================================================
-- 1. FIX has_active_subscription - restore original parameter name
-- ============================================================================

DROP FUNCTION IF EXISTS public.has_active_subscription(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.gumroad_subscriptions
        WHERE user_id = p_user_id
        AND status = 'active'
        AND (current_period_end IS NULL OR current_period_end > NOW())
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated;

-- ============================================================================
-- 2. FIX has_premium_access - restore original parameter name and logic
-- ============================================================================

DROP FUNCTION IF EXISTS public.has_premium_access(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.has_premium_access(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_membership_type TEXT;
BEGIN
    -- Check if membership_type is premium
    SELECT membership_type INTO v_membership_type
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_membership_type = 'premium' THEN
        RETURN TRUE;
    END IF;

    -- Fall back to checking active subscription
    RETURN public.has_active_subscription(p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_premium_access(UUID) TO authenticated;

-- ============================================================================
-- 3. FIX can_access_group - restore original parameter names
-- ============================================================================

DROP FUNCTION IF EXISTS public.can_access_group(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.can_access_group(p_user_id UUID, p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_is_premium BOOLEAN;
BEGIN
    -- Get group's premium status
    SELECT is_premium INTO v_is_premium
    FROM public.groups
    WHERE id = p_group_id;

    -- If group is not premium, anyone can access
    IF NOT COALESCE(v_is_premium, false) THEN
        RETURN TRUE;
    END IF;

    -- For premium groups, check if user has premium access
    RETURN public.has_premium_access(p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_group(UUID, UUID) TO authenticated;

-- ============================================================================
-- 4. FIX platform role functions - use correct column name 'role'
-- ============================================================================

-- Fix is_platform_admin
DROP FUNCTION IF EXISTS public.is_platform_admin(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.is_platform_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid
        AND role IN ('admin', 'superadmin')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;

-- Fix is_platform_moderator
DROP FUNCTION IF EXISTS public.is_platform_moderator(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.is_platform_moderator(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid
        AND role IN ('moderator', 'admin', 'superadmin')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_moderator(UUID) TO authenticated;

-- Fix is_superadmin
DROP FUNCTION IF EXISTS public.is_superadmin(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.is_superadmin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid
        AND role = 'superadmin'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_superadmin(UUID) TO authenticated;

-- Fix get_user_role
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role::TEXT INTO user_role
    FROM public.profiles
    WHERE id = user_uuid;
    RETURN COALESCE(user_role, 'user');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;

-- ============================================================================
-- 5. RECREATE RLS POLICIES THAT DEPEND ON THESE FUNCTIONS
-- ============================================================================

-- Announcements policies
DROP POLICY IF EXISTS "Active announcements are viewable by authenticated users" ON public.announcements;
DROP POLICY IF EXISTS "Platform admins can view all announcements" ON public.announcements;
DROP POLICY IF EXISTS "Platform admins can create announcements" ON public.announcements;
DROP POLICY IF EXISTS "Platform admins can update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Platform admins can delete announcements" ON public.announcements;

CREATE POLICY "Active announcements are viewable by authenticated users"
    ON public.announcements FOR SELECT
    TO authenticated
    USING (
        is_active = true
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (
            scope = 'global'
            OR (scope = 'group' AND public.is_group_member(group_id, auth.uid()))
        )
    );

CREATE POLICY "Platform admins can view all announcements"
    ON public.announcements FOR SELECT
    TO authenticated
    USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can create announcements"
    ON public.announcements FOR INSERT
    TO authenticated
    WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update announcements"
    ON public.announcements FOR UPDATE
    TO authenticated
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete announcements"
    ON public.announcements FOR DELETE
    TO authenticated
    USING (public.is_platform_admin(auth.uid()));

-- Groups policies that use is_platform_admin
DROP POLICY IF EXISTS "Groups are viewable based on privacy" ON public.groups;
DROP POLICY IF EXISTS "Group creators and platform admins can update groups" ON public.groups;
DROP POLICY IF EXISTS "Group creators and platform admins can delete groups" ON public.groups;

CREATE POLICY "Groups are viewable based on privacy"
    ON public.groups FOR SELECT
    USING (
        is_private = false
        OR public.is_group_member(id, auth.uid())
        OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "Group creators and platform admins can update groups"
    ON public.groups FOR UPDATE
    USING (
        auth.uid() = created_by
        OR public.is_platform_admin(auth.uid())
    )
    WITH CHECK (
        auth.uid() = created_by
        OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "Group creators and platform admins can delete groups"
    ON public.groups FOR DELETE
    USING (
        auth.uid() = created_by
        OR public.is_platform_admin(auth.uid())
    );

-- Group members policies
DROP POLICY IF EXISTS "Group members viewable by members and platform admins" ON public.group_members;
DROP POLICY IF EXISTS "Platform admins can manage group members" ON public.group_members;

CREATE POLICY "Group members viewable by members and platform admins"
    ON public.group_members FOR SELECT
    USING (
        public.is_group_member(group_id, auth.uid())
        OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "Platform admins can manage group members"
    ON public.group_members FOR ALL
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

-- Posts policies
DROP POLICY IF EXISTS "Posts viewable by group members and platform admins" ON public.posts;
DROP POLICY IF EXISTS "Authors, group admins, and platform mods can delete posts" ON public.posts;

CREATE POLICY "Posts viewable by group members and platform admins"
    ON public.posts FOR SELECT
    USING (
        public.is_group_member(group_id, auth.uid())
        OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "Authors, group admins, and platform mods can delete posts"
    ON public.posts FOR DELETE
    USING (
        auth.uid() = author_id
        OR public.is_group_admin_or_mod(group_id, auth.uid())
        OR public.is_platform_moderator(auth.uid())
    );

-- Comments policies
DROP POLICY IF EXISTS "Authors, group admins, and platform mods can delete comments" ON public.comments;

CREATE POLICY "Authors, group admins, and platform mods can delete comments"
    ON public.comments FOR DELETE
    USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM public.posts
            WHERE posts.id = post_id
            AND (
                auth.uid() = posts.author_id
                OR public.is_group_admin_or_mod(posts.group_id, auth.uid())
            )
        )
        OR public.is_platform_moderator(auth.uid())
    );

-- Events policies
DROP POLICY IF EXISTS "Events viewable by group members and platform admins" ON public.events;
DROP POLICY IF EXISTS "Creators, group admins, and platform admins can update events" ON public.events;
DROP POLICY IF EXISTS "Creators, group admins, and platform admins can delete events" ON public.events;

CREATE POLICY "Events viewable by group members and platform admins"
    ON public.events FOR SELECT
    USING (
        (group_id IS NULL)
        OR public.is_group_member(group_id, auth.uid())
        OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "Creators, group admins, and platform admins can update events"
    ON public.events FOR UPDATE
    USING (
        auth.uid() = created_by
        OR (group_id IS NOT NULL AND public.is_group_admin_or_mod(group_id, auth.uid()))
        OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "Creators, group admins, and platform admins can delete events"
    ON public.events FOR DELETE
    USING (
        auth.uid() = created_by
        OR (group_id IS NOT NULL AND public.is_group_admin_or_mod(group_id, auth.uid()))
        OR public.is_platform_admin(auth.uid())
    );

-- Profiles policy
DROP POLICY IF EXISTS "Platform admins can update any profile" ON public.profiles;

CREATE POLICY "Platform admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (public.is_platform_admin(auth.uid()));

-- Categories policies
DROP POLICY IF EXISTS "Categories viewable by authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Admins can create categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;

CREATE POLICY "Categories viewable by authenticated users"
    ON public.categories FOR SELECT
    TO authenticated
    USING (
        group_id IS NULL
        OR public.is_group_member(group_id, auth.uid())
        OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "Admins can create categories"
    ON public.categories FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND public.is_group_admin_or_mod(group_id, auth.uid()))
    );

CREATE POLICY "Admins can update categories"
    ON public.categories FOR UPDATE
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND public.is_group_admin_or_mod(group_id, auth.uid()))
    )
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND public.is_group_admin_or_mod(group_id, auth.uid()))
    );

CREATE POLICY "Admins can delete categories"
    ON public.categories FOR DELETE
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND public.is_group_admin_or_mod(group_id, auth.uid()))
    );

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 036: Fixed function issues!';
    RAISE NOTICE '🔧 has_active_subscription: restored p_user_id parameter name';
    RAISE NOTICE '🔧 has_premium_access: restored p_user_id parameter name and original logic';
    RAISE NOTICE '🔧 can_access_group: restored p_user_id, p_group_id parameter names';
    RAISE NOTICE '🔧 Platform role functions: fixed to use "role" column instead of "platform_role"';
    RAISE NOTICE '🔧 Recreated all dependent RLS policies';
END $$;
