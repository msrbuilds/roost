-- Migration 027: Product Activations System
-- Run this in Supabase SQL Editor
-- Created: 2026-02-01
--
-- This migration creates a system for users to request product activations
-- (Elementor, Bricks Builder, themes, etc.) by providing website credentials.
-- Admins/moderators process requests and update status.

-- =============================================================================
-- 1. ACTIVATION PRODUCTS TABLE (Admin-managed products)
-- =============================================================================
CREATE TABLE IF NOT EXISTS activation_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                           -- e.g., "Elementor Pro"
    slug TEXT UNIQUE NOT NULL,                    -- URL-friendly name
    description TEXT,                             -- Product description
    product_type TEXT NOT NULL DEFAULT 'plugin',  -- elementor, bricks, theme, plugin, other
    monthly_limit INTEGER NOT NULL DEFAULT 1,     -- Max activations per user per month
    is_active BOOLEAN DEFAULT true,               -- Whether product is available
    icon_url TEXT,                                -- Product icon/logo
    instructions TEXT,                            -- Instructions for users
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT monthly_limit_positive CHECK (monthly_limit > 0)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_activation_products_slug ON activation_products(slug);
CREATE INDEX IF NOT EXISTS idx_activation_products_type ON activation_products(product_type);
CREATE INDEX IF NOT EXISTS idx_activation_products_active ON activation_products(is_active) WHERE is_active = true;

