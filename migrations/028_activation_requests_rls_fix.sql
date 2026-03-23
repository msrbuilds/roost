-- Migration 028: Activation Requests RLS Fix
-- Run this in Supabase SQL Editor
-- Created: 2026-02-01
--
-- This migration removes the direct INSERT policy for activation_requests
-- and ensures all requests must go through the request_activation function.

-- =============================================================================
-- 1. DROP THE EXISTING INSERT POLICY
-- =============================================================================
DROP POLICY IF EXISTS "Users can create activation requests" ON activation_requests;

-- =============================================================================
-- 2. CREATE A MORE RESTRICTIVE INSERT POLICY
-- =============================================================================
-- This policy prevents direct inserts - the request_activation function
-- uses SECURITY DEFINER so it bypasses RLS and can still insert.
-- Regular users cannot insert directly.
CREATE POLICY "Only system can create activation requests"
    ON activation_requests FOR INSERT
    TO authenticated
    WITH CHECK (false);  -- No direct inserts allowed

-- =============================================================================
-- 3. GRANT EXECUTE PERMISSION ON THE FUNCTION
-- =============================================================================
-- Ensure authenticated users can call the request_activation function
GRANT EXECUTE ON FUNCTION request_activation(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_remaining_activations(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_active_request(UUID, UUID) TO authenticated;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 028: Activation Requests RLS Fix';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Changes:';
    RAISE NOTICE '  - Removed direct INSERT policy for activation_requests';
    RAISE NOTICE '  - Users must now use request_activation() function';
    RAISE NOTICE '  - Function validates limits and active requests';
    RAISE NOTICE '==============================================';
END $$;
