-- Migration 041: Fix get_notification_preferences Function
-- Purpose: Update the function to return correct column structure
-- Created: 2026-02-08

-- =============================================================================
-- DROP AND RECREATE get_notification_preferences
-- =============================================================================

-- The old function returned TABLE with wrong column names
-- The new function returns the notification_preferences composite type

DROP FUNCTION IF EXISTS public.get_notification_preferences(UUID);

CREATE OR REPLACE FUNCTION public.get_notification_preferences(p_user_id UUID)
RETURNS public.notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    result public.notification_preferences;
BEGIN
    SELECT * INTO result
    FROM public.notification_preferences
    WHERE user_id = p_user_id;

    -- If no preferences found, return defaults
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
-- VERIFICATION
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 041: get_notification_preferences function fixed!';
    RAISE NOTICE '✓ Function now returns notification_preferences composite type';
    RAISE NOTICE '✓ Correct column names: email_comments, email_replies, etc.';
END $$;
