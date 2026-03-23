-- Migration 039: Fix Mention Notification Trigger
-- Purpose: Fix the notify_on_mention trigger to use correct link format
-- Created: 2026-02-08

-- =============================================================================
-- DROP AND RECREATE THE MENTION NOTIFICATION TRIGGER FUNCTION
-- =============================================================================

DROP FUNCTION IF EXISTS public.notify_on_mention() CASCADE;

CREATE OR REPLACE FUNCTION public.notify_on_mention()
RETURNS TRIGGER AS $$
DECLARE
    mentioned_usernames TEXT[];
    mentioned_user RECORD;
    commenter_name TEXT;
    user_prefs public.notification_preferences;
    should_email BOOLEAN;
BEGIN
    -- Extract mentions from comment content
    mentioned_usernames := public.extract_mentions(NEW.content);

    IF array_length(mentioned_usernames, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get commenter's display name
    SELECT display_name INTO commenter_name
    FROM public.profiles
    WHERE id = NEW.author_id;

    -- Notify each mentioned user
    FOR mentioned_user IN
        SELECT id, username
        FROM public.profiles
        WHERE LOWER(username) = ANY(mentioned_usernames)
        AND id != NEW.author_id  -- Don't notify self-mention
    LOOP
        -- Check user preferences
        user_prefs := public.get_notification_preferences(mentioned_user.id);

        -- Determine if email should be sent
        should_email := COALESCE(user_prefs.email_mentions, TRUE);

        IF COALESCE(user_prefs.notify_mentions, TRUE) THEN
            INSERT INTO public.notifications (user_id, type, title, message, link, email_pending)
            VALUES (
                mentioned_user.id,
                'mention',
                commenter_name || ' mentioned you',
                LEFT(NEW.content, 100),
                '/post/' || NEW.post_id,
                should_email
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';

-- =============================================================================
-- RECREATE THE TRIGGER
-- =============================================================================

DROP TRIGGER IF EXISTS on_comment_mention ON public.comments;

CREATE TRIGGER on_comment_mention
    AFTER INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_mention();

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 039: Mention notification trigger fixed!';
    RAISE NOTICE '✓ Trigger now uses correct link format: /post/{post_id}';
    RAISE NOTICE '✓ Security and search_path properly configured';
END $$;
