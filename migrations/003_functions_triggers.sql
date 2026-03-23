-- Migration 003: Database Functions and Triggers
-- Run this in Supabase SQL Editor AFTER running 002_rls_policies.sql
-- Created: 2026-01-17

-- =============================================================================
-- 1. AUTOMATIC PROFILE CREATION ON SIGNUP
-- =============================================================================

-- Function to create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'New User'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 2. UPDATE LAST_SEEN_AT ON USER ACTIVITY
-- =============================================================================

-- Function to update last_seen_at timestamp
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET last_seen_at = NOW(),
        is_online = true
    WHERE id = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to posts (when user creates a post, they're active)
DROP TRIGGER IF EXISTS update_last_seen_on_post ON posts;
CREATE TRIGGER update_last_seen_on_post
    AFTER INSERT ON posts
    FOR EACH ROW EXECUTE FUNCTION public.update_last_seen();

-- Apply to comments
DROP TRIGGER IF EXISTS update_last_seen_on_comment ON comments;
CREATE TRIGGER update_last_seen_on_comment
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION public.update_last_seen();

-- Apply to messages
DROP TRIGGER IF EXISTS update_last_seen_on_message ON messages;
CREATE TRIGGER update_last_seen_on_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION public.update_last_seen();

-- =============================================================================
-- 3. AUTOMATIC GROUP ADMIN ASSIGNMENT
-- =============================================================================

-- Function to automatically add group creator as admin
CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to add creator as admin when group is created
DROP TRIGGER IF EXISTS on_group_created ON groups;
CREATE TRIGGER on_group_created
    AFTER INSERT ON groups
    FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_admin();

-- =============================================================================
-- 4. NOTIFICATION CREATION FUNCTIONS
-- =============================================================================

-- Function to create notification for new comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
    post_author_id UUID;
    post_title TEXT;
    commenter_name TEXT;
BEGIN
    -- Get post author and title
    SELECT author_id, COALESCE(title, LEFT(content, 50))
    INTO post_author_id, post_title
    FROM posts
    WHERE id = NEW.post_id;
    
    -- Get commenter's display name
    SELECT display_name INTO commenter_name
    FROM profiles
    WHERE id = NEW.author_id;
    
    -- Don't notify if commenting on own post
    IF post_author_id != NEW.author_id THEN
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (
            post_author_id,
            'new_comment',
            commenter_name || ' commented on your post',
            LEFT(NEW.content, 100),
            '/posts/' || NEW.post_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for comment notifications
DROP TRIGGER IF EXISTS on_comment_created ON comments;
CREATE TRIGGER on_comment_created
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Function to create notification for new reaction
CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS TRIGGER AS $$
DECLARE
    content_author_id UUID;
    reactor_name TEXT;
    notification_title TEXT;
    notification_link TEXT;
BEGIN
    -- Get reactor's display name
    SELECT display_name INTO reactor_name
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- Handle post reactions
    IF NEW.reactable_type = 'post' THEN
        SELECT author_id INTO content_author_id
        FROM posts
        WHERE id = NEW.reactable_id;
        
        notification_link := '/posts/' || NEW.reactable_id;
        notification_title := reactor_name || ' reacted to your post';
    
    -- Handle comment reactions
    ELSIF NEW.reactable_type = 'comment' THEN
        SELECT author_id INTO content_author_id
        FROM comments
        WHERE id = NEW.reactable_id;
        
        SELECT '/posts/' || post_id INTO notification_link
        FROM comments
        WHERE id = NEW.reactable_id;
        
        notification_title := reactor_name || ' reacted to your comment';
    END IF;
    
    -- Don't notify if reacting to own content
    IF content_author_id != NEW.user_id THEN
        INSERT INTO notifications (user_id, type, title, link)
        VALUES (
            content_author_id,
            'new_reaction',
            notification_title,
            notification_link
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for reaction notifications
DROP TRIGGER IF EXISTS on_reaction_created ON reactions;
CREATE TRIGGER on_reaction_created
    AFTER INSERT ON reactions
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

-- Function to create notification for new message
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER AS $$
DECLARE
    sender_name TEXT;
BEGIN
    -- Get sender's display name
    SELECT display_name INTO sender_name
    FROM profiles
    WHERE id = NEW.sender_id;
    
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
        NEW.recipient_id,
        'new_message',
        'New message from ' || sender_name,
        LEFT(NEW.content, 100),
        '/messages/' || NEW.sender_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for message notifications
DROP TRIGGER IF EXISTS on_message_created ON messages;
CREATE TRIGGER on_message_created
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- =============================================================================
-- 5. LEADERBOARD POINTS CALCULATION
-- =============================================================================

-- Function to award points for various activities
CREATE OR REPLACE FUNCTION public.award_points(
    p_user_id UUID,
    p_group_id UUID,
    p_points INTEGER
)
RETURNS VOID AS $$
DECLARE
    current_period_start DATE;
    current_period_end DATE;
BEGIN
    -- Calculate current 30-day period
    current_period_start := DATE_TRUNC('day', NOW() - INTERVAL '30 days')::DATE;
    current_period_end := CURRENT_DATE;
    
    -- Insert or update leaderboard entry
    INSERT INTO leaderboard_entries (user_id, group_id, points, period_start, period_end)
    VALUES (p_user_id, p_group_id, p_points, current_period_start, current_period_end)
    ON CONFLICT (user_id, group_id, period_start)
    DO UPDATE SET
        points = leaderboard_entries.points + p_points,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to award points on post creation
CREATE OR REPLACE FUNCTION public.award_points_on_post()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM award_points(NEW.author_id, NEW.group_id, 5); -- 5 points for creating a post
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for post points
DROP TRIGGER IF EXISTS award_points_on_post_trigger ON posts;
CREATE TRIGGER award_points_on_post_trigger
    AFTER INSERT ON posts
    FOR EACH ROW EXECUTE FUNCTION public.award_points_on_post();

-- Function to award points on comment creation
CREATE OR REPLACE FUNCTION public.award_points_on_comment()
RETURNS TRIGGER AS $$
DECLARE
    post_group_id UUID;
BEGIN
    -- Get the group_id from the post
    SELECT group_id INTO post_group_id
    FROM posts
    WHERE id = NEW.post_id;
    
    PERFORM award_points(NEW.author_id, post_group_id, 2); -- 2 points for commenting
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for comment points
DROP TRIGGER IF EXISTS award_points_on_comment_trigger ON comments;
CREATE TRIGGER award_points_on_comment_trigger
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION public.award_points_on_comment();

-- Function to award points on receiving reactions
CREATE OR REPLACE FUNCTION public.award_points_on_reaction()
RETURNS TRIGGER AS $$
DECLARE
    content_author_id UUID;
    content_group_id UUID;
BEGIN
    -- Handle post reactions
    IF NEW.reactable_type = 'post' THEN
        SELECT author_id, group_id INTO content_author_id, content_group_id
        FROM posts
        WHERE id = NEW.reactable_id;
        
        PERFORM award_points(content_author_id, content_group_id, 1); -- 1 point for receiving reaction
    
    -- Handle comment reactions
    ELSIF NEW.reactable_type = 'comment' THEN
        SELECT c.author_id, p.group_id INTO content_author_id, content_group_id
        FROM comments c
        JOIN posts p ON c.post_id = p.id
        WHERE c.id = NEW.reactable_id;
        
        PERFORM award_points(content_author_id, content_group_id, 1); -- 1 point for receiving reaction
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for reaction points
DROP TRIGGER IF EXISTS award_points_on_reaction_trigger ON reactions;
CREATE TRIGGER award_points_on_reaction_trigger
    AFTER INSERT ON reactions
    FOR EACH ROW EXECUTE FUNCTION public.award_points_on_reaction();

-- =============================================================================
-- 6. UTILITY FUNCTIONS
-- =============================================================================

-- Function to get post count for a user
CREATE OR REPLACE FUNCTION public.get_user_post_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM posts WHERE author_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comment count for a user
CREATE OR REPLACE FUNCTION public.get_user_comment_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM comments WHERE author_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get group member count
CREATE OR REPLACE FUNCTION public.get_group_member_count(p_group_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM group_members WHERE group_id = p_group_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get online member count for a group
CREATE OR REPLACE FUNCTION public.get_group_online_count(p_group_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM group_members gm
        JOIN profiles p ON gm.user_id = p.id
        WHERE gm.group_id = p_group_id
        AND p.is_online = true
        AND p.last_seen_at > NOW() - INTERVAL '5 minutes'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark message as read
CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE messages
    SET is_read = true,
        read_at = NOW()
    WHERE id = p_message_id
    AND recipient_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS VOID AS $$
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE user_id = auth.uid()
    AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7. SEARCH FUNCTIONS
-- =============================================================================

-- Function to search posts by content
CREATE OR REPLACE FUNCTION public.search_posts(
    p_search_term TEXT,
    p_group_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    author_id UUID,
    group_id UUID,
    created_at TIMESTAMPTZ,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.title,
        p.content,
        p.author_id,
        p.group_id,
        p.created_at,
        ts_rank(
            to_tsvector('english', COALESCE(p.title, '') || ' ' || p.content),
            plainto_tsquery('english', p_search_term)
        ) AS rank
    FROM posts p
    WHERE
        (p_group_id IS NULL OR p.group_id = p_group_id)
        AND to_tsvector('english', COALESCE(p.title, '') || ' ' || p.content) @@ plainto_tsquery('english', p_search_term)
    ORDER BY rank DESC, p.created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search users
CREATE OR REPLACE FUNCTION public.search_users(p_search_term TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.username,
        p.display_name,
        p.avatar_url,
        p.bio
    FROM profiles p
    WHERE
        p.username ILIKE '%' || p_search_term || '%'
        OR p.display_name ILIKE '%' || p_search_term || '%'
    ORDER BY
        CASE
            WHEN p.username ILIKE p_search_term || '%' THEN 1
            WHEN p.display_name ILIKE p_search_term || '%' THEN 2
            ELSE 3
        END,
        p.username
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 8. CLEANUP FUNCTIONS
-- =============================================================================

-- Function to clean up old notifications (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS VOID AS $$
BEGIN
    DELETE FROM notifications
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND is_read = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old leaderboard entries (older than 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_leaderboard_entries()
RETURNS VOID AS $$
BEGIN
    DELETE FROM leaderboard_entries
    WHERE period_end < CURRENT_DATE - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 003: Functions and triggers created successfully!';
    RAISE NOTICE '🎯 Automatic profile creation enabled';
    RAISE NOTICE '🔔 Notification system configured';
    RAISE NOTICE '🏆 Leaderboard points system active';
    RAISE NOTICE '🔍 Search functions ready';
END $$;