-- =============================================================================
-- 2. ACTIVATION REQUEST STATUS ENUM
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE activation_request_status AS ENUM (
        'pending',      -- Request submitted, awaiting processing
        'in_progress',  -- Admin is working on it
        'completed',    -- Activation done
        'rejected'      -- Request denied
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 3. ACTIVATION REQUESTS TABLE (User requests)
-- =============================================================================
CREATE TABLE IF NOT EXISTS activation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES activation_products(id) ON DELETE CASCADE,
    status activation_request_status DEFAULT 'pending',

    -- Website credentials
    website_url TEXT NOT NULL,                    -- User's website URL
    wp_username TEXT NOT NULL,                    -- WordPress admin username
    wp_password TEXT NOT NULL,                    -- WordPress admin password

    -- Notes
    notes TEXT,                                   -- User's notes/reason
    admin_notes TEXT,                             -- Admin notes (visible after processing)

    -- Processing info
    processed_by UUID REFERENCES profiles(id),   -- Admin/mod who processed
    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_activation_requests_user ON activation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_activation_requests_product ON activation_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_activation_requests_status ON activation_requests(status);
CREATE INDEX IF NOT EXISTS idx_activation_requests_pending ON activation_requests(status, created_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_activation_requests_month ON activation_requests(user_id, product_id, created_at);

-- =============================================================================
-- 4. ACTIVATION USAGE TRACKING TABLE (Monthly counters)
-- =============================================================================
CREATE TABLE IF NOT EXISTS activation_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES activation_products(id) ON DELETE CASCADE,
    month_year DATE NOT NULL,                     -- First day of month (e.g., 2026-02-01)
    usage_count INTEGER DEFAULT 0,                -- Number of activations used

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_product_month UNIQUE (user_id, product_id, month_year),
    CONSTRAINT usage_count_positive CHECK (usage_count >= 0)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_activation_usage_lookup ON activation_usage(user_id, product_id, month_year);

-- =============================================================================
-- 5. FUTURE: ACTIVATION PACKAGES TABLE (Gumroad integration)
-- =============================================================================
CREATE TABLE IF NOT EXISTS activation_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                           -- e.g., "Pro Builder Pack"
    description TEXT,
    gumroad_product_id TEXT,                      -- Links to Gumroad product

    -- Package contents: Array of {product_id, bonus_limit}
    products JSONB NOT NULL DEFAULT '[]',

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User packages (which packages a user has purchased)
CREATE TABLE IF NOT EXISTS user_activation_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES activation_packages(id) ON DELETE CASCADE,

    status TEXT DEFAULT 'active',                 -- 'active', 'cancelled', 'expired'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,

    -- Gumroad tracking
    gumroad_subscription_id TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_package UNIQUE (user_id, package_id)
);

-- =============================================================================
-- 6. RLS POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE activation_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activation_packages ENABLE ROW LEVEL SECURITY;

-- ACTIVATION_PRODUCTS
-- Anyone authenticated can view active products
CREATE POLICY "Active products viewable by authenticated users"
    ON activation_products FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Platform admins can view all products (including inactive)
CREATE POLICY "Platform admins can view all products"
    ON activation_products FOR SELECT
    TO authenticated
    USING (is_platform_admin(auth.uid()));

-- Only platform admins can insert products
CREATE POLICY "Platform admins can create products"
    ON activation_products FOR INSERT
    TO authenticated
    WITH CHECK (is_platform_admin(auth.uid()));

-- Only platform admins can update products
CREATE POLICY "Platform admins can update products"
    ON activation_products FOR UPDATE
    TO authenticated
    USING (is_platform_admin(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()));

-- Only platform admins can delete products
CREATE POLICY "Platform admins can delete products"
    ON activation_products FOR DELETE
    TO authenticated
    USING (is_platform_admin(auth.uid()));

-- ACTIVATION_REQUESTS
-- Users can view their own requests
CREATE POLICY "Users can view own activation requests"
    ON activation_requests FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Platform admins and moderators can view all requests
CREATE POLICY "Admins can view all activation requests"
    ON activation_requests FOR SELECT
    TO authenticated
    USING (is_platform_admin(auth.uid()) OR is_platform_moderator(auth.uid()));

-- Users can create their own requests
CREATE POLICY "Users can create activation requests"
    ON activation_requests FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Platform admins and moderators can update any request
CREATE POLICY "Admins can update activation requests"
    ON activation_requests FOR UPDATE
    TO authenticated
    USING (is_platform_admin(auth.uid()) OR is_platform_moderator(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()) OR is_platform_moderator(auth.uid()));

-- ACTIVATION_USAGE
-- Users can view their own usage
CREATE POLICY "Users can view own activation usage"
    ON activation_usage FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Platform admins can view all usage
CREATE POLICY "Admins can view all activation usage"
    ON activation_usage FOR SELECT
    TO authenticated
    USING (is_platform_admin(auth.uid()));

-- System-managed inserts/updates (via functions only)
CREATE POLICY "System can manage activation usage"
    ON activation_usage FOR ALL
    TO authenticated
    USING (is_platform_admin(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()));

-- ACTIVATION_PACKAGES (admin only)
CREATE POLICY "Admins can manage activation packages"
    ON activation_packages FOR ALL
    TO authenticated
    USING (is_platform_admin(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()));

-- Users can view active packages
CREATE POLICY "Users can view active packages"
    ON activation_packages FOR SELECT
    TO authenticated
    USING (is_active = true);

-- USER_ACTIVATION_PACKAGES
CREATE POLICY "Users can view own packages"
    ON user_activation_packages FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user packages"
    ON user_activation_packages FOR ALL
    TO authenticated
    USING (is_platform_admin(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()));

-- =============================================================================
-- 7. DATABASE FUNCTIONS
-- =============================================================================

-- Get user's remaining activations for a product this month
CREATE OR REPLACE FUNCTION get_remaining_activations(
    p_user_id UUID,
    p_product_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_monthly_limit INTEGER;
    v_used_count INTEGER;
    v_month_start DATE;
BEGIN
    -- Get current month start
    v_month_start := date_trunc('month', NOW())::DATE;

    -- Get product's monthly limit
    SELECT monthly_limit INTO v_monthly_limit
    FROM activation_products
    WHERE id = p_product_id AND is_active = true;

    IF v_monthly_limit IS NULL THEN
        RETURN 0; -- Product not found or inactive
    END IF;

    -- Get current usage
    SELECT COALESCE(usage_count, 0) INTO v_used_count
    FROM activation_usage
    WHERE user_id = p_user_id
    AND product_id = p_product_id
    AND month_year = v_month_start;

    RETURN GREATEST(v_monthly_limit - COALESCE(v_used_count, 0), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has pending or in-progress request for a product
CREATE OR REPLACE FUNCTION has_active_request(
    p_user_id UUID,
    p_product_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM activation_requests
        WHERE user_id = p_user_id
        AND product_id = p_product_id
        AND status IN ('pending', 'in_progress')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Request an activation (validates limits)
CREATE OR REPLACE FUNCTION request_activation(
    p_user_id UUID,
    p_product_id UUID,
    p_website_url TEXT,
    p_wp_username TEXT,
    p_wp_password TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_remaining INTEGER;
    v_request_id UUID;
BEGIN
    -- Check remaining activations
    v_remaining := get_remaining_activations(p_user_id, p_product_id);

    IF v_remaining <= 0 THEN
        RAISE EXCEPTION 'Monthly activation limit reached for this product';
    END IF;

    -- Check for existing pending/in-progress request
    IF has_active_request(p_user_id, p_product_id) THEN
        RAISE EXCEPTION 'You already have an active request for this product';
    END IF;

    -- Create request
    INSERT INTO activation_requests (
        user_id,
        product_id,
        website_url,
        wp_username,
        wp_password,
        notes,
        status
    )
    VALUES (
        p_user_id,
        p_product_id,
        p_website_url,
        p_wp_username,
        p_wp_password,
        p_notes,
        'pending'
    )
    RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process activation request (admin/mod only)
CREATE OR REPLACE FUNCTION process_activation_request(
    p_request_id UUID,
    p_processor_id UUID,
    p_status activation_request_status,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_request RECORD;
    v_month_start DATE;
    v_product_name TEXT;
BEGIN
    -- Verify processor has permission (admin or moderator)
    IF NOT (is_platform_admin(p_processor_id) OR is_platform_moderator(p_processor_id)) THEN
        RAISE EXCEPTION 'Only platform admins or moderators can process activation requests';
    END IF;

    -- Get request details
    SELECT ar.*, ap.name as product_name
    INTO v_request
    FROM activation_requests ar
    JOIN activation_products ap ON ap.id = ar.product_id
    WHERE ar.id = p_request_id;

    IF v_request IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    -- Update request
    UPDATE activation_requests
    SET status = p_status,
        admin_notes = p_admin_notes,
        processed_by = p_processor_id,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;

    -- If completed, increment usage counter
    IF p_status = 'completed' THEN
        v_month_start := date_trunc('month', v_request.created_at)::DATE;

        INSERT INTO activation_usage (user_id, product_id, month_year, usage_count)
        VALUES (v_request.user_id, v_request.product_id, v_month_start, 1)
        ON CONFLICT (user_id, product_id, month_year)
        DO UPDATE SET
            usage_count = activation_usage.usage_count + 1,
            updated_at = NOW();
    END IF;

    -- Create notification for user
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
        v_request.user_id,
        'new_message',
        CASE
            WHEN p_status = 'completed' THEN 'Activation Completed'
            WHEN p_status = 'in_progress' THEN 'Activation In Progress'
            WHEN p_status = 'rejected' THEN 'Activation Request Update'
            ELSE 'Activation Request Update'
        END,
        CASE
            WHEN p_status = 'completed' THEN 'Your ' || v_request.product_name || ' activation has been completed!'
            WHEN p_status = 'in_progress' THEN 'Your ' || v_request.product_name || ' activation is being processed.'
            WHEN p_status = 'rejected' THEN 'Your ' || v_request.product_name || ' activation request has been reviewed.'
            ELSE 'Your activation request status has been updated.'
        END,
        '/activations'
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get activation statistics (admin dashboard)
CREATE OR REPLACE FUNCTION get_activation_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
    v_month_start DATE;
BEGIN
    v_month_start := date_trunc('month', NOW())::DATE;

    SELECT json_build_object(
        'total_products', (SELECT COUNT(*) FROM activation_products WHERE is_active = true),
        'total_requests', (SELECT COUNT(*) FROM activation_requests),
        'pending_requests', (SELECT COUNT(*) FROM activation_requests WHERE status = 'pending'),
        'in_progress_requests', (SELECT COUNT(*) FROM activation_requests WHERE status = 'in_progress'),
        'completed_this_month', (
            SELECT COUNT(*) FROM activation_requests
            WHERE status = 'completed'
            AND date_trunc('month', processed_at) = v_month_start
        ),
        'rejected_this_month', (
            SELECT COUNT(*) FROM activation_requests
            WHERE status = 'rejected'
            AND date_trunc('month', processed_at) = v_month_start
        ),
        'total_users_with_activations', (
            SELECT COUNT(DISTINCT user_id) FROM activation_requests WHERE status = 'completed'
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 8. TRIGGERS FOR UPDATED_AT
-- =============================================================================
CREATE TRIGGER update_activation_products_updated_at
    BEFORE UPDATE ON activation_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activation_requests_updated_at
    BEFORE UPDATE ON activation_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activation_usage_updated_at
    BEFORE UPDATE ON activation_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activation_packages_updated_at
    BEFORE UPDATE ON activation_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_activation_packages_updated_at
    BEFORE UPDATE ON user_activation_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 027: Product Activations System';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - activation_products (admin-managed products)';
    RAISE NOTICE '  - activation_requests (user requests)';
    RAISE NOTICE '  - activation_usage (monthly tracking)';
    RAISE NOTICE '  - activation_packages (future Gumroad integration)';
    RAISE NOTICE '  - user_activation_packages (user purchased packages)';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  - get_remaining_activations()';
    RAISE NOTICE '  - has_active_request()';
    RAISE NOTICE '  - request_activation()';
    RAISE NOTICE '  - process_activation_request()';
    RAISE NOTICE '  - get_activation_stats()';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS policies configured for all tables';
    RAISE NOTICE '==============================================';
END $$;
