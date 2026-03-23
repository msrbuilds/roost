-- ============================================
-- 051: Follow System
-- ============================================
-- Adds user follow functionality for personalized feeds

-- ============================================
-- 1. Create follows table
-- ============================================
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- One user can only follow another user once
    UNIQUE(follower_id, following_id),
    -- Prevent self-follows
    CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- Indexes for efficient queries in both directions
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ============================================
-- 2. Table permissions & Row Level Security
-- ============================================
GRANT SELECT ON follows TO anon;
GRANT SELECT, INSERT, DELETE ON follows TO authenticated;

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Anyone can see follow relationships
CREATE POLICY "Follows are viewable by everyone"
    ON follows FOR SELECT
    USING (true);

-- Users can follow others (insert their own follows)
CREATE POLICY "Users can follow others"
    ON follows FOR INSERT
    WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow (delete their own follows)
CREATE POLICY "Users can unfollow"
    ON follows FOR DELETE
    USING (auth.uid() = follower_id);

-- ============================================
-- 3. Notification trigger on new follow
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER AS $$
DECLARE
    follower_name TEXT;
    follower_username TEXT;
BEGIN
    SELECT display_name, username
    INTO follower_name, follower_username
    FROM profiles
    WHERE id = NEW.follower_id;

    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
        NEW.following_id,
        'new_follower',
        follower_name || ' started following you',
        NULL,
        '/profile/' || follower_username
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER on_follow_created
    AFTER INSERT ON follows
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();
