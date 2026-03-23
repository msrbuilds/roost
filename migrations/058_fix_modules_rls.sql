-- Migration 058 Fix: Re-apply RLS policies for modules table
-- Run this in Supabase SQL Editor if you get "permission denied for table modules"
-- This is idempotent - safe to run multiple times

-- First, check if the modules table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modules') THEN
        RAISE EXCEPTION 'modules table does not exist. Run the full 058_learn_mode_modules.sql first.';
    END IF;
END $$;

-- ============================================
-- Grant table-level permissions to authenticated role
-- (This was missing from the original migration)
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON modules TO authenticated;
GRANT SELECT, INSERT, DELETE ON lesson_completions TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any) and recreate
DROP POLICY IF EXISTS "Group members can view modules" ON modules;
DROP POLICY IF EXISTS "Group admins can create modules" ON modules;
DROP POLICY IF EXISTS "Group admins can update modules" ON modules;
DROP POLICY IF EXISTS "Group admins can delete modules" ON modules;

CREATE POLICY "Group members can view modules"
  ON modules FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Group admins can create modules"
  ON modules FOR INSERT
  WITH CHECK (public.is_group_admin_or_mod(group_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Group admins can update modules"
  ON modules FOR UPDATE
  USING (public.is_group_admin_or_mod(group_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Group admins can delete modules"
  ON modules FOR DELETE
  USING (public.is_group_admin_or_mod(group_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

-- Also fix lesson_completions policies
ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own completions" ON lesson_completions;
DROP POLICY IF EXISTS "Users can mark lessons complete" ON lesson_completions;
DROP POLICY IF EXISTS "Users can unmark lessons" ON lesson_completions;

CREATE POLICY "Users can view own completions"
  ON lesson_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark lessons complete"
  ON lesson_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmark lessons"
  ON lesson_completions FOR DELETE
  USING (auth.uid() = user_id);

-- Verify
DO $$
DECLARE
    policy_count INT;
BEGIN
    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'modules';
    RAISE NOTICE 'modules table has % RLS policies', policy_count;

    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'lesson_completions';
    RAISE NOTICE 'lesson_completions table has % RLS policies', policy_count;
END $$;
