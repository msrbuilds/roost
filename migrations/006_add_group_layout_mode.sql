-- Migration 006: Add layout_mode to groups table
-- Run this in Supabase SQL Editor
-- Created: 2026-01-24

-- Add layout_mode column to groups table
ALTER TABLE groups
ADD COLUMN layout_mode TEXT NOT NULL DEFAULT 'sidebar'
CHECK (layout_mode IN ('default', 'sidebar'));

-- Add comment to explain the column
COMMENT ON COLUMN groups.layout_mode IS 'Preferred layout mode for classroom detail page: default (header top) or sidebar (header right)';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 006: Added layout_mode column to groups table';
    RAISE NOTICE '📐 Default value: sidebar';
    RAISE NOTICE '🔧 Admins can change layout in classroom settings';
END $$;
