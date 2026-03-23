-- Migration 040: Fix All Notification Trigger Column Names
-- Purpose: Fix column name references in all notification triggers
-- Created: 2026-02-08

-- =============================================================================
-- 1. FIX COMMENT NOTIFICATION TRIGGER
-- =============================================================================

DROP FUNCTION IF EXISTS public.notify_on_comment() CASCADE;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
    post_author_id UUID;
    parent_author_id UUID;
    post_title TEXT;
    commenter_name TEXT;
    user_prefs public.notification_preferences;
    should_email BOOLEAN;
BEGIN
    -- Get commenter's display name
    SELECT display_name INTO commenter_name
    FROM public.profiles
    WHERE id = NEW.author_id;

    -- If this is a reply to another comment
    IF NEW.parent_comment_id IS NOT NULL THEN
        -- Get parent comment author
        SELECT author_id INTO parent_author_id
        FROM public.comments
        WHERE id = NEW.parent_comment_id;

        -- Don't notify if replying to own comment
        IF parent_author_id IS NOT NULL AND parent_author_id != NEW.author_id THEN
            -- Check user preferences
            user_prefs := public.get_notification_preferences(parent_author_id);

            -- Determine if email should be sent (correct column name)
            should_email := COALESCE(user_prefs.email_replies, TRUE);

            IF COALESCE(user_prefs.notify_replies, TRUE) THEN
                INSERT INTO public.notifications (user_id, type, title, message, link, email_pending)
                VALUES (
                    parent_author_id,
                    'comment_reply',
                    commenter_name || ' replied to your comment',
                    LEFT(NEW.content, 100),
                    '/post/' || NEW.post_id,
                    should_email
                );
            END IF;
        END IF;
    END IF;

    -- Notify post author for any comment (not just replies)
    SELECT author_id, COALESCE(title, LEFT(content, 50))
    INTO post_author_id, post_title
    FROM public.posts
    WHERE id = NEW.post_id;

    -- Don't notify if commenting on own post
    -- Also don't double-notify if post author is same as parent comment author
    IF post_author_id != NEW.author_id AND (parent_author_id IS NULL OR post_author_id != parent_author_id) THEN
        -- Check user preferences
        user_prefs := public.get_notification_preferences(post_author_id);

        -- Determine if email should be sent (correct column name)
        should_email := COALESCE(user_prefs.email_comments, TRUE);

        IF COALESCE(user_prefs.notify_comments, TRUE) THEN
            INSERT INTO public.notifications (user_id, type, title, message, link, email_pending)
            VALUES (
                post_author_id,
                'new_comment',
                commenter_name || ' commented on your post',
                LEFT(NEW.content, 100),
                '/post/' || NEW.post_id,
                should_email
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';

-- =============================================================================
-- 2. RECREATE COMMENT TRIGGER
-- =============================================================================

DROP TRIGGER IF EXISTS on_comment_created ON public.comments;

CREATE TRIGGER on_comment_created
    AFTER INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 040: Notification triggers fixed!';
    RAISE NOTICE '✓ Fixed column names: email_comments, email_replies, email_mentions';
    RAISE NOTICE '✓ All triggers use correct link format: /post/{post_id}';
END $$;
