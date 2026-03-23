    -- =============================================================================
    -- Migration 047: Fix Ban Function Column Names
    -- =============================================================================
    --
    -- PROBLEM: Migration 030 rewrote is_user_banned(), ban_user(), and unban_user()
    -- with wrong column names. These functions reference columns that don't exist:
    --
    --   Wrong (030)          Correct (017)
    --   ──────────────────   ──────────────────
    --   banned_until         ban_expires_at
    --   banned_reason        ban_reason
    --   platform_role        role
    --
    -- Migration 036 fixed platform_role in the admin check functions
    -- (is_platform_admin, is_platform_moderator, is_superadmin, get_user_role)
    -- but missed these three ban functions.
    --
    -- IMPACT: Any call to these functions would throw a runtime error
    -- ("column does not exist"). Currently nothing calls them (the frontend
    -- uses direct Supabase client updates), but they're a latent bug.
    --
    -- =============================================================================

    -- 1. Fix is_user_banned()
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
            AND (ban_expires_at IS NULL OR ban_expires_at > NOW())
        );
    END;
    $$;

    -- 2. Fix ban_user()
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
        SELECT role INTO admin_role FROM public.profiles WHERE id = admin_user_id;
        SELECT role INTO target_role FROM public.profiles WHERE id = target_user_id;

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
            ban_reason = ban_user.ban_reason,
            banned_by = admin_user_id,
            banned_at = NOW(),
            ban_expires_at = CASE WHEN ban_duration IS NULL THEN NULL ELSE NOW() + ban_duration END
        WHERE id = target_user_id;

        RETURN true;
    END;
    $$;

    -- 3. Fix unban_user()
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
        SELECT role INTO admin_role FROM public.profiles WHERE id = admin_user_id;

        IF admin_role NOT IN ('admin', 'superadmin') THEN
            RAISE EXCEPTION 'Insufficient permissions to unban users';
        END IF;

        -- Remove ban
        UPDATE public.profiles
        SET
            is_banned = false,
            ban_reason = NULL,
            banned_by = NULL,
            banned_at = NULL,
            ban_expires_at = NULL
        WHERE id = target_user_id;

        RETURN true;
    END;
    $$;

    -- 4. Verify the functions exist and are correct
    DO $$
    BEGIN
        -- Quick smoke test: is_user_banned should not throw on a NULL UUID
        PERFORM public.is_user_banned('00000000-0000-0000-0000-000000000000'::UUID);
        RAISE NOTICE 'Migration 047: is_user_banned() — fixed (banned_until → ban_expires_at)';
        RAISE NOTICE 'Migration 047: ban_user() — fixed (platform_role → role, banned_reason → ban_reason, banned_until → ban_expires_at)';
        RAISE NOTICE 'Migration 047: unban_user() — fixed (platform_role → role, banned_reason → ban_reason, banned_until → ban_expires_at)';
    END;
    $$;
