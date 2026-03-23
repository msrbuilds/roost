-- Migration: Force fix remaining function_search_path_mutable warnings
-- These functions have multiple overloads - we need to drop ALL versions
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================================================
-- DROP ALL OVERLOADS OF PROBLEMATIC FUNCTIONS
-- Using pg_proc to find and drop all versions regardless of signature
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    drop_sql TEXT;
BEGIN
    -- Find and drop ALL overloads of the problematic functions
    FOR func_record IN
        SELECT
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN (
            'update_last_seen',
            'mark_message_read',
            'mark_all_notifications_read',
            'search_posts',
            'search_users',
            'process_gumroad_purchase',
            'update_leaderboard_entry',
            'calculate_user_points',
            'award_points',
            'get_user_rank',
            'process_activation_request',
            'get_remaining_activations',
            'request_activation'
        )
    LOOP
        drop_sql := format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
            func_record.schema_name,
            func_record.function_name,
            func_record.args);
        RAISE NOTICE 'Dropping: %', drop_sql;
        EXECUTE drop_sql;
    END LOOP;
END $$;

-- ============================================================================
-- RECREATE ALL FUNCTIONS WITH SET search_path = ''
-- ============================================================================

-- 1. update_last_seen
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

-- 2. mark_message_read
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

-- 3. mark_all_notifications_read
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

-- 4. search_posts
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

-- 5. search_users
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

-- 6. process_gumroad_purchase
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

-- 7. calculate_user_points
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

-- 8. award_points
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

-- 9. update_leaderboard_entry
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

-- 10. get_user_rank
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

-- 11. process_activation_request
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

-- 12. get_remaining_activations
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

-- 13. request_activation
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

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.update_last_seen(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_posts(TEXT, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_gumroad_purchase(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_user_points(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_points(UUID, INTEGER, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_leaderboard_entry(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_rank(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_activation_request(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_remaining_activations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_activation(UUID, TEXT, JSONB) TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 033: Force-fixed remaining function search_path warnings!';
    RAISE NOTICE '🔒 Dropped ALL overloads and recreated 13 functions with SET search_path = ''''';
END $$;
