-- Migration: Fix live_sessions schema
-- The original migration created the table with Cloudflare columns.
-- This migration updates it to YouTube-only with RSVP support.

-- Drop old Cloudflare columns (if they exist)
ALTER TABLE live_sessions DROP COLUMN IF EXISTS source_type;
ALTER TABLE live_sessions DROP COLUMN IF EXISTS cloudflare_input_id;
ALTER TABLE live_sessions DROP COLUMN IF EXISTS cloudflare_video_id;

-- Add scheduled_at column (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_sessions' AND column_name = 'scheduled_at'
    ) THEN
        ALTER TABLE live_sessions ADD COLUMN scheduled_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add youtube_embed_url column (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_sessions' AND column_name = 'youtube_embed_url'
    ) THEN
        ALTER TABLE live_sessions ADD COLUMN youtube_embed_url TEXT;
    END IF;
END $$;

-- Add visibility column (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_sessions' AND column_name = 'visibility'
    ) THEN
        ALTER TABLE live_sessions ADD COLUMN visibility TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('unlisted', 'private'));
    END IF;
END $$;

-- Create index for scheduled sessions (if not exists)
CREATE INDEX IF NOT EXISTS idx_live_sessions_scheduled ON live_sessions(scheduled_at) WHERE status = 'idle';

-- Drop old RLS policies that may reference old columns or have wrong permissions
DROP POLICY IF EXISTS "Admins can manage live sessions" ON live_sessions;
DROP POLICY IF EXISTS "Premium users can view live sessions" ON live_sessions;

-- Recreate RLS policies
CREATE POLICY "Admins can manage live sessions"
    ON live_sessions FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "Premium users can view live sessions"
    ON live_sessions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND (
                role IN ('admin', 'superadmin', 'moderator')
                OR membership_type = 'premium'
            )
        )
        OR has_premium_access(auth.uid())
    );

-- ========================================
-- RSVP Table (create if not exists)
-- ========================================

CREATE TABLE IF NOT EXISTS live_session_rsvps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_session_rsvps_session ON live_session_rsvps(session_id);
CREATE INDEX IF NOT EXISTS idx_live_session_rsvps_user ON live_session_rsvps(user_id);

-- Enable RLS on RSVPs
ALTER TABLE live_session_rsvps ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RSVP policies to ensure clean state
DROP POLICY IF EXISTS "Users can manage own RSVPs" ON live_session_rsvps;
DROP POLICY IF EXISTS "Admins can view all RSVPs" ON live_session_rsvps;
DROP POLICY IF EXISTS "Admins can delete RSVPs" ON live_session_rsvps;

CREATE POLICY "Users can manage own RSVPs"
    ON live_session_rsvps FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all RSVPs"
    ON live_session_rsvps FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "Admins can delete RSVPs"
    ON live_session_rsvps FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    );

-- ========================================
-- Grant table-level permissions
-- ========================================
-- The service_role needs access for backend API calls.
-- The authenticated role needs access for RLS-gated queries.

GRANT ALL ON live_sessions TO service_role;
GRANT ALL ON live_sessions TO authenticated;
GRANT ALL ON live_session_rsvps TO service_role;
GRANT ALL ON live_session_rsvps TO authenticated;

-- Ensure realtime is enabled (ignore error if already added)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
