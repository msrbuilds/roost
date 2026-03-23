-- Migration: Enable RLS on password_reset_tokens table
-- The table has policies defined but RLS was never enabled
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0007_policy_exists_rls_disabled

-- ============================================================================
-- ENABLE RLS ON PASSWORD_RESET_TOKENS
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (extra security)
ALTER TABLE public.password_reset_tokens FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFY/RECREATE POLICIES
-- ============================================================================

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Service role full access" ON public.password_reset_tokens;

-- Service role needs full access for the password reset flow
-- (backend/edge functions use service_role to create and validate tokens)
CREATE POLICY "Service role full access"
ON public.password_reset_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- No policies for authenticated or anon users - tokens should ONLY be
-- accessed by server-side code using the service_role key

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 034: password_reset_tokens RLS enabled!';
    RAISE NOTICE '🔒 Table now properly secured with RLS';
    RAISE NOTICE '🔑 Only service_role can access tokens (as intended)';
END $$;
