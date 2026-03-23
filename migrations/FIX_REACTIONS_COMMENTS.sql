-- FIX: Reactions and Comments not working
-- Run this in Supabase SQL Editor
-- This combines migrations 010, 013, and 014

-- =============================================================================
-- STEP 1: Create point_action_type enum if not exists
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'point_action_type') THEN
        CREATE TYPE point_action_type AS ENUM (
            'post_created',
            'comment_created',
            'reaction_given',
            'reaction_received',
            'event_created',
            'event_attended',
            'group_joined',
            'profile_completed',
            'streak_bonus',
            'manual_adjustment'
        );
    END IF;
END $$;

-- =============================================================================
-- STEP 2: Create point_activities table if not exists
-- =============================================================================
CREATE TABLE IF NOT EXISTS point_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    action_type point_action_type NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_point_activities_user_id ON point_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_point_activities_group_id ON point_activities(group_id);
CREATE INDEX IF NOT EXISTS idx_point_activities_created_at ON point_activities(created_at);

-- =============================================================================
-- STEP 3: Create leaderboard_entries table if not exists
-- =============================================================================
CREATE TABLE IF NOT EXISTS leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_points INTEGER NOT NULL DEFAULT 0,
    rank INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, group_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user_id ON leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_period ON leaderboard_entries(period_start, period_end);

