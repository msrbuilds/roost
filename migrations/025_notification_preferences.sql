-- Migration 025: Notification Preferences & Extended Notification System
-- Run this in Supabase SQL Editor
-- Created: 2026-02-01

-- =============================================================================
-- 1. NOTIFICATION PREFERENCES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- In-app notification preferences (all default TRUE)
    notify_comments BOOLEAN DEFAULT TRUE,
    notify_replies BOOLEAN DEFAULT TRUE,
    notify_mentions BOOLEAN DEFAULT TRUE,
    notify_messages BOOLEAN DEFAULT TRUE,
    notify_reactions BOOLEAN DEFAULT TRUE,

    -- Email notification preferences (all default TRUE)
    email_comments BOOLEAN DEFAULT TRUE,
    email_replies BOOLEAN DEFAULT TRUE,
    email_mentions BOOLEAN DEFAULT TRUE,
    email_messages BOOLEAN DEFAULT TRUE,
    email_announcements BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

-- Index for user lookups
CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);

-- =============================================================================
-- 2. ADD NEW NOTIFICATION TYPE
-- =============================================================================

-- Add 'comment_reply' to notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'comment_reply';

-- =============================================================================
-- 3. ADD EMAIL TRACKING COLUMNS TO NOTIFICATIONS
-- =============================================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_pending BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- Index for pending emails
CREATE INDEX IF NOT EXISTS idx_notifications_email_pending ON notifications(email_pending) WHERE email_pending = TRUE;

-- =============================================================================
-- 4. RLS POLICIES FOR NOTIFICATION PREFERENCES
-- =============================================================================

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own notification preferences"
    ON notification_preferences FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own notification preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own notification preferences"
    ON notification_preferences FOR UPDATE
    USING (auth.uid() = user_id);

