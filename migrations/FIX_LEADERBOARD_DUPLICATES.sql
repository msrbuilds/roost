-- Migration: FIX_LEADERBOARD_DUPLICATES
-- Run this in Supabase SQL Editor
-- Created: 2026-01-31
-- Description: Fix duplicate leaderboard entries caused by NULL group_id handling

-- =============================================================================
-- STEP 1: Check current duplicates (for diagnostic purposes)
-- =============================================================================
-- Run this first to see the duplicates:
-- SELECT user_id, group_id, period_start, period_end, COUNT(*) as cnt
-- FROM leaderboard_entries
-- GROUP BY user_id, group_id, period_start, period_end
-- HAVING COUNT(*) > 1;

-- =============================================================================
-- STEP 1.5: Ensure total_points column exists (some schemas use 'points')
-- =============================================================================
-- Add total_points column if it doesn't exist
ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;

-- Copy data from points to total_points if points column exists and total_points is empty
DO $$
BEGIN
    -- Only run if points column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leaderboard_entries' AND column_name = 'points'
    ) THEN
        UPDATE leaderboard_entries
        SET total_points = COALESCE(points, 0)
        WHERE total_points = 0 OR total_points IS NULL;
    END IF;
END $$;

-- =============================================================================
-- STEP 2: Delete duplicate entries (keep the one with highest points)
-- =============================================================================
DELETE FROM leaderboard_entries a
USING leaderboard_entries b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.period_start = b.period_start
  AND a.period_end = b.period_end
  AND (
    (a.group_id IS NULL AND b.group_id IS NULL) OR
    (a.group_id = b.group_id)
  )
  AND COALESCE(a.total_points, 0) <= COALESCE(b.total_points, 0);

-- =============================================================================
-- STEP 3: Drop old constraints/indexes that don't handle NULL properly
-- =============================================================================
-- Drop old unique constraint if exists
ALTER TABLE leaderboard_entries DROP CONSTRAINT IF EXISTS leaderboard_entries_user_id_group_id_period_start_period_end_key;
ALTER TABLE leaderboard_entries DROP CONSTRAINT IF EXISTS leaderboard_entries_user_id_group_id_period_start_key;

-- Drop old unique indexes
DROP INDEX IF EXISTS idx_leaderboard_entries_unique;
DROP INDEX IF EXISTS leaderboard_entries_unique_idx;

-- =============================================================================
-- STEP 4: Create proper unique index that handles NULL group_id
-- =============================================================================
-- Using COALESCE to treat NULL as a specific UUID for uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_unique_entry
ON leaderboard_entries (
    user_id,
    COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period_start,
    period_end
);

-- =============================================================================
-- STEP 5: Update the leaderboard function to use correct column and conflict
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
    -- Calculate points for the period
    v_points := calculate_user_points(p_user_id, p_group_id, p_period_start, p_period_end);

    -- Insert or update leaderboard entry using total_points column
    INSERT INTO leaderboard_entries (user_id, group_id, total_points, period_start, period_end, updated_at)
    VALUES (p_user_id, p_group_id, v_points, p_period_start, p_period_end, NOW())
    ON CONFLICT (user_id, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid), period_start, period_end)
    DO UPDATE SET
        total_points = v_points,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_leaderboard_entry IS 'Insert or update a leaderboard entry for a user/group/period (handles NULL group_id)';

-- =============================================================================
-- STEP 5.5: Fix get_user_rank function to use total_points column
-- =============================================================================
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
            le.total_points,
            ROW_NUMBER() OVER (ORDER BY le.total_points DESC, le.updated_at ASC) as user_rank
        FROM leaderboard_entries le
        WHERE le.period_start = p_period_start
            AND le.period_end = p_period_end
            AND (p_group_id IS NULL AND le.group_id IS NULL OR le.group_id = p_group_id)
    )
    SELECT
        ru.user_rank,
        ru.total_points,
        (SELECT COUNT(*) FROM ranked_users)::BIGINT as total
    FROM ranked_users ru
    WHERE ru.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_rank IS 'Get a user''s rank, points, and total user count for a leaderboard';

-- =============================================================================
-- STEP 6: Verify the fix
-- =============================================================================
-- Run this to confirm no duplicates remain:
SELECT
    user_id,
    group_id,
    period_start,
    period_end,
    COUNT(*) as entry_count
FROM leaderboard_entries
GROUP BY user_id, group_id, period_start, period_end
HAVING COUNT(*) > 1;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Leaderboard duplicates fixed! Run the verification query above to confirm.';
END $$;
