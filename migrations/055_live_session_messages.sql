-- Migration: Live session chat messages
-- In-app real-time chat for live room sessions

CREATE TABLE IF NOT EXISTS live_session_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_messages_session ON live_session_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_messages_user ON live_session_messages(user_id);

-- Enable RLS
ALTER TABLE live_session_messages ENABLE ROW LEVEL SECURITY;

-- Premium users and admins can read messages
CREATE POLICY "Premium users can view live chat"
    ON live_session_messages FOR SELECT
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

-- Premium users and admins can send messages (own messages only)
CREATE POLICY "Premium users can send live chat messages"
    ON live_session_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid()
                AND (
                    role IN ('admin', 'superadmin', 'moderator')
                    OR membership_type = 'premium'
                )
            )
            OR has_premium_access(auth.uid())
        )
    );

-- Users can delete their own messages
CREATE POLICY "Users can delete own live chat messages"
    ON live_session_messages FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Admins can delete any message (moderation)
CREATE POLICY "Admins can delete any live chat message"
    ON live_session_messages FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    );

-- Grant table-level permissions
GRANT ALL ON live_session_messages TO service_role;
GRANT ALL ON live_session_messages TO authenticated;

-- Enable real-time
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE live_session_messages;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
