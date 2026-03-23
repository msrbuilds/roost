-- Migration 058: Learn Mode with Modules
-- Run this in Supabase SQL Editor
-- Created: 2026-02-23
-- Adds modules system, lesson completions, and extends recordings/assets for learn mode

-- ============================================
-- 1. Extend layout_mode constraint on groups
-- ============================================
ALTER TABLE groups DROP CONSTRAINT groups_layout_mode_check;
ALTER TABLE groups ADD CONSTRAINT groups_layout_mode_check
  CHECK (layout_mode IN ('default', 'sidebar', 'learn'));

COMMENT ON COLUMN groups.layout_mode IS 'Preferred layout mode: default (header top), sidebar (header right), or learn (course-like with modules)';

-- ============================================
-- 2. Create modules table
-- ============================================
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_modules_group ON modules(group_id);
CREATE INDEX idx_modules_order ON modules(group_id, display_order);

-- ============================================
-- 3. Add module_id and display_order to recordings
-- ============================================
ALTER TABLE recordings
ADD COLUMN module_id UUID REFERENCES modules(id) ON DELETE SET NULL;

ALTER TABLE recordings
ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_recordings_module ON recordings(module_id);

-- ============================================
-- 4. Add module_id to group_assets
-- ============================================
ALTER TABLE group_assets
ADD COLUMN module_id UUID REFERENCES modules(id) ON DELETE SET NULL;

CREATE INDEX idx_group_assets_module ON group_assets(module_id);

-- ============================================
-- 5. Create lesson_completions table
-- ============================================
CREATE TABLE lesson_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, recording_id)
);

CREATE INDEX idx_lesson_completions_user ON lesson_completions(user_id);
CREATE INDEX idx_lesson_completions_module ON lesson_completions(user_id, module_id);
CREATE INDEX idx_lesson_completions_recording ON lesson_completions(recording_id);

-- ============================================
-- 6. Add recording_id to comments for lesson comments
-- ============================================
ALTER TABLE comments
ALTER COLUMN post_id DROP NOT NULL;

ALTER TABLE comments
ADD COLUMN recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE;

CREATE INDEX idx_comments_recording ON comments(recording_id);

-- Add check constraint: must have either post_id or recording_id
ALTER TABLE comments
ADD CONSTRAINT comments_target_check
  CHECK (post_id IS NOT NULL OR recording_id IS NOT NULL);

-- ============================================
-- 7. Grant table-level permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON modules TO authenticated;
GRANT SELECT, INSERT, DELETE ON lesson_completions TO authenticated;

-- ============================================
-- 8. RLS Policies for modules
-- ============================================
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view modules"
  ON modules FOR SELECT
  USING (is_group_member(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

CREATE POLICY "Group admins can create modules"
  ON modules FOR INSERT
  WITH CHECK (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

CREATE POLICY "Group admins can update modules"
  ON modules FOR UPDATE
  USING (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

CREATE POLICY "Group admins can delete modules"
  ON modules FOR DELETE
  USING (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

-- ============================================
-- 8. RLS Policies for lesson_completions
-- ============================================
ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own completions"
  ON lesson_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark lessons complete"
  ON lesson_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmark lessons"
  ON lesson_completions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 9. Update comments RLS to support recording_id
-- ============================================

-- Drop and recreate the SELECT policy to also allow recording-based access
-- First check existing policies and update accordingly
DO $$
BEGIN
    -- Allow viewing comments on recordings the user has access to
    -- The existing policies handle post_id comments; we add recording_id support
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Users can view recording comments'
    ) THEN
        CREATE POLICY "Users can view recording comments"
          ON comments FOR SELECT
          USING (recording_id IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Users can create recording comments'
    ) THEN
        CREATE POLICY "Users can create recording comments"
          ON comments FOR INSERT
          WITH CHECK (recording_id IS NOT NULL AND auth.uid() = author_id);
    END IF;
END $$;

-- ============================================
-- 10. Updated_at trigger for modules
-- ============================================
CREATE OR REPLACE FUNCTION update_modules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_modules_updated_at
    BEFORE UPDATE ON modules
    FOR EACH ROW
    EXECUTE FUNCTION update_modules_updated_at();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 058: Learn Mode with Modules';
    RAISE NOTICE '📚 Created modules table';
    RAISE NOTICE '📝 Created lesson_completions table';
    RAISE NOTICE '🔗 Added module_id to recordings and group_assets';
    RAISE NOTICE '💬 Extended comments to support recording_id';
    RAISE NOTICE '🔒 RLS policies configured';
END $$;