-- =============================================================================
-- STEP 4: Create/Replace calculate_user_points function
-- =============================================================================
DROP FUNCTION IF EXISTS calculate_user_points CASCADE;
CREATE OR REPLACE FUNCTION calculate_user_points(
    p_user_id UUID,
    p_group_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
    total_points INTEGER;
BEGIN
    SELECT COALESCE(SUM(points), 0)
    INTO total_points
    FROM point_activities
    WHERE user_id = p_user_id
        AND (p_group_id IS NULL OR group_id = p_group_id)
        AND created_at >= p_start_date::TIMESTAMPTZ
        AND created_at <= (p_end_date + INTERVAL '1 day')::TIMESTAMPTZ;

    RETURN total_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 5: Create/Replace update_leaderboard_entry function
-- =============================================================================
DROP FUNCTION IF EXISTS update_leaderboard_entry CASCADE;
CREATE OR REPLACE FUNCTION update_leaderboard_entry(
    p_user_id UUID,
    p_group_id UUID DEFAULT NULL,
    p_period_start DATE DEFAULT CURRENT_DATE - INTERVAL '29 days',
    p_period_end DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
DECLARE
    v_points INTEGER;
BEGIN
    v_points := calculate_user_points(p_user_id, p_group_id, p_period_start, p_period_end);

    INSERT INTO leaderboard_entries (user_id, group_id, period_start, period_end, total_points, updated_at)
    VALUES (p_user_id, p_group_id, p_period_start, p_period_end, v_points, NOW())
    ON CONFLICT (user_id, group_id, period_start, period_end)
    DO UPDATE SET
        total_points = EXCLUDED.total_points,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 6: Create/Replace award_points function (FIXED VERSION)
-- =============================================================================
DROP FUNCTION IF EXISTS award_points CASCADE;
CREATE OR REPLACE FUNCTION award_points(
    p_user_id UUID,
    p_action_type point_action_type,
    p_points INTEGER,
    p_group_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    INSERT INTO point_activities (
        user_id,
        group_id,
        action_type,
        points,
        description,
        reference_id
    )
    VALUES (
        p_user_id,
        p_group_id,
        p_action_type,
        p_points,
        p_description,
        p_reference_id
    )
    RETURNING id INTO v_activity_id;

    -- Update 30-day leaderboard
    PERFORM update_leaderboard_entry(
        p_user_id,
        p_group_id,
        (CURRENT_DATE - INTERVAL '29 days')::DATE,
        CURRENT_DATE
    );

    -- Update all-time leaderboard
    PERFORM update_leaderboard_entry(
        p_user_id,
        p_group_id,
        '2000-01-01'::DATE,
        '2099-12-31'::DATE
    );

    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 7: Drop old triggers
-- =============================================================================
DROP TRIGGER IF EXISTS award_points_for_post ON posts;
DROP TRIGGER IF EXISTS award_points_for_comment ON comments;
DROP TRIGGER IF EXISTS award_points_for_reaction ON reactions;
DROP TRIGGER IF EXISTS award_points_on_post_trigger ON posts;
DROP TRIGGER IF EXISTS award_points_on_comment_trigger ON comments;
DROP TRIGGER IF EXISTS award_points_on_reaction_trigger ON reactions;
DROP FUNCTION IF EXISTS trigger_post_points CASCADE;
DROP FUNCTION IF EXISTS trigger_comment_points CASCADE;
DROP FUNCTION IF EXISTS trigger_reaction_points CASCADE;
DROP FUNCTION IF EXISTS award_points_on_post CASCADE;
DROP FUNCTION IF EXISTS award_points_on_comment CASCADE;
DROP FUNCTION IF EXISTS award_points_on_reaction CASCADE;

-- =============================================================================
-- STEP 8: Create new trigger functions
-- =============================================================================

-- Trigger for posts
CREATE OR REPLACE FUNCTION trigger_post_points()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM award_points(
        p_user_id := NEW.author_id,
        p_action_type := 'post_created'::point_action_type,
        p_points := 10,
        p_group_id := NEW.group_id,
        p_description := 'Created a new post',
        p_reference_id := NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER award_points_for_post
    AFTER INSERT ON posts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_post_points();

-- Trigger for comments
CREATE OR REPLACE FUNCTION trigger_comment_points()
RETURNS TRIGGER AS $$
DECLARE
    v_group_id UUID;
BEGIN
    SELECT group_id INTO v_group_id
    FROM posts
    WHERE id = NEW.post_id;

    PERFORM award_points(
        p_user_id := NEW.author_id,
        p_action_type := 'comment_created'::point_action_type,
        p_points := 5,
        p_group_id := v_group_id,
        p_description := 'Created a new comment',
        p_reference_id := NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER award_points_for_comment
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_comment_points();

-- Trigger for reactions
CREATE OR REPLACE FUNCTION trigger_reaction_points()
RETURNS TRIGGER AS $$
DECLARE
    v_content_author_id UUID;
    v_group_id UUID;
BEGIN
    IF NEW.reactable_type = 'post' THEN
        SELECT author_id, group_id INTO v_content_author_id, v_group_id
        FROM posts WHERE id = NEW.reactable_id;
    ELSIF NEW.reactable_type = 'comment' THEN
        SELECT c.author_id, p.group_id INTO v_content_author_id, v_group_id
        FROM comments c
        JOIN posts p ON p.id = c.post_id
        WHERE c.id = NEW.reactable_id;
    END IF;

    -- Award 1 point to reaction giver
    PERFORM award_points(
        p_user_id := NEW.user_id,
        p_action_type := 'reaction_given'::point_action_type,
        p_points := 1,
        p_group_id := v_group_id,
        p_description := 'Gave a reaction',
        p_reference_id := NEW.id
    );

    -- Award 2 points to content author (if not self-reaction)
    IF v_content_author_id IS NOT NULL AND v_content_author_id != NEW.user_id THEN
        PERFORM award_points(
            p_user_id := v_content_author_id,
            p_action_type := 'reaction_received'::point_action_type,
            p_points := 2,
            p_group_id := v_group_id,
            p_description := 'Received a reaction',
            p_reference_id := NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER award_points_for_reaction
    AFTER INSERT ON reactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_reaction_points();

-- =============================================================================
-- STEP 9: Enable RLS on new tables
-- =============================================================================
ALTER TABLE point_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for point_activities
DROP POLICY IF EXISTS "Users can view all point activities" ON point_activities;
CREATE POLICY "Users can view all point activities"
    ON point_activities FOR SELECT
    TO authenticated
    USING (true);

-- RLS policies for leaderboard_entries
DROP POLICY IF EXISTS "Users can view all leaderboard entries" ON leaderboard_entries;
CREATE POLICY "Users can view all leaderboard entries"
    ON leaderboard_entries FOR SELECT
    TO authenticated
    USING (true);

-- =============================================================================
-- SUCCESS!
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Fix applied successfully!';
    RAISE NOTICE '🎯 Reactions and comments should now work correctly';
END $$;
