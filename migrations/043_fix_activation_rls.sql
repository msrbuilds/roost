    -- Migration 043: Fix Activation Requests RLS & Stats
    -- Purpose: Restore RLS policies that were dropped by CASCADE in migration 036,
    --          and fix get_activation_stats to return proper JSON format.
    -- Root Cause: Migration 036 used DROP FUNCTION ... CASCADE on is_platform_admin/
    --             is_platform_moderator, which cascaded to drop all RLS policies that
    --             referenced those functions (including activation_requests policies).
    -- Created: 2026-02-09

    -- =============================================================================
    -- 1. ENSURE ROLE FUNCTIONS ARE CORRECT
    -- =============================================================================

    -- Recreate is_platform_admin (uses 'role' column, not 'platform_role')
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
            AND role IN ('admin', 'superadmin')
        );
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;

    -- Recreate is_platform_moderator
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
            AND role IN ('moderator', 'admin', 'superadmin')
        );
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.is_platform_moderator(UUID) TO authenticated;

    -- =============================================================================
    -- 2. RESTORE ACTIVATION_REQUESTS RLS POLICIES
    -- =============================================================================

    -- Drop any existing policies first (safe to re-run)
    DROP POLICY IF EXISTS "Users can view own activation requests" ON activation_requests;
    DROP POLICY IF EXISTS "Admins can view all activation requests" ON activation_requests;
    DROP POLICY IF EXISTS "Only system can create activation requests" ON activation_requests;
    DROP POLICY IF EXISTS "Admins can update activation requests" ON activation_requests;

    -- Users can view their own requests
    CREATE POLICY "Users can view own activation requests"
        ON activation_requests FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());

    -- Platform admins and moderators can view ALL requests
    CREATE POLICY "Admins can view all activation requests"
        ON activation_requests FOR SELECT
        TO authenticated
        USING (
            public.is_platform_admin(auth.uid())
            OR public.is_platform_moderator(auth.uid())
        );

    -- No direct inserts (must use request_activation function)
    CREATE POLICY "Only system can create activation requests"
        ON activation_requests FOR INSERT
        TO authenticated
        WITH CHECK (false);

    -- Platform admins and moderators can update any request
    CREATE POLICY "Admins can update activation requests"
        ON activation_requests FOR UPDATE
        TO authenticated
        USING (
            public.is_platform_admin(auth.uid())
            OR public.is_platform_moderator(auth.uid())
        )
        WITH CHECK (
            public.is_platform_admin(auth.uid())
            OR public.is_platform_moderator(auth.uid())
        );

    -- =============================================================================
    -- 3. RESTORE ACTIVATION_USAGE RLS POLICIES
    -- =============================================================================

    DROP POLICY IF EXISTS "Users can view own activation usage" ON activation_usage;
    DROP POLICY IF EXISTS "Admins can view all activation usage" ON activation_usage;

    CREATE POLICY "Users can view own activation usage"
        ON activation_usage FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());

    CREATE POLICY "Admins can view all activation usage"
        ON activation_usage FOR SELECT
        TO authenticated
        USING (
            public.is_platform_admin(auth.uid())
            OR public.is_platform_moderator(auth.uid())
        );

    -- =============================================================================
    -- 4. RESTORE ACTIVATION_PRODUCTS RLS POLICIES
    -- =============================================================================

    DROP POLICY IF EXISTS "Anyone can view active products" ON activation_products;
    DROP POLICY IF EXISTS "Platform admins can manage products" ON activation_products;
    DROP POLICY IF EXISTS "Platform admins can insert products" ON activation_products;
    DROP POLICY IF EXISTS "Platform admins can update products" ON activation_products;
    DROP POLICY IF EXISTS "Platform admins can delete products" ON activation_products;

    CREATE POLICY "Anyone can view active products"
        ON activation_products FOR SELECT
        TO authenticated
        USING (is_active = true OR public.is_platform_admin(auth.uid()));

    CREATE POLICY "Platform admins can insert products"
        ON activation_products FOR INSERT
        TO authenticated
        WITH CHECK (public.is_platform_admin(auth.uid()));

    CREATE POLICY "Platform admins can update products"
        ON activation_products FOR UPDATE
        TO authenticated
        USING (public.is_platform_admin(auth.uid()))
        WITH CHECK (public.is_platform_admin(auth.uid()));

    CREATE POLICY "Platform admins can delete products"
        ON activation_products FOR DELETE
        TO authenticated
        USING (public.is_platform_admin(auth.uid()));

    -- =============================================================================
    -- 5. FIX get_activation_stats TO RETURN PROPER JSON
    -- =============================================================================

    -- Drop the broken TABLE-returning version from migration 030
    DROP FUNCTION IF EXISTS public.get_activation_stats() CASCADE;

    -- Recreate with correct JSON return matching what the frontend expects
    CREATE OR REPLACE FUNCTION public.get_activation_stats()
    RETURNS JSON
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $$
    DECLARE
        result JSON;
        v_month_start DATE;
    BEGIN
        v_month_start := date_trunc('month', NOW())::DATE;

        SELECT json_build_object(
            'total_products', (SELECT COUNT(*) FROM public.activation_products WHERE is_active = true),
            'total_requests', (SELECT COUNT(*) FROM public.activation_requests),
            'pending_requests', (SELECT COUNT(*) FROM public.activation_requests WHERE status = 'pending'),
            'in_progress_requests', (SELECT COUNT(*) FROM public.activation_requests WHERE status = 'in_progress'),
            'completed_this_month', (
                SELECT COUNT(*) FROM public.activation_requests
                WHERE status = 'completed'
                AND date_trunc('month', processed_at) = v_month_start
            ),
            'rejected_this_month', (
                SELECT COUNT(*) FROM public.activation_requests
                WHERE status = 'rejected'
                AND date_trunc('month', processed_at) = v_month_start
            ),
            'total_users_with_activations', (
                SELECT COUNT(DISTINCT user_id) FROM public.activation_requests WHERE status = 'completed'
            )
        ) INTO result;

        RETURN result;
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.get_activation_stats() TO authenticated;

    -- =============================================================================
    -- VERIFICATION
    -- =============================================================================
    DO $$
    BEGIN
        RAISE NOTICE '==============================================';
        RAISE NOTICE 'Migration 043: Fix Activation RLS & Stats';
        RAISE NOTICE '==============================================';
        RAISE NOTICE 'Fixed:';
        RAISE NOTICE '  1. is_platform_admin() uses correct "role" column';
        RAISE NOTICE '  2. is_platform_moderator() uses correct "role" column';
        RAISE NOTICE '  3. Restored activation_requests RLS policies (SELECT/INSERT/UPDATE)';
        RAISE NOTICE '  4. Restored activation_usage RLS policies';
        RAISE NOTICE '  5. Restored activation_products RLS policies';
        RAISE NOTICE '  6. Fixed get_activation_stats() to return proper JSON';
        RAISE NOTICE '==============================================';
    END $$;
