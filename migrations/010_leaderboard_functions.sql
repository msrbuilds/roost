-- Migration 010: Leaderboard Functions
-- Run this in Supabase SQL Editor
-- Created: 2026-01-27
-- Description: Database functions for efficient leaderboard calculations

-- =============================================================================
-- 1. FUNCTION: CALCULATE USER POINTS
-- =============================================================================
-- Drop existing function if it exists (with CASCADE to handle dependencies)
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

COMMENT ON FUNCTION calculate_user_points IS 'Calculate total points for a user within a date range, optionally scoped to a group';

-- =============================================================================
-- 2. FUNCTION: UPDATE LEADERBOARD ENTRY
-- =============================================================================
-- Drop existing function if it exists (with CASCADE to handle dependencies)
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
    -- Calculate points for the period
    v_points := calculate_user_points(p_user_id, p_group_id, p_period_start, p_period_end);
    
    -- Insert or update leaderboard entry
    INSERT INTO leaderboard_entries (user_id, group_id, points, period_start, period_end)
    VALUES (p_user_id, p_group_id, v_points, p_period_start, p_period_end)
    ON CONFLICT (user_id, group_id, period_start)
    DO UPDATE SET 
        points = v_points,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_leaderboard_entry IS 'Insert or update a leaderboard entry for a user/group/period';

-- =============================================================================
-- 3. FUNCTION: AWARD POINTS
-- =============================================================================
-- Drop existing function if it exists (with CASCADE to handle dependencies)
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
    -- Insert point activity
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
    
    -- Update leaderboard entries for different periods
    -- 30-day leaderboard (most common)
    PERFORM update_leaderboard_entry(
        p_user_id,
        p_group_id,
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE
    );
    
    -- All-time leaderboard (global)
    PERFORM update_leaderboard_entry(
        p_user_id,
        p_group_id,
        '2000-01-01'::DATE,
        '2099-12-31'::DATE
    );
    
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION award_points IS 'Award points to a user and update leaderboard entries automatically';

-- =============================================================================
-- 4. FUNCTION: GET USER RANK
-- =============================================================================
-- Drop existing function if it exists (with CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS get_user_rank CASCADE;
CREATE OR REPLACE FUNCTION get_user_rank(
    p_user_id UUID,
    p_group_id UUID DEFAULT NULL,
    p_period_start DATE DEFAULT CURRENT_DATE - INTERVAL '29 days',
    p_period_end DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(rank BIGINT, points INTEGER, total_users BIGINT) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_users AS (
        SELECT 
            le.user_id,
            le.points,
            ROW_NUMBER() OVER (ORDER BY le.points DESC, le.updated_at ASC) as user_rank
        FROM leaderboard_entries le
        WHERE le.period_start = p_period_start
            AND le.period_end = p_period_end
            AND (p_group_id IS NULL AND le.group_id IS NULL OR le.group_id = p_group_id)
    )
    SELECT 
        ru.user_rank,
        ru.points,
        (SELECT COUNT(*) FROM ranked_users)::BIGINT as total
    FROM ranked_users ru
    WHERE ru.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_rank IS 'Get a user''s rank, points, and total user count for a leaderboard';

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 010: Leaderboard functions created successfully!';
END $$;
