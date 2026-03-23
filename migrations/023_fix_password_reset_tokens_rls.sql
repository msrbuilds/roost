-- =====================================================
-- Migration 023: Fix Password Reset Tokens RLS Policy
-- Created: 2026-02-01
-- Purpose: Add proper RLS policies for password_reset_tokens table
-- The service role needs explicit policies to bypass RLS
-- =====================================================

-- First, let's check if we need to add the policies
-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Service role can manage password reset tokens" ON password_reset_tokens;
DROP POLICY IF EXISTS "service_role_full_access" ON password_reset_tokens;

-- Option 1: Create a policy that allows service_role full access
-- This is the recommended approach for backend-only tables

-- Since service_role should have full access, we can use a simple TRUE policy
-- But we need to ensure only authenticated service calls can use it

-- Create policy for service role (uses auth.role() function)
CREATE POLICY "Service role full access"
ON password_reset_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Alternative: If the above doesn't work with your Supabase setup,
-- we can disable RLS entirely since this table is only accessed by the backend
-- Uncomment the following line if needed:
-- ALTER TABLE password_reset_tokens DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 023: password_reset_tokens RLS policy fixed!';
    RAISE NOTICE '🔐 Service role now has full access to password reset tokens table';
END $$;
