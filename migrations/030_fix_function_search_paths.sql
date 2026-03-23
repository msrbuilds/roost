-- Migration: Fix function_search_path_mutable security warnings
-- This migration sets search_path = '' on all functions to prevent search_path manipulation attacks
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================================================
-- DROP EXISTING FUNCTIONS FIRST (to handle parameter name changes)
-- ============================================================================

-- Drop functions with CASCADE to handle dependent RLS policies
-- These will be recreated along with the policies that depend on them
DROP FUNCTION IF EXISTS public.is_user_banned(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_group_membership(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_group_admin(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_platform_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_platform_moderator(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_superadmin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_public(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_member(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_admin_or_mod(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.can_access_group(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_premium_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_active_subscription(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_subscription_status(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.process_gumroad_purchase(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_gumroad_subscription(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.reactivate_gumroad_subscription(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_subscriptions() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_reset_tokens() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_notifications() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_leaderboard_entries() CASCADE;
DROP FUNCTION IF EXISTS public.update_last_seen(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.extract_mentions(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_post_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_comment_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_group_member_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_group_online_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.mark_message_read(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.mark_all_notifications_read(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.search_posts(TEXT, UUID, TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.search_users(TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.ban_user(UUID, UUID, TEXT, INTERVAL) CASCADE;
DROP FUNCTION IF EXISTS public.unban_user(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_admin_stats() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_growth(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_activity_stats(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_active_announcements(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_user_points(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.award_points(UUID, INTEGER, TEXT, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_leaderboard_entry(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_rank(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_id_by_email(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.process_activation_request(UUID, UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_activation_stats() CASCADE;
DROP FUNCTION IF EXISTS public.get_remaining_activations(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.request_activation(UUID, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.has_active_request(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_pending_notification_emails(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.mark_notification_email_sent(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_notification_preferences(UUID) CASCADE;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- 1. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 2. update_announcement_timestamp
CREATE OR REPLACE FUNCTION public.update_announcement_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 3. handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$;

-- 4. add_creator_as_admin
CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
    RETURN NEW;
END;
$$;

-- 5. check_role_change
CREATE OR REPLACE FUNCTION public.check_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    -- Prevent demoting the last admin
    IF OLD.role = 'admin' AND NEW.role != 'admin' THEN
        IF (SELECT COUNT(*) FROM public.group_members WHERE group_id = OLD.group_id AND role = 'admin') <= 1 THEN
            RAISE EXCEPTION 'Cannot demote the last admin of a group';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- PERMISSION CHECK FUNCTIONS
-- ============================================================================

-- 6. is_user_banned
CREATE OR REPLACE FUNCTION public.is_user_banned(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid
        AND is_banned = true
        AND (banned_until IS NULL OR banned_until > NOW())
    );
END;
$$;

-- 7. check_group_membership
CREATE OR REPLACE FUNCTION public.check_group_membership(group_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_uuid AND user_id = user_uuid
    );
END;
$$;

-- 8. check_group_admin
CREATE OR REPLACE FUNCTION public.check_group_admin(group_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_uuid AND user_id = user_uuid AND role = 'admin'
    );
END;
$$;

-- 9. is_platform_admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid
        AND platform_role IN ('admin', 'superadmin')
    );
END;
$$;

-- 10. is_platform_moderator
CREATE OR REPLACE FUNCTION public.is_platform_moderator(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid
        AND platform_role IN ('moderator', 'admin', 'superadmin')
    );
END;
$$;

-- 11. is_superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid
        AND platform_role = 'superadmin'
    );
END;
$$;

-- 12. get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT platform_role INTO user_role
    FROM public.profiles
    WHERE id = user_uuid;
    RETURN COALESCE(user_role, 'user');
END;
$$;

-- 13. is_group_public
CREATE OR REPLACE FUNCTION public.is_group_public(group_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = group_uuid AND is_private = false
    );
END;
$$;

-- 14. is_group_member
CREATE OR REPLACE FUNCTION public.is_group_member(group_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_uuid AND user_id = user_uuid
    );
END;
$$;

-- 15. is_group_admin_or_mod
CREATE OR REPLACE FUNCTION public.is_group_admin_or_mod(group_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_uuid
        AND user_id = user_uuid
        AND role IN ('admin', 'moderator')
    );
END;
$$;

-- 16. can_access_group
CREATE OR REPLACE FUNCTION public.can_access_group(group_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- If group_uuid is NULL, this is community-wide content - allow access
    IF group_uuid IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Check if group is public
    IF public.is_group_public(group_uuid) THEN
        RETURN TRUE;
    END IF;

    -- Check if user is a member
    IF public.is_group_member(group_uuid, user_uuid) THEN
        RETURN TRUE;
    END IF;

    -- Check if user is platform admin
    IF public.is_platform_admin(user_uuid) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 17. has_premium_access
CREATE OR REPLACE FUNCTION public.has_premium_access(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid
        AND (
            is_premium = true
            OR platform_role IN ('admin', 'superadmin')
        )
    );
END;
$$;

-- ============================================================================
-- SUBSCRIPTION FUNCTIONS
-- ============================================================================

-- 18. has_active_subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.gumroad_subscriptions
        WHERE user_id = user_uuid
        AND status = 'active'
        AND (ended_at IS NULL OR ended_at > NOW())
    );
END;
$$;

-- 19. get_subscription_status
CREATE OR REPLACE FUNCTION public.get_subscription_status(user_uuid UUID)
RETURNS TABLE(
    subscription_id UUID,
    product_id TEXT,
    status TEXT,
    current_period_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        gs.id,
        gs.product_id,
        gs.status,
        gs.current_period_end,
        gs.cancelled_at
    FROM public.gumroad_subscriptions gs
    WHERE gs.user_id = user_uuid
    ORDER BY gs.created_at DESC
    LIMIT 1;
END;
$$;

-- 20. process_gumroad_purchase
CREATE OR REPLACE FUNCTION public.process_gumroad_purchase(
    p_email TEXT,
    p_product_id TEXT,
    p_subscription_id TEXT,
    p_sale_id TEXT,
    p_license_key TEXT DEFAULT NULL,
    p_price_cents INTEGER DEFAULT 0,
    p_recurrence TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_group_id UUID;
BEGIN
    -- Find or create user
    SELECT id INTO v_user_id FROM public.profiles WHERE email = p_email;

    IF v_user_id IS NULL THEN
        -- User doesn't exist, they need to sign up first
        RAISE EXCEPTION 'User with email % not found', p_email;
    END IF;

    -- Find mapped group
    SELECT group_id INTO v_group_id
    FROM public.gumroad_product_mappings
    WHERE product_id = p_product_id AND is_active = true;

    -- Create or update subscription
    INSERT INTO public.gumroad_subscriptions (
        user_id, product_id, subscription_id, sale_id, license_key,
        status, price_cents, recurrence, current_period_end
    )
    VALUES (
        v_user_id, p_product_id, p_subscription_id, p_sale_id, p_license_key,
        'active', p_price_cents, p_recurrence, NOW() + INTERVAL '1 month'
    )
    ON CONFLICT (subscription_id) DO UPDATE SET
        status = 'active',
        price_cents = EXCLUDED.price_cents,
        current_period_end = NOW() + INTERVAL '1 month',
        updated_at = NOW();

    -- Add to group if mapped
    IF v_group_id IS NOT NULL THEN
        INSERT INTO public.group_members (group_id, user_id, role)
        VALUES (v_group_id, v_user_id, 'member')
        ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;

    RETURN v_user_id;
END;
$$;

-- 21. cancel_gumroad_subscription
CREATE OR REPLACE FUNCTION public.cancel_gumroad_subscription(p_subscription_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.gumroad_subscriptions
    SET
        status = 'cancelled',
        cancelled_at = NOW(),
        ended_at = current_period_end + INTERVAL '7 days', -- Grace period
        updated_at = NOW()
    WHERE subscription_id = p_subscription_id;
END;
$$;

-- 22. reactivate_gumroad_subscription
CREATE OR REPLACE FUNCTION public.reactivate_gumroad_subscription(p_subscription_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.gumroad_subscriptions
    SET
        status = 'active',
        cancelled_at = NULL,
        ended_at = NULL,
        current_period_end = NOW() + INTERVAL '1 month',
        updated_at = NOW()
    WHERE subscription_id = p_subscription_id;
END;
$$;

-- 23. cleanup_expired_subscriptions
CREATE OR REPLACE FUNCTION public.cleanup_expired_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    removed_count INTEGER := 0;
    sub RECORD;
BEGIN
    FOR sub IN
        SELECT gs.user_id, gpm.group_id
        FROM public.gumroad_subscriptions gs
        JOIN public.gumroad_product_mappings gpm ON gs.product_id = gpm.product_id
        WHERE gs.status = 'cancelled'
        AND gs.ended_at < NOW()
    LOOP
        DELETE FROM public.group_members
        WHERE group_id = sub.group_id AND user_id = sub.user_id;

        removed_count := removed_count + 1;
    END LOOP;

    -- Update expired subscriptions status
    UPDATE public.gumroad_subscriptions
    SET status = 'expired'
    WHERE status = 'cancelled' AND ended_at < NOW();

    RETURN removed_count;
END;
$$;

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

-- 24. cleanup_expired_reset_tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_reset_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.password_reset_tokens
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 25. cleanup_old_notifications
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.notifications
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND is_read = true;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 26. cleanup_old_leaderboard_entries
CREATE OR REPLACE FUNCTION public.cleanup_old_leaderboard_entries()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.point_activities
    WHERE created_at < NOW() - INTERVAL '365 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- 27. update_last_seen
CREATE OR REPLACE FUNCTION public.update_last_seen(user_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.profiles
    SET last_seen = NOW()
    WHERE id = user_uuid;
END;
$$;

-- 28. extract_mentions
CREATE OR REPLACE FUNCTION public.extract_mentions(content TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    mentions TEXT[];
BEGIN
    SELECT ARRAY(
        SELECT DISTINCT substring(match FROM 2)
        FROM regexp_matches(content, '@([a-zA-Z0-9_]+)', 'g') AS match
    ) INTO mentions;
    RETURN mentions;
END;
$$;

-- 29. get_user_post_count
CREATE OR REPLACE FUNCTION public.get_user_post_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    post_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO post_count
    FROM public.posts
    WHERE author_id = user_uuid;
    RETURN post_count;
END;
$$;

-- 30. get_user_comment_count
CREATE OR REPLACE FUNCTION public.get_user_comment_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    comment_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO comment_count
    FROM public.comments
    WHERE author_id = user_uuid;
    RETURN comment_count;
END;
$$;

-- 31. get_group_member_count
CREATE OR REPLACE FUNCTION public.get_group_member_count(group_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    member_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO member_count
    FROM public.group_members
    WHERE group_id = group_uuid;
    RETURN member_count;
END;
$$;

-- 32. get_group_online_count
CREATE OR REPLACE FUNCTION public.get_group_online_count(group_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    online_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO online_count
    FROM public.group_members gm
    JOIN public.profiles p ON gm.user_id = p.id
    WHERE gm.group_id = group_uuid
    AND p.last_seen > NOW() - INTERVAL '5 minutes';
    RETURN online_count;
END;
$$;

-- 33. mark_message_read
CREATE OR REPLACE FUNCTION public.mark_message_read(message_uuid UUID, user_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.messages
    SET read_at = NOW()
    WHERE id = message_uuid
    AND receiver_id = user_uuid
    AND read_at IS NULL;
END;
$$;

-- 34. mark_all_notifications_read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = user_uuid
    AND is_read = false;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- 35. search_posts
CREATE OR REPLACE FUNCTION public.search_posts(
    search_query TEXT,
    group_filter UUID DEFAULT NULL,
    category_filter TEXT DEFAULT NULL,
    result_limit INTEGER DEFAULT 20,
    result_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    content TEXT,
    author_id UUID,
    group_id UUID,
    category TEXT,
    created_at TIMESTAMPTZ,
    rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.title,
        p.content,
        p.author_id,
        p.group_id,
        p.category,
        p.created_at,
        ts_rank(
            setweight(to_tsvector('english', COALESCE(p.title, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(p.content, '')), 'B'),
            plainto_tsquery('english', search_query)
        ) AS rank
    FROM public.posts p
    WHERE (
        to_tsvector('english', COALESCE(p.title, '')) ||
        to_tsvector('english', COALESCE(p.content, ''))
    ) @@ plainto_tsquery('english', search_query)
    AND (group_filter IS NULL OR p.group_id = group_filter)
    AND (category_filter IS NULL OR p.category = category_filter)
    ORDER BY rank DESC, p.created_at DESC
    LIMIT result_limit
    OFFSET result_offset;
END;
$$;

-- 36. search_users
CREATE OR REPLACE FUNCTION public.search_users(
    search_query TEXT,
    result_limit INTEGER DEFAULT 20,
    result_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    display_name TEXT,
    username TEXT,
    avatar_url TEXT,
    bio TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.display_name,
        p.username,
        p.avatar_url,
        p.bio
    FROM public.profiles p
    WHERE (
        p.display_name ILIKE '%' || search_query || '%'
        OR p.username ILIKE '%' || search_query || '%'
    )
    AND p.is_banned = false
    ORDER BY
        CASE WHEN p.display_name ILIKE search_query || '%' THEN 0
             WHEN p.username ILIKE search_query || '%' THEN 1
             ELSE 2
        END,
        p.display_name
    LIMIT result_limit
    OFFSET result_offset;
END;
$$;

-- ============================================================================
-- BAN FUNCTIONS
-- ============================================================================

-- 37. ban_user
CREATE OR REPLACE FUNCTION public.ban_user(
    target_user_id UUID,
    admin_user_id UUID,
    ban_reason TEXT DEFAULT NULL,
    ban_duration INTERVAL DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    admin_role TEXT;
    target_role TEXT;
BEGIN
    -- Check admin permissions
    SELECT platform_role INTO admin_role FROM public.profiles WHERE id = admin_user_id;
    SELECT platform_role INTO target_role FROM public.profiles WHERE id = target_user_id;

    IF admin_role NOT IN ('admin', 'superadmin') THEN
        RAISE EXCEPTION 'Insufficient permissions to ban users';
    END IF;

    -- Prevent banning superadmins unless you're a superadmin
    IF target_role = 'superadmin' AND admin_role != 'superadmin' THEN
        RAISE EXCEPTION 'Cannot ban a superadmin';
    END IF;

    -- Apply ban
    UPDATE public.profiles
    SET
        is_banned = true,
        banned_reason = ban_reason,
        banned_by = admin_user_id,
        banned_at = NOW(),
        banned_until = CASE WHEN ban_duration IS NULL THEN NULL ELSE NOW() + ban_duration END
    WHERE id = target_user_id;

    RETURN true;
END;
$$;

-- 38. unban_user
CREATE OR REPLACE FUNCTION public.unban_user(
    target_user_id UUID,
    admin_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    admin_role TEXT;
BEGIN
    -- Check admin permissions
    SELECT platform_role INTO admin_role FROM public.profiles WHERE id = admin_user_id;

    IF admin_role NOT IN ('admin', 'superadmin') THEN
        RAISE EXCEPTION 'Insufficient permissions to unban users';
    END IF;

    -- Remove ban
    UPDATE public.profiles
    SET
        is_banned = false,
        banned_reason = NULL,
        banned_by = NULL,
        banned_at = NULL,
        banned_until = NULL
    WHERE id = target_user_id;

    RETURN true;
END;
$$;

-- ============================================================================
-- ADMIN STATS FUNCTIONS
-- ============================================================================

-- 39. get_admin_stats
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE(
    total_users BIGINT,
    total_posts BIGINT,
    total_comments BIGINT,
    total_groups BIGINT,
    total_events BIGINT,
    active_users_24h BIGINT,
    new_users_7d BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.profiles)::BIGINT,
        (SELECT COUNT(*) FROM public.posts)::BIGINT,
        (SELECT COUNT(*) FROM public.comments)::BIGINT,
        (SELECT COUNT(*) FROM public.groups)::BIGINT,
        (SELECT COUNT(*) FROM public.events)::BIGINT,
        (SELECT COUNT(*) FROM public.profiles WHERE last_seen > NOW() - INTERVAL '24 hours')::BIGINT,
        (SELECT COUNT(*) FROM public.profiles WHERE created_at > NOW() - INTERVAL '7 days')::BIGINT;
END;
$$;

-- 40. get_user_growth
CREATE OR REPLACE FUNCTION public.get_user_growth(days_back INTEGER DEFAULT 30)
RETURNS TABLE(
    date DATE,
    new_users BIGINT,
    cumulative_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    WITH daily_signups AS (
        SELECT
            DATE(created_at) as signup_date,
            COUNT(*) as count
        FROM public.profiles
        WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
        GROUP BY DATE(created_at)
    ),
    date_series AS (
        SELECT generate_series(
            (NOW() - (days_back || ' days')::INTERVAL)::DATE,
            NOW()::DATE,
            '1 day'::INTERVAL
        )::DATE as date
    )
    SELECT
        ds.date,
        COALESCE(d.count, 0)::BIGINT,
        SUM(COALESCE(d.count, 0)) OVER (ORDER BY ds.date)::BIGINT
    FROM date_series ds
    LEFT JOIN daily_signups d ON ds.date = d.signup_date
    ORDER BY ds.date;
END;
$$;

-- 41. get_activity_stats
CREATE OR REPLACE FUNCTION public.get_activity_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
    date DATE,
    posts_count BIGINT,
    comments_count BIGINT,
    reactions_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(
            (NOW() - (days_back || ' days')::INTERVAL)::DATE,
            NOW()::DATE,
            '1 day'::INTERVAL
        )::DATE as date
    ),
    posts_daily AS (
        SELECT DATE(created_at) as d, COUNT(*) as c
        FROM public.posts
        WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
        GROUP BY DATE(created_at)
    ),
    comments_daily AS (
        SELECT DATE(created_at) as d, COUNT(*) as c
        FROM public.comments
        WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
        GROUP BY DATE(created_at)
    ),
    reactions_daily AS (
        SELECT DATE(created_at) as d, COUNT(*) as c
        FROM public.reactions
        WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
        GROUP BY DATE(created_at)
    )
    SELECT
        ds.date,
        COALESCE(p.c, 0)::BIGINT,
        COALESCE(c.c, 0)::BIGINT,
        COALESCE(r.c, 0)::BIGINT
    FROM date_series ds
    LEFT JOIN posts_daily p ON ds.date = p.d
    LEFT JOIN comments_daily c ON ds.date = c.d
    LEFT JOIN reactions_daily r ON ds.date = r.d
    ORDER BY ds.date;
END;
$$;

-- ============================================================================
-- ANNOUNCEMENT FUNCTIONS
-- ============================================================================

-- 42. get_active_announcements
CREATE OR REPLACE FUNCTION public.get_active_announcements(user_uuid UUID, group_filter UUID DEFAULT NULL)
RETURNS TABLE(
    id UUID,
    title TEXT,
    content TEXT,
    type TEXT,
    group_id UUID,
    is_dismissible BOOLEAN,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.title,
        a.content,
        a.type,
        a.group_id,
        a.is_dismissible,
        a.starts_at,
        a.ends_at
    FROM public.announcements a
    LEFT JOIN public.announcement_dismissals ad
        ON a.id = ad.announcement_id AND ad.user_id = user_uuid
    WHERE a.is_active = true
    AND (a.starts_at IS NULL OR a.starts_at <= NOW())
    AND (a.ends_at IS NULL OR a.ends_at > NOW())
    AND ad.id IS NULL
    AND (
        a.group_id IS NULL
        OR a.group_id = group_filter
    )
    ORDER BY a.created_at DESC;
END;
$$;

-- ============================================================================
-- LEADERBOARD FUNCTIONS
-- ============================================================================

-- 43. calculate_user_points
CREATE OR REPLACE FUNCTION public.calculate_user_points(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    total_points INTEGER;
BEGIN
    SELECT COALESCE(SUM(points), 0) INTO total_points
    FROM public.point_activities
    WHERE user_id = user_uuid;

    RETURN total_points;
END;
$$;

-- 44. award_points
CREATE OR REPLACE FUNCTION public.award_points(
    user_uuid UUID,
    points_amount INTEGER,
    activity_type TEXT,
    reference_id UUID DEFAULT NULL,
    reference_type TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.point_activities (
        user_id, points, activity_type, reference_id, reference_type
    )
    VALUES (
        user_uuid, points_amount, activity_type, reference_id, reference_type
    );

    -- Update leaderboard
    PERFORM public.update_leaderboard_entry(user_uuid);
END;
$$;

-- 45. update_leaderboard_entry
CREATE OR REPLACE FUNCTION public.update_leaderboard_entry(user_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    total_points INTEGER;
BEGIN
    total_points := public.calculate_user_points(user_uuid);

    INSERT INTO public.leaderboard (user_id, points, updated_at)
    VALUES (user_uuid, total_points, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        points = total_points,
        updated_at = NOW();
END;
$$;

-- 46. get_user_rank
CREATE OR REPLACE FUNCTION public.get_user_rank(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    user_rank INTEGER;
BEGIN
    SELECT rank INTO user_rank
    FROM (
        SELECT user_id, RANK() OVER (ORDER BY points DESC) as rank
        FROM public.leaderboard
    ) ranked
    WHERE user_id = user_uuid;

    RETURN COALESCE(user_rank, 0);
END;
$$;

-- ============================================================================
-- POINT TRIGGER FUNCTIONS
-- ============================================================================

-- 47. trigger_post_points
CREATE OR REPLACE FUNCTION public.trigger_post_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.award_points(NEW.author_id, 10, 'post', NEW.id, 'post');
    RETURN NEW;
END;
$$;

-- 48. trigger_reverse_post_points
CREATE OR REPLACE FUNCTION public.trigger_reverse_post_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Deduct points when post is deleted
    PERFORM public.award_points(OLD.author_id, -10, 'post_deleted', OLD.id, 'post');
    RETURN OLD;
END;
$$;

-- 49. trigger_comment_points
CREATE OR REPLACE FUNCTION public.trigger_comment_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.award_points(NEW.author_id, 5, 'comment', NEW.id, 'comment');
    RETURN NEW;
END;
$$;

-- 50. trigger_reaction_points
CREATE OR REPLACE FUNCTION public.trigger_reaction_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target_user_id UUID;
    points_to_award INTEGER;
BEGIN
    -- Determine points based on reaction type
    IF NEW.emoji = '❤️' OR NEW.emoji = 'like' THEN
        points_to_award := 2;
    ELSE
        points_to_award := 1;
    END IF;

    -- Find the content owner
    IF NEW.post_id IS NOT NULL THEN
        SELECT author_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
    ELSIF NEW.comment_id IS NOT NULL THEN
        SELECT author_id INTO target_user_id FROM public.comments WHERE id = NEW.comment_id;
    END IF;

    -- Award points to content owner (not reactor)
    IF target_user_id IS NOT NULL AND target_user_id != NEW.user_id THEN
        PERFORM public.award_points(target_user_id, points_to_award, 'reaction_received', NEW.id, 'reaction');
    END IF;

    RETURN NEW;
END;
$$;

-- 51. trigger_event_attendance_points
CREATE OR REPLACE FUNCTION public.trigger_event_attendance_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.status = 'attending' THEN
        PERFORM public.award_points(NEW.user_id, 15, 'event_attendance', NEW.event_id, 'event');
    END IF;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- NOTIFICATION TRIGGER FUNCTIONS
-- ============================================================================

-- 52. notify_on_comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    post_author_id UUID;
    parent_author_id UUID;
BEGIN
    -- Get post author
    SELECT author_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;

    -- Notify post author (if not self-commenting)
    IF post_author_id IS NOT NULL AND post_author_id != NEW.author_id THEN
        INSERT INTO public.notifications (user_id, type, actor_id, post_id, comment_id)
        VALUES (post_author_id, 'comment', NEW.author_id, NEW.post_id, NEW.id);
    END IF;

    -- If this is a reply, notify parent comment author
    IF NEW.parent_id IS NOT NULL THEN
        SELECT author_id INTO parent_author_id FROM public.comments WHERE id = NEW.parent_id;
        IF parent_author_id IS NOT NULL AND parent_author_id != NEW.author_id AND parent_author_id != post_author_id THEN
            INSERT INTO public.notifications (user_id, type, actor_id, post_id, comment_id)
            VALUES (parent_author_id, 'reply', NEW.author_id, NEW.post_id, NEW.id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 53. notify_on_reaction
CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Find content owner
    IF NEW.post_id IS NOT NULL THEN
        SELECT author_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
    ELSIF NEW.comment_id IS NOT NULL THEN
        SELECT author_id INTO target_user_id FROM public.comments WHERE id = NEW.comment_id;
    END IF;

    -- Notify if not self-reacting
    IF target_user_id IS NOT NULL AND target_user_id != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, type, actor_id, post_id, comment_id)
        VALUES (target_user_id, 'reaction', NEW.user_id, NEW.post_id, NEW.comment_id);
    END IF;

    RETURN NEW;
END;
$$;

-- 54. notify_on_message
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, actor_id, message_id)
    VALUES (NEW.receiver_id, 'message', NEW.sender_id, NEW.id);
    RETURN NEW;
END;
$$;

-- 55. notify_on_mention
CREATE OR REPLACE FUNCTION public.notify_on_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    mentioned_username TEXT;
    mentioned_user_id UUID;
    mentions TEXT[];
BEGIN
    mentions := public.extract_mentions(NEW.content);

    FOREACH mentioned_username IN ARRAY mentions LOOP
        SELECT id INTO mentioned_user_id
        FROM public.profiles
        WHERE username = mentioned_username;

        IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.author_id THEN
            INSERT INTO public.notifications (user_id, type, actor_id, post_id, comment_id)
            VALUES (mentioned_user_id, 'mention', NEW.author_id,
                CASE WHEN TG_TABLE_NAME = 'posts' THEN NEW.id ELSE NEW.post_id END,
                CASE WHEN TG_TABLE_NAME = 'comments' THEN NEW.id ELSE NULL END
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- ============================================================================
-- SHOWCASE FUNCTIONS
-- ============================================================================

-- 56. update_showcase_vote_count
CREATE OR REPLACE FUNCTION public.update_showcase_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.showcases
        SET vote_count = vote_count + 1
        WHERE id = NEW.showcase_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.showcases
        SET vote_count = vote_count - 1
        WHERE id = OLD.showcase_id;
    END IF;
    RETURN NULL;
END;
$$;

-- 57. update_showcase_review_stats
CREATE OR REPLACE FUNCTION public.update_showcase_review_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    avg_rating NUMERIC;
    total_reviews INTEGER;
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT AVG(rating), COUNT(*) INTO avg_rating, total_reviews
        FROM public.showcase_reviews
        WHERE showcase_id = NEW.showcase_id;

        UPDATE public.showcases
        SET
            average_rating = COALESCE(avg_rating, 0),
            review_count = COALESCE(total_reviews, 0)
        WHERE id = NEW.showcase_id;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT AVG(rating), COUNT(*) INTO avg_rating, total_reviews
        FROM public.showcase_reviews
        WHERE showcase_id = OLD.showcase_id;

        UPDATE public.showcases
        SET
            average_rating = COALESCE(avg_rating, 0),
            review_count = COALESCE(total_reviews, 0)
        WHERE id = OLD.showcase_id;
    END IF;
    RETURN NULL;
END;
$$;

-- ============================================================================
-- EMAIL NOTIFICATION FUNCTIONS
-- ============================================================================

-- 58. get_pending_notification_emails
CREATE OR REPLACE FUNCTION public.get_pending_notification_emails(batch_size INTEGER DEFAULT 50)
RETURNS TABLE(
    notification_id UUID,
    user_email TEXT,
    user_name TEXT,
    notification_type TEXT,
    actor_name TEXT,
    post_title TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id,
        p.email,
        p.display_name,
        n.type,
        actor.display_name,
        post.title,
        n.created_at
    FROM public.notifications n
    JOIN public.profiles p ON n.user_id = p.id
    LEFT JOIN public.profiles actor ON n.actor_id = actor.id
    LEFT JOIN public.posts post ON n.post_id = post.id
    WHERE n.email_sent = false
    AND n.created_at < NOW() - INTERVAL '15 minutes'
    ORDER BY n.created_at ASC
    LIMIT batch_size;
END;
$$;

-- 59. mark_notification_email_sent
CREATE OR REPLACE FUNCTION public.mark_notification_email_sent(notification_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.notifications
    SET email_sent = true
    WHERE id = notification_uuid;
END;
$$;

-- 60. get_notification_preferences
CREATE OR REPLACE FUNCTION public.get_notification_preferences(user_uuid UUID)
RETURNS TABLE(
    email_on_comment BOOLEAN,
    email_on_reply BOOLEAN,
    email_on_mention BOOLEAN,
    email_on_reaction BOOLEAN,
    email_on_message BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(np.email_on_comment, true),
        COALESCE(np.email_on_reply, true),
        COALESCE(np.email_on_mention, true),
        COALESCE(np.email_on_reaction, false),
        COALESCE(np.email_on_message, true)
    FROM public.notification_preferences np
    WHERE np.user_id = user_uuid;

    IF NOT FOUND THEN
        RETURN QUERY SELECT true, true, true, false, true;
    END IF;
END;
$$;

-- ============================================================================
-- USER LOOKUP FUNCTIONS
-- ============================================================================

-- 61. get_user_id_by_email
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(user_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    user_uuid UUID;
BEGIN
    SELECT id INTO user_uuid
    FROM public.profiles
    WHERE email = user_email;

    RETURN user_uuid;
END;
$$;

-- ============================================================================
-- PRODUCT ACTIVATION FUNCTIONS
-- ============================================================================

-- 62. process_activation_request
CREATE OR REPLACE FUNCTION public.process_activation_request(
    request_uuid UUID,
    admin_uuid UUID,
    new_status TEXT,
    admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_platform_admin(admin_uuid) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    UPDATE public.activation_requests
    SET
        status = new_status,
        processed_by = admin_uuid,
        processed_at = NOW(),
        notes = COALESCE(admin_notes, notes)
    WHERE id = request_uuid;

    RETURN FOUND;
END;
$$;

-- 63. get_activation_stats
CREATE OR REPLACE FUNCTION public.get_activation_stats()
RETURNS TABLE(
    total_requests BIGINT,
    pending_requests BIGINT,
    approved_requests BIGINT,
    rejected_requests BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
        COUNT(*) FILTER (WHERE status = 'approved')::BIGINT,
        COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT
    FROM public.activation_requests;
END;
$$;

-- 64. get_remaining_activations
CREATE OR REPLACE FUNCTION public.get_remaining_activations(license_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    max_activations INTEGER;
    used_activations INTEGER;
BEGIN
    SELECT l.max_activations, COUNT(a.id)
    INTO max_activations, used_activations
    FROM public.licenses l
    LEFT JOIN public.activations a ON l.id = a.license_id AND a.is_active = true
    WHERE l.id = license_uuid
    GROUP BY l.max_activations;

    RETURN COALESCE(max_activations - used_activations, 0);
END;
$$;

-- 65. request_activation
CREATE OR REPLACE FUNCTION public.request_activation(
    user_uuid UUID,
    license_key_input TEXT,
    device_info JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    license_uuid UUID;
    request_uuid UUID;
    remaining INTEGER;
BEGIN
    -- Find license
    SELECT id INTO license_uuid
    FROM public.licenses
    WHERE license_key = license_key_input AND is_active = true;

    IF license_uuid IS NULL THEN
        RAISE EXCEPTION 'Invalid or inactive license key';
    END IF;

    -- Check remaining activations
    remaining := public.get_remaining_activations(license_uuid);
    IF remaining <= 0 THEN
        RAISE EXCEPTION 'No activations remaining for this license';
    END IF;

    -- Create activation request
    INSERT INTO public.activation_requests (user_id, license_id, device_info, status)
    VALUES (user_uuid, license_uuid, device_info, 'pending')
    RETURNING id INTO request_uuid;

    RETURN request_uuid;
END;
$$;

-- 66. has_active_request
CREATE OR REPLACE FUNCTION public.has_active_request(user_uuid UUID, license_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.activation_requests
        WHERE user_id = user_uuid
        AND license_id = license_uuid
        AND status = 'pending'
    );
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on all functions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_announcement_timestamp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_banned(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_group_membership(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_group_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_moderator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_public(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin_or_mod(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_premium_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_last_seen(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extract_mentions(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_post_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_comment_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_member_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_online_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_posts(TEXT, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_announcements(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_user_points(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_rank(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_remaining_activations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_activation(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_request(UUID, UUID) TO authenticated;

-- Admin-only functions
GRANT EXECUTE ON FUNCTION public.ban_user(UUID, UUID, TEXT, INTERVAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unban_user(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_growth(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_activity_stats(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_activation_request(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_activation_stats() TO authenticated;

-- Service role only functions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.add_creator_as_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_gumroad_purchase(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_gumroad_subscription(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_gumroad_subscription(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_subscriptions() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reset_tokens() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_leaderboard_entries() TO service_role;
GRANT EXECUTE ON FUNCTION public.award_points(UUID, INTEGER, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_leaderboard_entry(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_notification_emails(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_email_sent(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_notification_preferences(UUID) TO service_role;

-- ============================================================================
-- RECREATE RLS POLICIES THAT WERE DROPPED BY CASCADE
-- ============================================================================

-- Note: The CASCADE drops above will remove RLS policies that depend on these functions.
-- We need to recreate all affected policies.

-- -----------------------------------------------------------------------------
-- GROUPS TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Groups are viewable based on privacy" ON groups;
CREATE POLICY "Groups are viewable based on privacy"
    ON groups FOR SELECT
    USING (
        is_private = false
        OR is_group_member(id, auth.uid())
    );

-- -----------------------------------------------------------------------------
-- GROUP_MEMBERS TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Group members viewable appropriately" ON group_members;
DROP POLICY IF EXISTS "Group members viewable by group members" ON group_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON group_members;
DROP POLICY IF EXISTS "Users can leave or admins can remove" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;

-- Users can view group_members if:
-- 1. They are checking their own membership (user_id = auth.uid())
-- 2. They are a member of that group
-- 3. The group is public
CREATE POLICY "Group members viewable appropriately"
    ON group_members FOR SELECT
    USING (
        user_id = auth.uid()
        OR check_group_membership(group_id, auth.uid())
        OR is_group_public(group_id)
    );

-- Users can join public groups or admins can add members
CREATE POLICY "Users can join groups"
    ON group_members FOR INSERT
    WITH CHECK (
        (
            auth.uid() = user_id
            AND role = 'member'
            AND is_group_public(group_id)
        )
        OR check_group_admin(group_id, auth.uid())
    );

-- Only admins/mods can update member roles
CREATE POLICY "Admins can update member roles"
    ON group_members FOR UPDATE
    USING (check_group_admin(group_id, auth.uid()))
    WITH CHECK (check_group_admin(group_id, auth.uid()));

-- Users can leave groups or admins can remove members
CREATE POLICY "Users can leave or admins can remove"
    ON group_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR check_group_admin(group_id, auth.uid())
    );

-- -----------------------------------------------------------------------------
-- CATEGORIES TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Categories viewable by authenticated users" ON categories;
DROP POLICY IF EXISTS "Categories viewable by group members" ON categories;
DROP POLICY IF EXISTS "Admins can create categories" ON categories;
DROP POLICY IF EXISTS "Group admins can create categories" ON categories;
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Group admins can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
DROP POLICY IF EXISTS "Group admins can delete categories" ON categories;

CREATE POLICY "Categories viewable by authenticated users"
    ON categories FOR SELECT
    TO authenticated
    USING (
        group_id IS NULL
        OR is_group_member(group_id, auth.uid())
        OR is_platform_admin(auth.uid())
    );

CREATE POLICY "Admins can create categories"
    ON categories FOR INSERT
    TO authenticated
    WITH CHECK (
        is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

CREATE POLICY "Admins can update categories"
    ON categories FOR UPDATE
    TO authenticated
    USING (
        is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    )
    WITH CHECK (
        is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

CREATE POLICY "Admins can delete categories"
    ON categories FOR DELETE
    TO authenticated
    USING (
        is_platform_admin(auth.uid())
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

-- -----------------------------------------------------------------------------
-- POSTS TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Posts viewable by everyone or group members" ON posts;
DROP POLICY IF EXISTS "Posts viewable by group members" ON posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
DROP POLICY IF EXISTS "Group members can create posts" ON posts;
DROP POLICY IF EXISTS "Authors and admins can update posts" ON posts;
DROP POLICY IF EXISTS "Authors and admins can delete posts" ON posts;

CREATE POLICY "Posts viewable by everyone or group members"
    ON posts FOR SELECT
    USING (
        group_id IS NULL
        OR is_group_member(group_id, auth.uid())
    );

CREATE POLICY "Authenticated users can create posts"
    ON posts FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
        AND (
            group_id IS NULL
            OR is_group_member(group_id, auth.uid())
        )
    );

CREATE POLICY "Authors and admins can update posts"
    ON posts FOR UPDATE
    USING (
        auth.uid() = author_id
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    )
    WITH CHECK (
        auth.uid() = author_id
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

CREATE POLICY "Authors and admins can delete posts"
    ON posts FOR DELETE
    USING (
        auth.uid() = author_id
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

-- -----------------------------------------------------------------------------
-- COMMENTS TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Comments viewable with posts" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Authors and admins can delete comments" ON comments;

CREATE POLICY "Comments viewable with posts"
    ON comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM posts
            WHERE posts.id = post_id
            AND (posts.group_id IS NULL OR is_group_member(posts.group_id, auth.uid()))
        )
    );

CREATE POLICY "Users can create comments"
    ON comments FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
        AND EXISTS (
            SELECT 1 FROM posts
            WHERE posts.id = post_id
            AND (posts.group_id IS NULL OR is_group_member(posts.group_id, auth.uid()))
        )
    );

CREATE POLICY "Authors and admins can delete comments"
    ON comments FOR DELETE
    USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM posts
            WHERE posts.id = post_id
            AND (
                auth.uid() = posts.author_id
                OR (posts.group_id IS NOT NULL AND is_group_admin_or_mod(posts.group_id, auth.uid()))
            )
        )
    );

-- -----------------------------------------------------------------------------
-- EVENTS TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Events viewable by everyone or group members" ON events;
DROP POLICY IF EXISTS "Events viewable by group members" ON events;
DROP POLICY IF EXISTS "Users can create events" ON events;
DROP POLICY IF EXISTS "Group members can create events" ON events;
DROP POLICY IF EXISTS "Creators and group admins can update events" ON events;
DROP POLICY IF EXISTS "Creators and admins can update events" ON events;
DROP POLICY IF EXISTS "Creators and group admins can delete events" ON events;
DROP POLICY IF EXISTS "Creators and admins can delete events" ON events;

CREATE POLICY "Events viewable by everyone or group members"
    ON events FOR SELECT
    USING (
        group_id IS NULL
        OR is_group_member(group_id, auth.uid())
    );

CREATE POLICY "Users can create events"
    ON events FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
        AND (
            group_id IS NULL
            OR is_group_member(group_id, auth.uid())
        )
    );

CREATE POLICY "Creators and group admins can update events"
    ON events FOR UPDATE
    USING (
        auth.uid() = created_by
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

CREATE POLICY "Creators and group admins can delete events"
    ON events FOR DELETE
    USING (
        auth.uid() = created_by
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

-- -----------------------------------------------------------------------------
-- EVENT_ATTENDEES TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Event attendees viewable by everyone or group members" ON event_attendees;
DROP POLICY IF EXISTS "Event attendees viewable by group members" ON event_attendees;
DROP POLICY IF EXISTS "Users can RSVP to events" ON event_attendees;

CREATE POLICY "Event attendees viewable by everyone or group members"
    ON event_attendees FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_id
            AND (events.group_id IS NULL OR is_group_member(events.group_id, auth.uid()))
        )
    );

CREATE POLICY "Users can RSVP to events"
    ON event_attendees FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_id
            AND (events.group_id IS NULL OR is_group_member(events.group_id, auth.uid()))
        )
    );

-- -----------------------------------------------------------------------------
-- LEADERBOARD_ENTRIES TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Leaderboard viewable by group members" ON leaderboard_entries;

CREATE POLICY "Leaderboard viewable by group members"
    ON leaderboard_entries FOR SELECT
    USING (
        group_id IS NULL
        OR is_group_member(group_id, auth.uid())
    );

-- -----------------------------------------------------------------------------
-- ANNOUNCEMENTS TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Active announcements are viewable by authenticated users" ON announcements;
DROP POLICY IF EXISTS "Platform admins can view all announcements" ON announcements;
DROP POLICY IF EXISTS "Platform admins can create announcements" ON announcements;
DROP POLICY IF EXISTS "Platform admins can update announcements" ON announcements;
DROP POLICY IF EXISTS "Platform admins can delete announcements" ON announcements;

CREATE POLICY "Active announcements are viewable by authenticated users"
    ON announcements FOR SELECT
    TO authenticated
    USING (
        is_active = true
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (
            scope = 'global'
            OR (scope = 'group' AND is_group_member(group_id, auth.uid()))
        )
    );

CREATE POLICY "Platform admins can view all announcements"
    ON announcements FOR SELECT
    TO authenticated
    USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can create announcements"
    ON announcements FOR INSERT
    TO authenticated
    WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update announcements"
    ON announcements FOR UPDATE
    TO authenticated
    USING (is_platform_admin(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete announcements"
    ON announcements FOR DELETE
    TO authenticated
    USING (is_platform_admin(auth.uid()));

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 030: Function search_path security fix completed!';
    RAISE NOTICE '🔒 All 66 functions now have SET search_path = '''' for security';
    RAISE NOTICE '🔑 All affected RLS policies have been recreated';
END $$;
