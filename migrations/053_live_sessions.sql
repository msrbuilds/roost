-- Migration: Live Sessions for Live Room feature
-- YouTube Live with RSVP system

-- Create live_sessions table
CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Live Session',
    description TEXT,
    -- YouTube embed URL
    youtube_embed_url TEXT,
    -- Session scheduling (for RSVP cutoff)
    scheduled_at TIMESTAMPTZ,
    -- Session state
    status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'live', 'ended')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for quick lookup of current live session
CREATE INDEX idx_live_sessions_status ON live_sessions(status) WHERE status = 'live';
CREATE INDEX idx_live_sessions_created_at ON live_sessions(created_at DESC);
CREATE INDEX idx_live_sessions_scheduled ON live_sessions(scheduled_at) WHERE status = 'idle';

-- Enable RLS
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and superadmins can do everything
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

-- Policy: Premium users can view live sessions
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

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_live_sessions_updated_at()
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

CREATE TRIGGER trigger_live_sessions_updated_at
    BEFORE UPDATE ON live_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_live_sessions_updated_at();

-- ========================================
-- RSVP System
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

CREATE INDEX idx_live_session_rsvps_session ON live_session_rsvps(session_id);
CREATE INDEX idx_live_session_rsvps_user ON live_session_rsvps(user_id);

-- Enable RLS
ALTER TABLE live_session_rsvps ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own RSVPs
CREATE POLICY "Users can manage own RSVPs"
    ON live_session_rsvps FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Admins can view all RSVPs
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

-- Policy: Admins can delete RSVPs
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

-- Enable realtime for live_sessions (so viewers get instant updates)
ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;
