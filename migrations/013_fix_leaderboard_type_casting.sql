-- Migration 013: Fix Leaderboard Function Type Casting
-- Fixes the type mismatch in update_leaderboard_entry function calls
-- Run this in Supabase SQL Editor
-- Created: 2026-01-27

-- =============================================================================
-- FIX: Update award_points function to use proper type casting
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
    -- 30-day leaderboard (most common) - FIXED: Cast to DATE
    PERFORM update_leaderboard_entry(
        p_user_id,
        p_group_id,
        (CURRENT_DATE - INTERVAL '29 days')::DATE,  -- Explicit cast to DATE
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
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 013: Leaderboard function type casting fixed!';
    RAISE NOTICE '🎯 award_points now properly casts INTERVAL results to DATE';
END $$;
