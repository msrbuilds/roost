-- =============================================================================
-- Migration 057: Profile Cover Photo
-- =============================================================================
--
-- Adds a cover_url column to the profiles table so users can upload
-- a banner/cover photo for their profile page.
--
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 057: cover_url column added to profiles table';
END;
$$;
