-- Migration 026: Fix Notification Triggers
-- Run this in Supabase SQL Editor
-- Created: 2026-02-01
-- Purpose: Fix the get_notification_preferences function call in triggers

-- =============================================================================
-- 1. FIX: Change get_notification_preferences to return a single record
-- =============================================================================

-- Drop the old function
DROP FUNCTION IF EXISTS public.get_notification_preferences(UUID);

-- Recreate as a function that returns a single composite type
CREATE OR REPLACE FUNCTION public.get_notification_preferences(p_user_id UUID)
RETURNS notification_preferences AS $$
DECLARE
    result notification_preferences;
BEGIN
    SELECT * INTO result
    FROM notification_preferences
    WHERE user_id = p_user_id;

    -- If no preferences found, return defaults
    IF result IS NULL THEN
        result.user_id := p_user_id;
        result.notify_comments := TRUE;
        result.notify_replies := TRUE;
        result.notify_mentions := TRUE;
        result.notify_messages := TRUE;
        result.notify_reactions := TRUE;
        result.email_comments := TRUE;
        result.email_replies := TRUE;
        result.email_mentions := TRUE;
        result.email_messages := TRUE;
        result.email_announcements := TRUE;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. RECREATE COMMENT NOTIFICATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
    post_author_id UUID;
    parent_author_id UUID;
    post_title TEXT;
    commenter_name TEXT;
    user_prefs notification_preferences;
    should_email BOOLEAN;
BEGIN
    -- Get commenter's display name
    SELECT display_name INTO commenter_name
    FROM profiles
    WHERE id = NEW.author_id;

    -- If this is a reply to another comment
    IF NEW.parent_comment_id IS NOT NULL THEN
        -- Get parent comment author
        SELECT author_id INTO parent_author_id
        FROM comments
        WHERE id = NEW.parent_comment_id;

        -- Don't notify if replying to own comment
        IF parent_author_id IS NOT NULL AND parent_author_id != NEW.author_id THEN
            -- Check user preferences
            user_prefs := get_notification_preferences(parent_author_id);

            -- Determine if email should be sent
            should_email := COALESCE(user_prefs.email_replies, TRUE);

            IF COALESCE(user_prefs.notify_replies, TRUE) THEN
                INSERT INTO notifications (user_id, type, title, message, link, email_pending)
                VALUES (
                    parent_author_id,
                    'comment_reply',
                    commenter_name || ' replied to your comment',
                    LEFT(NEW.content, 100),
                    '/posts/' || NEW.post_id,
                    should_email
                );
            END IF;
        END IF;
    END IF;

    -- Notify post author for any comment (not just replies)
    SELECT author_id, COALESCE(title, LEFT(content, 50))
    INTO post_author_id, post_title
    FROM posts
    WHERE id = NEW.post_id;

    -- Don't notify if commenting on own post
    -- Also don't double-notify if post author is same as parent comment author
    IF post_author_id != NEW.author_id AND (parent_author_id IS NULL OR post_author_id != parent_author_id) THEN
        -- Check user preferences
        user_prefs := get_notification_preferences(post_author_id);

        -- Determine if email should be sent
        should_email := COALESCE(user_prefs.email_comments, TRUE);

        IF COALESCE(user_prefs.notify_comments, TRUE) THEN
            INSERT INTO notifications (user_id, type, title, message, link, email_pending)
            VALUES (
                post_author_id,
                'new_comment',
                commenter_name || ' commented on your post',
                LEFT(NEW.content, 100),
                '/posts/' || NEW.post_id,
                should_email
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. RECREATE REACTION NOTIFICATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS TRIGGER AS $$
DECLARE
    content_author_id UUID;
    reactor_name TEXT;
    notification_title TEXT;
    notification_link TEXT;
    user_prefs notification_preferences;
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

    -- Handle showcase reactions
    ELSIF NEW.reactable_type = 'showcase' THEN
        SELECT author_id INTO content_author_id
        FROM showcases
        WHERE id = NEW.reactable_id;

        notification_link := '/showcase/' || NEW.reactable_id;
        notification_title := reactor_name || ' reacted to your showcase';
    END IF;

    -- Don't notify if reacting to own content
    IF content_author_id IS NOT NULL AND content_author_id != NEW.user_id THEN
        -- Check user preferences
        user_prefs := get_notification_preferences(content_author_id);

        IF COALESCE(user_prefs.notify_reactions, TRUE) THEN
            INSERT INTO notifications (user_id, type, title, link, email_pending)
            VALUES (
                content_author_id,
                'new_reaction',
                notification_title,
                notification_link,
                FALSE -- Reactions don't send emails
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. RECREATE MESSAGE NOTIFICATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER AS $$
DECLARE
    sender_name TEXT;
    user_prefs notification_preferences;
    should_email BOOLEAN;
BEGIN
    -- Get sender's display name
    SELECT display_name INTO sender_name
    FROM profiles
    WHERE id = NEW.sender_id;

    -- Check recipient's preferences
    user_prefs := get_notification_preferences(NEW.recipient_id);

    -- Determine if email should be sent
    should_email := COALESCE(user_prefs.email_messages, TRUE);

    IF COALESCE(user_prefs.notify_messages, TRUE) THEN
        INSERT INTO notifications (user_id, type, title, message, link, email_pending)
        VALUES (
            NEW.recipient_id,
            'new_message',
            'New message from ' || sender_name,
            LEFT(NEW.content, 100),
            '/messages/' || NEW.sender_id,
            should_email
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. RECREATE MENTION NOTIFICATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_mention()
RETURNS TRIGGER AS $$
DECLARE
    mentioned_usernames TEXT[];
    mentioned_user RECORD;
    commenter_name TEXT;
    user_prefs notification_preferences;
    should_email BOOLEAN;
BEGIN
    -- Extract mentions from comment content
    mentioned_usernames := extract_mentions(NEW.content);

    IF array_length(mentioned_usernames, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get commenter's display name
    SELECT display_name INTO commenter_name
    FROM profiles
    WHERE id = NEW.author_id;

    -- Notify each mentioned user
    FOR mentioned_user IN
        SELECT id, username
        FROM profiles
        WHERE LOWER(username) = ANY(mentioned_usernames)
        AND id != NEW.author_id  -- Don't notify self-mention
    LOOP
        -- Check user preferences
        user_prefs := get_notification_preferences(mentioned_user.id);

        -- Determine if email should be sent
        should_email := COALESCE(user_prefs.email_mentions, TRUE);

        IF COALESCE(user_prefs.notify_mentions, TRUE) THEN
            INSERT INTO notifications (user_id, type, title, message, link, email_pending)
            VALUES (
                mentioned_user.id,
                'mention',
                commenter_name || ' mentioned you in a comment',
                LEFT(NEW.content, 100),
                '/posts/' || NEW.post_id,
                should_email
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. ENSURE TRIGGERS EXIST
-- =============================================================================

-- Drop and recreate triggers to ensure they use the updated functions
DROP TRIGGER IF EXISTS on_comment_created ON comments;
CREATE TRIGGER on_comment_created
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

DROP TRIGGER IF EXISTS on_reaction_created ON reactions;
CREATE TRIGGER on_reaction_created
    AFTER INSERT ON reactions
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

DROP TRIGGER IF EXISTS on_message_created ON messages;
CREATE TRIGGER on_message_created
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

DROP TRIGGER IF EXISTS on_comment_mention ON comments;
CREATE TRIGGER on_comment_mention
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_mention();

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 026: Notification triggers fixed!';
    RAISE NOTICE '📧 Triggers now properly check user preferences';
END $$;
