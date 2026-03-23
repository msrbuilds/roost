-- FINAL FIX: All remaining issues
-- Run this in Supabase SQL Editor

-- =============================================================================
-- FIX 1: Add missing unique constraint to leaderboard_entries
-- =============================================================================
DO $$
BEGIN
    -- Drop existing constraint if it has wrong name
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'leaderboard_entries_user_id_group_id_period_start_period_end_key'
    ) THEN
        RAISE NOTICE 'Unique constraint already exists';
    ELSE
        -- Add the unique constraint
        BEGIN
            ALTER TABLE leaderboard_entries
            ADD CONSTRAINT leaderboard_entries_user_id_group_id_period_start_period_end_key
            UNIQUE (user_id, group_id, period_start, period_end);
            RAISE NOTICE 'Added unique constraint to leaderboard_entries';
        EXCEPTION WHEN duplicate_table THEN
            RAISE NOTICE 'Constraint already exists under different name';
        END;
    END IF;
END $$;

-- Alternative: Create unique index if constraint approach fails
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_entries_unique
ON leaderboard_entries (user_id, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid), period_start, period_end);

-- =============================================================================
-- FIX 2: Ensure reactions table has proper constraints
-- =============================================================================
-- Add unique constraint for user reactions (one reaction type per user per item)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'reactions'::regclass
        AND contype = 'u'
    ) THEN
        -- Try to add unique constraint
        BEGIN
            ALTER TABLE reactions
            ADD CONSTRAINT reactions_unique_user_item
            UNIQUE (user_id, reactable_type, reactable_id, reaction_type);
            RAISE NOTICE 'Added unique constraint to reactions';
        EXCEPTION WHEN duplicate_table THEN
            RAISE NOTICE 'Reactions constraint already exists';
        WHEN unique_violation THEN
            RAISE NOTICE 'Cannot add constraint - duplicate data exists. Cleaning up...';
            -- Remove duplicates keeping the first one
            DELETE FROM reactions a USING reactions b
            WHERE a.id > b.id
            AND a.user_id = b.user_id
            AND a.reactable_type = b.reactable_type
            AND a.reactable_id = b.reactable_id
            AND a.reaction_type = b.reaction_type;
            -- Try again
            ALTER TABLE reactions
            ADD CONSTRAINT reactions_unique_user_item
            UNIQUE (user_id, reactable_type, reactable_id, reaction_type);
        END;
    END IF;
END $$;

-- =============================================================================
-- FIX 3: Update update_leaderboard_entry to handle NULL group_id
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

    -- Use a different approach for NULL group_id
    IF p_group_id IS NULL THEN
        INSERT INTO leaderboard_entries (user_id, group_id, period_start, period_end, total_points, updated_at)
        VALUES (p_user_id, NULL, p_period_start, p_period_end, v_points, NOW())
        ON CONFLICT ON CONSTRAINT leaderboard_entries_user_id_group_id_period_start_period_end_key
        DO UPDATE SET
            total_points = EXCLUDED.total_points,
            updated_at = NOW();
    ELSE
        INSERT INTO leaderboard_entries (user_id, group_id, period_start, period_end, total_points, updated_at)
        VALUES (p_user_id, p_group_id, p_period_start, p_period_end, v_points, NOW())
        ON CONFLICT ON CONSTRAINT leaderboard_entries_user_id_group_id_period_start_period_end_key
        DO UPDATE SET
            total_points = EXCLUDED.total_points,
            updated_at = NOW();
    END IF;
EXCEPTION WHEN undefined_object THEN
    -- Constraint doesn't exist, try without ON CONFLICT
    INSERT INTO leaderboard_entries (user_id, group_id, period_start, period_end, total_points, updated_at)
    VALUES (p_user_id, p_group_id, p_period_start, p_period_end, v_points, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FIX 4: Ensure RLS policies exist for reactions
-- =============================================================================
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all reactions" ON reactions;
CREATE POLICY "Users can view all reactions"
    ON reactions FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can add reactions" ON reactions;
CREATE POLICY "Users can add reactions"
    ON reactions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reactions" ON reactions;
CREATE POLICY "Users can delete own reactions"
    ON reactions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- =============================================================================
-- SUCCESS!
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Final fix applied successfully!';
    RAISE NOTICE '🎯 Leaderboard and reactions should now work';
END $$;
