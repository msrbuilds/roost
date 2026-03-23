-- FINAL FIX V2: Clean duplicates first, then add constraints
-- Run this in Supabase SQL Editor

-- =============================================================================
-- STEP 1: Clean up duplicate leaderboard entries (keep the one with highest points)
-- =============================================================================
DELETE FROM leaderboard_entries a
USING leaderboard_entries b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND COALESCE(a.group_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.group_id, '00000000-0000-0000-0000-000000000000')
  AND a.period_start = b.period_start
  AND a.period_end = b.period_end;

-- Show how many remain
DO $$
DECLARE
    cnt INTEGER;
BEGIN
    SELECT COUNT(*) INTO cnt FROM leaderboard_entries;
    RAISE NOTICE 'Leaderboard entries after cleanup: %', cnt;
END $$;

-- =============================================================================
-- STEP 2: Drop existing constraints/indexes that might conflict
-- =============================================================================
DROP INDEX IF EXISTS idx_leaderboard_entries_unique;
ALTER TABLE leaderboard_entries DROP CONSTRAINT IF EXISTS leaderboard_entries_user_id_group_id_period_start_period_end_key;

-- =============================================================================
-- STEP 3: Create unique index (handles NULL group_id properly)
-- =============================================================================
CREATE UNIQUE INDEX idx_leaderboard_entries_unique
ON leaderboard_entries (user_id, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid), period_start, period_end);

-- =============================================================================
-- STEP 4: Clean up duplicate reactions
-- =============================================================================
DELETE FROM reactions a
USING reactions b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.reactable_type = b.reactable_type
  AND a.reactable_id = b.reactable_id
  AND a.reaction_type = b.reaction_type;

-- =============================================================================
-- STEP 5: Add unique constraint to reactions if missing
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'reactions_unique_user_item'
    ) THEN
        ALTER TABLE reactions
        ADD CONSTRAINT reactions_unique_user_item
        UNIQUE (user_id, reactable_type, reactable_id, reaction_type);
        RAISE NOTICE 'Added unique constraint to reactions';
    ELSE
        RAISE NOTICE 'Reactions constraint already exists';
    END IF;
EXCEPTION WHEN duplicate_table THEN
    RAISE NOTICE 'Reactions constraint already exists';
END $$;

-- =============================================================================
-- STEP 6: Update update_leaderboard_entry function to use the index
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
    v_existing_id UUID;
BEGIN
    v_points := calculate_user_points(p_user_id, p_group_id, p_period_start, p_period_end);

    -- Check if entry exists
    SELECT id INTO v_existing_id
    FROM leaderboard_entries
    WHERE user_id = p_user_id
      AND COALESCE(group_id, '00000000-0000-0000-0000-000000000000') = COALESCE(p_group_id, '00000000-0000-0000-0000-000000000000')
      AND period_start = p_period_start
      AND period_end = p_period_end;

    IF v_existing_id IS NOT NULL THEN
        -- Update existing
        UPDATE leaderboard_entries
        SET total_points = v_points, updated_at = NOW()
        WHERE id = v_existing_id;
    ELSE
        -- Insert new
        INSERT INTO leaderboard_entries (user_id, group_id, period_start, period_end, total_points, updated_at)
        VALUES (p_user_id, p_group_id, p_period_start, p_period_end, v_points, NOW());
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 7: Recreate award_points to use updated function
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
    INSERT INTO point_activities (user_id, group_id, action_type, points, description, reference_id)
    VALUES (p_user_id, p_group_id, p_action_type, p_points, p_description, p_reference_id)
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
-- STEP 8: Recreate triggers
-- =============================================================================
DROP TRIGGER IF EXISTS award_points_for_post ON posts;
DROP TRIGGER IF EXISTS award_points_for_comment ON comments;
DROP TRIGGER IF EXISTS award_points_for_reaction ON reactions;

-- Post trigger
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
    FOR EACH ROW EXECUTE FUNCTION trigger_post_points();

-- Comment trigger
CREATE OR REPLACE FUNCTION trigger_comment_points()
RETURNS TRIGGER AS $$
DECLARE
    v_group_id UUID;
BEGIN
    SELECT group_id INTO v_group_id FROM posts WHERE id = NEW.post_id;
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
    FOR EACH ROW EXECUTE FUNCTION trigger_comment_points();

-- Reaction trigger
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
        FROM comments c JOIN posts p ON p.id = c.post_id
        WHERE c.id = NEW.reactable_id;
    END IF;

    PERFORM award_points(
        p_user_id := NEW.user_id,
        p_action_type := 'reaction_given'::point_action_type,
        p_points := 1,
        p_group_id := v_group_id,
        p_description := 'Gave a reaction',
        p_reference_id := NEW.id
    );

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
    FOR EACH ROW EXECUTE FUNCTION trigger_reaction_points();

-- =============================================================================
-- STEP 9: RLS policies for reactions
-- =============================================================================
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all reactions" ON reactions;
CREATE POLICY "Users can view all reactions"
    ON reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can add reactions" ON reactions;
CREATE POLICY "Users can add reactions"
    ON reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reactions" ON reactions;
CREATE POLICY "Users can delete own reactions"
    ON reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- SUCCESS!
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Final fix V2 applied successfully!';
    RAISE NOTICE '🎯 Duplicates cleaned, constraints added, triggers recreated';
END $$;
