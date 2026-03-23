-- Migration 005: Group Tabs Features (Assets & Recordings)
-- Run this in Supabase SQL Editor AFTER running 004_make_group_id_nullable.sql
-- Created: 2026-01-23

-- =============================================================================
-- 1. CREATE GROUP_ASSETS JUNCTION TABLE
-- =============================================================================
CREATE TABLE group_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, asset_id)
);

-- =============================================================================
-- 2. CREATE RECORDINGS TABLE
-- =============================================================================
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  video_platform TEXT NOT NULL CHECK (video_platform IN ('youtube', 'vimeo')),
  video_id TEXT NOT NULL,
  thumbnail_url TEXT,
  published_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. CREATE INDEXES
-- =============================================================================
CREATE INDEX idx_group_assets_group ON group_assets(group_id);
CREATE INDEX idx_group_assets_asset ON group_assets(asset_id);
CREATE INDEX idx_recordings_group ON recordings(group_id);
CREATE INDEX idx_recordings_created ON recordings(created_at DESC);

-- =============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE group_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. RLS POLICIES FOR GROUP_ASSETS
-- =============================================================================

-- Group members can view assets
CREATE POLICY "Group members can view group assets"
  ON group_assets FOR SELECT
  USING (is_group_member(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

-- Admins/mods can upload assets
CREATE POLICY "Group admins can upload assets"
  ON group_assets FOR INSERT
  WITH CHECK (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

-- Admins/mods can delete assets
CREATE POLICY "Group admins can delete assets"
  ON group_assets FOR DELETE
  USING (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

-- =============================================================================
-- 6. RLS POLICIES FOR RECORDINGS
-- =============================================================================

-- Group members can view recordings
CREATE POLICY "Group members can view recordings"
  ON recordings FOR SELECT
  USING (is_group_member(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

-- Admins/mods can publish recordings
CREATE POLICY "Group admins can create recordings"
  ON recordings FOR INSERT
  WITH CHECK (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

-- Admins/mods can update recordings
CREATE POLICY "Group admins can update recordings"
  ON recordings FOR UPDATE
  USING (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

-- Admins/mods can delete recordings
CREATE POLICY "Group admins can delete recordings"
  ON recordings FOR DELETE
  USING (is_group_admin_or_mod(group_id, auth.uid()) OR is_platform_admin(auth.uid()));

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 005: Group tabs features created successfully!';
    RAISE NOTICE '📁 group_assets table: Links assets to groups';
    RAISE NOTICE '🎥 recordings table: Stores YouTube/Vimeo video links';
    RAISE NOTICE '🔒 RLS policies: Admins/Mods can manage, Members can view';
END $$;
