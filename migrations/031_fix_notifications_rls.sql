-- Migration: Fix RLS policy "System can create notifications"
-- This policy uses WITH CHECK (true) which is flagged as overly permissive
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy

-- The "System can create notifications" policy is intended for trigger-based notification creation
-- Since notifications are created by SECURITY DEFINER triggers, regular users should NOT be able
-- to directly insert notifications. The service_role bypasses RLS anyway.

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Drop any existing notification policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can create notifications as actor" ON public.notifications;
DROP POLICY IF EXISTS "Service role can create notifications" ON public.notifications;

-- ============================================================================
-- NOTIFICATION POLICIES
-- ============================================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Notifications are created by SECURITY DEFINER trigger functions, which bypass RLS.
-- We do NOT create an INSERT policy for authenticated users - notifications should only
-- be created by system triggers, not directly by users.
--
-- The service_role bypasses RLS entirely, so it doesn't need an explicit policy.
-- Removing the "WITH CHECK (true)" policy prevents any potential direct INSERT abuse
-- while trigger functions (with SECURITY DEFINER) continue to work normally.

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 031: Notifications RLS policy fixed!';
    RAISE NOTICE '🔒 Removed overly permissive INSERT policy';
    RAISE NOTICE '📧 Notifications are now created only by SECURITY DEFINER triggers';
END $$;
