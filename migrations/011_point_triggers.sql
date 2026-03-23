-- Migration 011: Point Triggers
-- Run this in Supabase SQL Editor
-- Created: 2026-01-27
-- Description: Automatic point awarding via database triggers

-- =============================================================================
-- 1. TRIGGER FUNCTION: AWARD POINTS FOR NEW POSTS
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_post_points()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM award_points(
        NEW.author_id,
        'post_created',
        10,
        NEW.group_id,
        'Created a new post',
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER award_points_for_post
    AFTER INSERT ON posts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_post_points();

COMMENT ON FUNCTION trigger_post_points IS 'Trigger function to award 10 points when a post is created';

-- =============================================================================
-- 2. TRIGGER FUNCTION: AWARD POINTS FOR NEW COMMENTS
-- =============================================================================
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
        NEW.author_id,
        'comment_created',
        5,
        v_group_id,
        'Created a new comment',
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER award_points_for_comment
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_comment_points();

COMMENT ON FUNCTION trigger_comment_points IS 'Trigger function to award 5 points when a comment is created';

-- =============================================================================
-- 3. TRIGGER FUNCTION: AWARD POINTS FOR REACTIONS
-- =============================================================================
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
        NEW.user_id,
        'reaction_given',
        1,
        v_group_id,
        'Gave a reaction',
        NEW.id
    );
    
    -- Award points to content author (2 points)
    -- Only if the author is not reacting to their own content
    IF v_content_author_id IS NOT NULL AND v_content_author_id != NEW.user_id THEN
        PERFORM award_points(
            v_content_author_id,
            'reaction_received',
            2,
            v_group_id,
            'Received a reaction',
            NEW.id
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
-- 4. TRIGGER FUNCTION: AWARD POINTS FOR EVENT ATTENDANCE (PLACEHOLDER)
-- =============================================================================
-- Note: This trigger will be activated in Phase 7.2 when events are implemented
-- For now, we create the function but comment out the trigger

CREATE OR REPLACE FUNCTION trigger_event_attendance_points()
RETURNS TRIGGER AS $$
DECLARE
    v_group_id UUID;
BEGIN
    -- Only award points for 'going' status
    IF NEW.status = 'going' THEN
        SELECT group_id INTO v_group_id
        FROM events WHERE id = NEW.event_id;
        
        PERFORM award_points(
            NEW.user_id,
            'event_attended',
            15,
            v_group_id,
            'RSVP''d to an event',
            NEW.event_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger will be created in Phase 7.2 when event_attendees table is ready
-- CREATE TRIGGER award_points_for_event_attendance
--     AFTER INSERT ON event_attendees
--     FOR EACH ROW
--     EXECUTE FUNCTION trigger_event_attendance_points();

COMMENT ON FUNCTION trigger_event_attendance_points IS 'Trigger function to award 15 points when user RSVPs to an event (will be activated in Phase 7.2)';

-- =============================================================================
-- 5. TRIGGER FUNCTION: REVERSE POINTS ON DELETION (OPTIONAL)
-- =============================================================================
-- This function handles point reversal when content is deleted
-- Currently disabled to maintain point integrity (users keep points for deleted content)
-- Can be enabled later if needed

CREATE OR REPLACE FUNCTION trigger_reverse_post_points()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM award_points(
        OLD.author_id,
        'post_created',
        -10, -- Negative points to reverse
        OLD.group_id,
        'Post was deleted',
        OLD.id
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disabled by default - uncomment to enable
-- CREATE TRIGGER reverse_points_for_deleted_post
--     AFTER DELETE ON posts
--     FOR EACH ROW
--     EXECUTE FUNCTION trigger_reverse_post_points();

COMMENT ON FUNCTION trigger_reverse_post_points IS 'Trigger function to reverse points when a post is deleted (disabled by default)';

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 011: Point triggers created successfully!';
    RAISE NOTICE '📝 Note: Event attendance trigger will be activated in Phase 7.2';
END $$;
