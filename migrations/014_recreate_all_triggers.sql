-- Migration 014: Recreate All Triggers After Function Updates
-- This ensures all triggers use the correct function signatures
-- Run this in Supabase SQL Editor AFTER migrations 012 and 013
-- Created: 2026-01-27

-- =============================================================================
-- DROP ALL EXISTING TRIGGERS AND TRIGGER FUNCTIONS
-- =============================================================================

DROP TRIGGER IF EXISTS award_points_for_post ON posts;
DROP TRIGGER IF EXISTS award_points_for_comment ON comments;
DROP TRIGGER IF EXISTS award_points_for_reaction ON reactions;
DROP FUNCTION IF EXISTS trigger_post_points CASCADE;
DROP FUNCTION IF EXISTS trigger_comment_points CASCADE;
DROP FUNCTION IF EXISTS trigger_reaction_points CASCADE;

-- =============================================================================
-- RECREATE TRIGGER FUNCTIONS WITH PROPER TYPE HANDLING
-- =============================================================================

-- 1. TRIGGER FUNCTION: AWARD POINTS FOR NEW POSTS
CREATE OR REPLACE FUNCTION trigger_post_points()
RETURNS TRIGGER AS $$
BEGIN
    -- Call award_points with explicit parameter names to avoid ambiguity
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

COMMENT ON FUNCTION trigger_post_points IS 'Trigger function to award 10 points when a post is created';

-- 2. TRIGGER FUNCTION: AWARD POINTS FOR NEW COMMENTS
CREATE OR REPLACE FUNCTION trigger_comment_points()
RETURNS TRIGGER AS $$
DECLARE
    v_group_id UUID;
BEGIN
    -- Get group_id from the post
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

COMMENT ON FUNCTION trigger_comment_points IS 'Trigger function to award 5 points when a comment is created';

-- 3. TRIGGER FUNCTION: AWARD POINTS FOR REACTIONS
CREATE OR REPLACE FUNCTION trigger_reaction_points()
RETURNS TRIGGER AS $$
DECLARE
    v_content_author_id UUID;
    v_group_id UUID;
BEGIN
    -- Get the author of the content that received the reaction
    IF NEW.reactable_type = 'post' THEN
        SELECT author_id, group_id INTO v_content_author_id, v_group_id
        FROM posts WHERE id = NEW.reactable_id;
    ELSIF NEW.reactable_type = 'comment' THEN
        SELECT c.author_id, p.group_id INTO v_content_author_id, v_group_id
        FROM comments c
        JOIN posts p ON p.id = c.post_id
        WHERE c.id = NEW.reactable_id;
    END IF;
    
    -- Award points to reaction giver (1 point)
    PERFORM award_points(
        p_user_id := NEW.user_id,
        p_action_type := 'reaction_given'::point_action_type,
        p_points := 1,
        p_group_id := v_group_id,
        p_description := 'Gave a reaction',
        p_reference_id := NEW.id
    );
    
    -- Award points to content author (2 points)
    -- Only if the author is not reacting to their own content
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

COMMENT ON FUNCTION trigger_reaction_points IS 'Trigger function to award 1 point to reaction giver and 2 points to content author';

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 014: All triggers recreated successfully!';
    RAISE NOTICE '🎯 Triggers now use named parameters for clarity';
END $$;