-- =============================================================================
-- 5. HELPER FUNCTION TO GET USER PREFERENCES WITH DEFAULTS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_notification_preferences(p_user_id UUID)
RETURNS TABLE (
    notify_comments BOOLEAN,
    notify_replies BOOLEAN,
    notify_mentions BOOLEAN,
    notify_messages BOOLEAN,
    notify_reactions BOOLEAN,
    email_comments BOOLEAN,
    email_replies BOOLEAN,
    email_mentions BOOLEAN,
    email_messages BOOLEAN,
    email_announcements BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(np.notify_comments, TRUE),
        COALESCE(np.notify_replies, TRUE),
        COALESCE(np.notify_mentions, TRUE),
        COALESCE(np.notify_messages, TRUE),
        COALESCE(np.notify_reactions, TRUE),
        COALESCE(np.email_comments, TRUE),
        COALESCE(np.email_replies, TRUE),
        COALESCE(np.email_mentions, TRUE),
        COALESCE(np.email_messages, TRUE),
        COALESCE(np.email_announcements, TRUE)
    FROM (SELECT 1) AS dummy
    LEFT JOIN notification_preferences np ON np.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. FUNCTION TO EXTRACT @MENTIONS FROM TEXT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.extract_mentions(content TEXT)
RETURNS TEXT[] AS $$
DECLARE
    mentions TEXT[];
    match_result TEXT[];
BEGIN
    -- Extract @username patterns (3-30 chars, alphanumeric, underscore, hyphen)
    SELECT ARRAY_AGG(DISTINCT LOWER(m[1]))
    INTO mentions
    FROM regexp_matches(content, '@([a-zA-Z0-9_-]{3,30})', 'g') AS m;

    RETURN COALESCE(mentions, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- 7. UPDATED COMMENT NOTIFICATION FUNCTION (with preferences & reply detection)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
    post_author_id UUID;
    parent_author_id UUID;
    post_title TEXT;
    commenter_name TEXT;
    user_prefs RECORD;
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
            SELECT * INTO user_prefs
            FROM get_notification_preferences(parent_author_id);

            -- Determine if email should be sent
            should_email := user_prefs.email_replies;

            IF user_prefs.notify_replies THEN
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
        SELECT * INTO user_prefs
        FROM get_notification_preferences(post_author_id);

        -- Determine if email should be sent
        should_email := user_prefs.email_comments;

        IF user_prefs.notify_comments THEN
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
-- 8. UPDATED REACTION NOTIFICATION FUNCTION (with preferences)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS TRIGGER AS $$
DECLARE
    content_author_id UUID;
    reactor_name TEXT;
    notification_title TEXT;
    notification_link TEXT;
    user_prefs RECORD;
    should_email BOOLEAN;
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
        SELECT * INTO user_prefs
        FROM get_notification_preferences(content_author_id);

        IF user_prefs.notify_reactions THEN
            INSERT INTO notifications (user_id, type, title, link, email_pending)
            VALUES (
                content_author_id,
                'new_reaction',
                notification_title,
                notification_link,
                FALSE -- Reactions don't send emails by default
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 9. UPDATED MESSAGE NOTIFICATION FUNCTION (with preferences)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER AS $$
DECLARE
    sender_name TEXT;
    user_prefs RECORD;
    should_email BOOLEAN;
BEGIN
    -- Get sender's display name
    SELECT display_name INTO sender_name
    FROM profiles
    WHERE id = NEW.sender_id;

    -- Check recipient's preferences
    SELECT * INTO user_prefs
    FROM get_notification_preferences(NEW.recipient_id);

    -- Determine if email should be sent
    should_email := user_prefs.email_messages;

    IF user_prefs.notify_messages THEN
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
-- 10. MENTION NOTIFICATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_mention()
RETURNS TRIGGER AS $$
DECLARE
    mentioned_usernames TEXT[];
    mentioned_user RECORD;
    commenter_name TEXT;
    user_prefs RECORD;
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
        SELECT * INTO user_prefs
        FROM get_notification_preferences(mentioned_user.id);

        -- Determine if email should be sent
        should_email := user_prefs.email_mentions;

        IF user_prefs.notify_mentions THEN
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

-- Create trigger for mentions (runs after the comment notification trigger)
DROP TRIGGER IF EXISTS on_comment_mention ON comments;
CREATE TRIGGER on_comment_mention
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_mention();

-- =============================================================================
-- 11. FUNCTION TO PROCESS PENDING NOTIFICATION EMAILS (called by backend)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_notification_emails(batch_size INTEGER DEFAULT 50)
RETURNS TABLE (
    notification_id UUID,
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    notification_type notification_type,
    title TEXT,
    message TEXT,
    link TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id AS notification_id,
        n.user_id,
        au.email AS user_email,
        p.display_name AS user_name,
        n.type AS notification_type,
        n.title,
        n.message,
        n.link,
        n.created_at
    FROM notifications n
    JOIN profiles p ON p.id = n.user_id
    JOIN auth.users au ON au.id = n.user_id
    WHERE n.email_pending = TRUE
    ORDER BY n.created_at ASC
    LIMIT batch_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification email as sent
CREATE OR REPLACE FUNCTION public.mark_notification_email_sent(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE notifications
    SET email_pending = FALSE,
        email_sent_at = NOW()
    WHERE id = p_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SUMMARY OF CHANGES
-- =============================================================================
-- 1. Created notification_preferences table with in-app and email preferences
-- 2. Added 'comment_reply' to notification_type enum
-- 3. Added email_pending and email_sent_at columns to notifications table
-- 4. Created get_notification_preferences() helper function
-- 5. Created extract_mentions() function for @mention detection
-- 6. Updated notify_on_comment() with reply detection and preference checking
-- 7. Updated notify_on_reaction() with preference checking
-- 8. Updated notify_on_message() with preference checking
-- 9. Created notify_on_mention() for @mention notifications
-- 10. Created get_pending_notification_emails() for email processing
-- 11. Created mark_notification_email_sent() for marking emails as sent
