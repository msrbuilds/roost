-- Migration: Fix get_user_id_by_email function
-- The function was incorrectly modified to query profiles instead of auth.users
-- Password reset needs to find users by email from the auth system

-- ============================================================================
-- DROP AND RECREATE THE FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_user_id_by_email(TEXT) CASCADE;

-- Recreate with correct implementation that queries auth.users
-- Returns TABLE to match the original signature expected by the password reset code
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(user_email TEXT)
RETURNS TABLE(id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT au.id, au.email::TEXT
    FROM auth.users au
    WHERE LOWER(au.email) = LOWER(user_email)
    LIMIT 1;
END;
$$;

-- Grant execute permission to service_role only
-- This function accesses auth.users which should not be exposed to regular users
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO service_role;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 035: get_user_id_by_email function fixed!';
    RAISE NOTICE '🔍 Function now correctly queries auth.users for email lookup';
    RAISE NOTICE '🔑 Password reset will now work properly';
END $$;
