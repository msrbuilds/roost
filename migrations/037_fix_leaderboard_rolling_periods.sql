-- Migration: Fix leaderboard rolling periods
-- Created: 2026-02-03
-- Description: Adds RPC function to calculate leaderboard from point_activities for rolling periods

-- ============================================================================
-- PROBLEM:
-- The leaderboard_entries table stores pre-computed totals with fixed period dates.
-- When points are awarded on Jan 31st, entries are created with period_start = Jan 2nd.
-- But when the frontend queries on Feb 3rd, it looks for period_start = Jan 5th.
-- These dates never match, so no entries are found!
--
-- SOLUTION:
-- 1. All-time leaderboard uses fixed dates (2000-01-01 to 2099-12-31) - always works
-- 2. Rolling periods (7, 30 days) need to calculate directly from point_activities
-- ============================================================================

-- ============================================================================
-- 1. CREATE RPC FUNCTION FOR ROLLING PERIOD LEADERBOARD
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_leaderboard_for_period(UUID, TIMESTAMPTZ, INTEGER, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.get_leaderboard_for_period(
    p_group_id UUID DEFAULT NULL,
    p_period_start TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    user_id UUID,
    total_points BIGINT,
    activity_count BIGINT,
    "user" JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pa.user_id,
        COALESCE(SUM(pa.points), 0)::BIGINT as total_points,
        COUNT(*)::BIGINT as activity_count,
        jsonb_build_object(
            'id', p.id,
            'username', p.username,
            'display_name', p.display_name,
            'avatar_url', p.avatar_url,
            'location', p.location
        ) as "user"
    FROM public.point_activities pa
    INNER JOIN public.profiles p ON p.id = pa.user_id
    WHERE pa.created_at >= p_period_start
        AND (
            (p_group_id IS NULL AND pa.group_id IS NULL)
            OR pa.group_id = p_group_id
            OR p_group_id IS NULL  -- If no group specified, include all activities
        )
    GROUP BY pa.user_id, p.id, p.username, p.display_name, p.avatar_url, p.location
    HAVING COALESCE(SUM(pa.points), 0) > 0
    ORDER BY total_points DESC, pa.user_id
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_for_period(UUID, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_leaderboard_for_period IS
'Calculate leaderboard rankings from point_activities for any rolling time period.
Use this for 7-day, 30-day periods. For all-time, query leaderboard_entries with fixed dates (2000-01-01 to 2099-12-31).';

-- ============================================================================
-- 2. FIX get_user_rank TO USE total_points COLUMN
-- ============================================================================
-- The leaderboard_entries table uses total_points, not points
-- Drop ALL versions of get_user_rank to avoid "function name is not unique" error

DROP FUNCTION IF EXISTS public.get_user_rank(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_rank(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_rank(UUID, UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_rank(UUID, UUID, DATE, DATE) CASCADE;

CREATE OR REPLACE FUNCTION public.get_user_rank(
    p_user_id UUID,
    p_group_id UUID DEFAULT NULL,
    p_period_start DATE DEFAULT '2000-01-01'::DATE,
    p_period_end DATE DEFAULT '2099-12-31'::DATE
)
RETURNS TABLE(rank BIGINT, points INTEGER, total_users BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_users AS (
        SELECT
            le.user_id,
            le.total_points,
            ROW_NUMBER() OVER (ORDER BY le.total_points DESC, le.updated_at ASC) as user_rank
        FROM public.leaderboard_entries le
        WHERE le.period_start = p_period_start
            AND le.period_end = p_period_end
            AND (
                (p_group_id IS NULL AND le.group_id IS NULL)
                OR le.group_id = p_group_id
            )
    )
    SELECT
        ru.user_rank,
        ru.total_points,
        (SELECT COUNT(*) FROM ranked_users)::BIGINT as total
    FROM ranked_users ru
    WHERE ru.user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_rank(UUID, UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.get_user_rank IS 'Get a user''s rank, points, and total user count from leaderboard_entries';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 037: Fixed leaderboard rolling periods!';
    RAISE NOTICE '🔧 Added get_leaderboard_for_period() RPC for 7/30-day rolling periods';
    RAISE NOTICE '🔧 Fixed get_user_rank() to use total_points column';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Frontend changes required:';
    RAISE NOTICE '   - For all-time: query leaderboard_entries with period 2000-01-01 to 2099-12-31';
    RAISE NOTICE '   - For rolling periods: use get_leaderboard_for_period() RPC';
END $$;
