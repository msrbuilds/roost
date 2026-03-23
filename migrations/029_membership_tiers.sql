-- Migration: Add Free and Premium Membership Tiers
-- This migration adds support for two membership types:
-- 1. Free: Users who register through the signup form
-- 2. Premium: Users who purchase via Gumroad (or are manually upgraded)

-- ============================================================================
-- 1. Add membership_type column to profiles table
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS membership_type TEXT DEFAULT 'free'
  CHECK (membership_type IN ('free', 'premium'));

-- ============================================================================
-- 2. Add is_premium flag to groups table
-- ============================================================================

ALTER TABLE groups
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- ============================================================================
-- 3. Migrate ALL existing users to premium membership
-- ============================================================================

-- IMPORTANT: All existing users were created through Gumroad purchases,
-- so they should all be premium members. New free users will register
-- after this migration with membership_type defaulting to 'free'.
UPDATE profiles
SET membership_type = 'premium'
WHERE membership_type IS NULL OR membership_type = 'free';

-- ============================================================================
-- 4. Create helper function to check premium access
-- ============================================================================

-- This function returns true if user has premium access via either:
-- 1. membership_type = 'premium' in profiles table
-- 2. An active Gumroad subscription (uses existing has_active_subscription function)
CREATE OR REPLACE FUNCTION has_premium_access(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_membership_type TEXT;
BEGIN
  -- Check if membership_type is premium
  SELECT membership_type INTO v_membership_type
  FROM profiles
  WHERE id = p_user_id;

  IF v_membership_type = 'premium' THEN
    RETURN TRUE;
  END IF;

  -- Fall back to checking active subscription
  RETURN has_active_subscription(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Add RLS policies for premium group access
-- ============================================================================

-- Policy: Users can only join non-premium groups OR premium groups if they have premium access
-- This will be enforced at the application level for now, but we add a helper function

CREATE OR REPLACE FUNCTION can_access_group(p_user_id UUID, p_group_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_premium BOOLEAN;
BEGIN
  -- Get group's premium status
  SELECT is_premium INTO v_is_premium
  FROM groups
  WHERE id = p_group_id;

  -- If group is not premium, anyone can access
  IF NOT COALESCE(v_is_premium, false) THEN
    RETURN TRUE;
  END IF;

  -- For premium groups, check if user has premium access
  RETURN has_premium_access(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Create index for efficient queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_membership_type ON profiles(membership_type);
CREATE INDEX IF NOT EXISTS idx_groups_is_premium ON groups(is_premium);

-- ============================================================================
-- 7. Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION has_premium_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_group(UUID, UUID) TO authenticated;
