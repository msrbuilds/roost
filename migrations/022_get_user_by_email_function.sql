-- =====================================================
-- Migration 022: Get User By Email Function
-- Created: 2026-02-01
-- Purpose: Create a function to lookup user by email from auth.users
-- This is needed because listUsers() has pagination limits
-- =====================================================

-- Function to get user ID by email (bypasses pagination limits of listUsers)
CREATE OR REPLACE FUNCTION get_user_id_by_email(user_email TEXT)
RETURNS TABLE(id UUID, email TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT au.id, au.email::TEXT
    FROM auth.users au
    WHERE LOWER(au.email) = LOWER(user_email)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO service_role;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 022: get_user_id_by_email function created!';
    RAISE NOTICE '🔍 This function allows efficient user lookup by email';
END $$;
