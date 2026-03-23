-- Migration 004: Gumroad Integration
-- Run this in Supabase SQL Editor AFTER running 003_functions_triggers.sql
-- Created: 2026-01-17

-- =============================================================================
-- 1. GUMROAD_CUSTOMERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS gumroad_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gumroad_id TEXT UNIQUE NOT NULL, -- Gumroad's customer ID
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Link to our user
    email TEXT NOT NULL,
    full_name TEXT,
    purchase_email TEXT, -- Email used for purchase (might differ from account email)
    ip_country TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for efficient queries
CREATE INDEX idx_gumroad_customers_gumroad_id ON gumroad_customers(gumroad_id);
CREATE INDEX idx_gumroad_customers_user_id ON gumroad_customers(user_id);
CREATE INDEX idx_gumroad_customers_email ON gumroad_customers(email);

-- =============================================================================
-- 2. GUMROAD_SUBSCRIPTIONS TABLE
-- =============================================================================
CREATE TYPE subscription_status AS ENUM (
    'active',
    'cancelled',
    'expired',
    'failed_payment',
    'refunded'
);

CREATE TABLE IF NOT EXISTS gumroad_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gumroad_subscription_id TEXT UNIQUE NOT NULL, -- Gumroad's subscription ID
    gumroad_customer_id UUID NOT NULL REFERENCES gumroad_customers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    product_id TEXT NOT NULL, -- Gumroad product ID
    product_name TEXT NOT NULL,
    variant_name TEXT, -- Product variant (e.g., "Monthly", "Annual")
    status subscription_status DEFAULT 'active',
    
    -- Pricing information
    price_cents INTEGER NOT NULL, -- Price in cents
    currency TEXT DEFAULT 'USD',
    
    -- Subscription dates
    started_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ, -- When subscription ends/ended
    cancelled_at TIMESTAMPTZ, -- When user cancelled
    failed_at TIMESTAMPTZ, -- When payment failed
    
    -- Billing cycle
    billing_cycle TEXT, -- 'monthly', 'yearly', etc.
    next_charge_date DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT price_positive CHECK (price_cents >= 0)
);

-- Indexes for efficient queries
CREATE INDEX idx_gumroad_subscriptions_gumroad_id ON gumroad_subscriptions(gumroad_subscription_id);
CREATE INDEX idx_gumroad_subscriptions_customer ON gumroad_subscriptions(gumroad_customer_id);
CREATE INDEX idx_gumroad_subscriptions_user ON gumroad_subscriptions(user_id);
CREATE INDEX idx_gumroad_subscriptions_status ON gumroad_subscriptions(status);
CREATE INDEX idx_gumroad_subscriptions_product ON gumroad_subscriptions(product_id);
CREATE INDEX idx_gumroad_subscriptions_active ON gumroad_subscriptions(status, ends_at) 
    WHERE status = 'active';

-- =============================================================================
-- 3. GUMROAD_WEBHOOK_LOGS TABLE (For debugging and audit trail)
-- =============================================================================
CREATE TYPE webhook_event_type AS ENUM (
    'sale',
    'refund',
    'dispute',
    'dispute_won',
    'subscription_updated',
    'subscription_ended',
    'subscription_restarted',
    'cancellation',
    'unknown'
);

CREATE TABLE IF NOT EXISTS gumroad_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type webhook_event_type NOT NULL,
    gumroad_sale_id TEXT, -- Gumroad's sale ID
    payload JSONB NOT NULL, -- Full webhook payload
    processed BOOLEAN DEFAULT false,
    error_message TEXT, -- If processing failed
    ip_address TEXT, -- IP that sent webhook
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Indexes for efficient queries
CREATE INDEX idx_gumroad_webhook_logs_event_type ON gumroad_webhook_logs(event_type);
CREATE INDEX idx_gumroad_webhook_logs_processed ON gumroad_webhook_logs(processed);
CREATE INDEX idx_gumroad_webhook_logs_sale_id ON gumroad_webhook_logs(gumroad_sale_id);
CREATE INDEX idx_gumroad_webhook_logs_created_at ON gumroad_webhook_logs(created_at DESC);

-- =============================================================================
-- 4. GUMROAD_PRODUCTS TABLE (Product catalog sync)
-- =============================================================================
CREATE TABLE IF NOT EXISTS gumroad_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gumroad_product_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER,
    currency TEXT DEFAULT 'USD',
    is_subscription BOOLEAN DEFAULT false,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL, -- Which group to add users to
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for product lookups
CREATE INDEX idx_gumroad_products_gumroad_id ON gumroad_products(gumroad_product_id);

-- =============================================================================
-- 5. RLS POLICIES FOR GUMROAD TABLES
-- =============================================================================

-- Enable RLS
ALTER TABLE gumroad_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gumroad_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gumroad_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gumroad_products ENABLE ROW LEVEL SECURITY;

-- Customers: Users can view their own data
CREATE POLICY "Users can view their own Gumroad data"
    ON gumroad_customers FOR SELECT
    USING (user_id = auth.uid());

-- Subscriptions: Users can view their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
    ON gumroad_subscriptions FOR SELECT
    USING (user_id = auth.uid());

-- Webhook logs: Only system can access (no user policies)
-- Products: Everyone can view products
CREATE POLICY "Products are viewable by everyone"
    ON gumroad_products FOR SELECT
    USING (true);

-- =============================================================================
-- 6. FUNCTIONS FOR GUMROAD INTEGRATION
-- =============================================================================

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM gumroad_subscriptions
        WHERE user_id = p_user_id
        AND status = 'active'
        AND (ends_at IS NULL OR ends_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's subscription status
CREATE OR REPLACE FUNCTION public.get_subscription_status(p_user_id UUID)
RETURNS TABLE (
    status subscription_status,
    product_name TEXT,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.status,
        s.product_name,
        s.ends_at,
        (s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > NOW())) AS is_active
    FROM gumroad_subscriptions s
    WHERE s.user_id = p_user_id
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new Gumroad purchase (called by webhook handler)
CREATE OR REPLACE FUNCTION public.process_gumroad_purchase(
    p_gumroad_id TEXT,
    p_email TEXT,
    p_full_name TEXT,
    p_product_id TEXT,
    p_product_name TEXT,
    p_variant_name TEXT,
    p_price_cents INTEGER,
    p_is_subscription BOOLEAN,
    p_subscription_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_customer_id UUID;
    v_user_id UUID;
    v_subscription_id UUID;
    v_group_id UUID;
    v_temp_password TEXT;
BEGIN
    -- Check if customer already exists
    SELECT id, user_id INTO v_customer_id, v_user_id
    FROM gumroad_customers
    WHERE gumroad_id = p_gumroad_id;
    
    -- If customer doesn't exist, create them
    IF v_customer_id IS NULL THEN
        INSERT INTO gumroad_customers (gumroad_id, email, full_name, purchase_email)
        VALUES (p_gumroad_id, p_email, p_full_name, p_email)
        RETURNING id INTO v_customer_id;
    END IF;
    
    -- If user doesn't exist, create Supabase user account
    IF v_user_id IS NULL THEN
        -- Generate temporary password (user will reset via email)
        v_temp_password := encode(gen_random_bytes(16), 'base64');
        
        -- Create auth user (this will trigger profile creation via trigger)
        -- Note: This requires Supabase Admin API call from backend
        -- For now, we'll just mark that user needs to be created
        -- The actual user creation will happen in the webhook handler
        
        -- Update customer with user_id once created
        -- UPDATE gumroad_customers SET user_id = v_user_id WHERE id = v_customer_id;
    END IF;
    
    -- If it's a subscription, create subscription record
    IF p_is_subscription AND p_subscription_id IS NOT NULL THEN
        INSERT INTO gumroad_subscriptions (
            gumroad_subscription_id,
            gumroad_customer_id,
            user_id,
            product_id,
            product_name,
            variant_name,
            price_cents,
            status,
            started_at
        )
        VALUES (
            p_subscription_id,
            v_customer_id,
            v_user_id,
            p_product_id,
            p_product_name,
            p_variant_name,
            p_price_cents,
            'active',
            NOW()
        )
        RETURNING id INTO v_subscription_id;
        
        -- Get the group associated with this product
        SELECT group_id INTO v_group_id
        FROM gumroad_products
        WHERE gumroad_product_id = p_product_id;
        
        -- Add user to group if user exists and group is configured
        IF v_user_id IS NOT NULL AND v_group_id IS NOT NULL THEN
            INSERT INTO group_members (group_id, user_id, role)
            VALUES (v_group_id, v_user_id, 'member')
            ON CONFLICT (group_id, user_id) DO NOTHING;
        END IF;
    END IF;
    
    RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle subscription cancellation
CREATE OR REPLACE FUNCTION public.cancel_gumroad_subscription(
    p_subscription_id TEXT
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_group_id UUID;
    v_product_id TEXT;
BEGIN
    -- Get user and product info
    SELECT user_id, product_id INTO v_user_id, v_product_id
    FROM gumroad_subscriptions
    WHERE gumroad_subscription_id = p_subscription_id;
    
    -- Update subscription status
    UPDATE gumroad_subscriptions
    SET status = 'cancelled',
        cancelled_at = NOW(),
        ends_at = NOW() + INTERVAL '7 days', -- Grace period
        updated_at = NOW()
    WHERE gumroad_subscription_id = p_subscription_id;
    
    -- Get the group associated with this product
    SELECT group_id INTO v_group_id
    FROM gumroad_products
    WHERE gumroad_product_id = v_product_id;
    
    -- Remove user from group after grace period (handled by scheduled job)
    -- For now, we just update the subscription status
    
    -- Send notification to user
    IF v_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message)
        VALUES (
            v_user_id,
            'new_message', -- Using existing enum, could add 'subscription_cancelled'
            'Subscription Cancelled',
            'Your subscription has been cancelled. You have 7 days of access remaining.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle subscription reactivation
CREATE OR REPLACE FUNCTION public.reactivate_gumroad_subscription(
    p_subscription_id TEXT
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_group_id UUID;
    v_product_id TEXT;
BEGIN
    -- Get user and product info
    SELECT user_id, product_id INTO v_user_id, v_product_id
    FROM gumroad_subscriptions
    WHERE gumroad_subscription_id = p_subscription_id;
    
    -- Update subscription status
    UPDATE gumroad_subscriptions
    SET status = 'active',
        cancelled_at = NULL,
        ends_at = NULL,
        updated_at = NOW()
    WHERE gumroad_subscription_id = p_subscription_id;
    
    -- Get the group associated with this product
    SELECT group_id INTO v_group_id
    FROM gumroad_products
    WHERE gumroad_product_id = v_product_id;
    
    -- Re-add user to group if not already a member
    IF v_user_id IS NOT NULL AND v_group_id IS NOT NULL THEN
        INSERT INTO group_members (group_id, user_id, role)
        VALUES (v_group_id, v_user_id, 'member')
        ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;
    
    -- Send notification to user
    IF v_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message)
        VALUES (
            v_user_id,
            'new_message',
            'Subscription Reactivated',
            'Welcome back! Your subscription has been reactivated.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired subscriptions (run daily via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_subscriptions()
RETURNS VOID AS $$
DECLARE
    v_record RECORD;
BEGIN
    -- Find all subscriptions that have passed their grace period
    FOR v_record IN
        SELECT s.user_id, s.product_id, s.id
        FROM gumroad_subscriptions s
        WHERE s.status = 'cancelled'
        AND s.ends_at < NOW()
    LOOP
        -- Update status to expired
        UPDATE gumroad_subscriptions
        SET status = 'expired'
        WHERE id = v_record.id;
        
        -- Remove user from group
        DELETE FROM group_members
        WHERE user_id = v_record.user_id
        AND group_id = (
            SELECT group_id FROM gumroad_products
            WHERE gumroad_product_id = v_record.product_id
        );
        
        -- Notify user
        INSERT INTO notifications (user_id, type, title, message)
        VALUES (
            v_record.user_id,
            'new_message',
            'Subscription Expired',
            'Your subscription has expired. Please renew to regain access.'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7. TRIGGERS FOR UPDATED_AT
-- =============================================================================
CREATE TRIGGER update_gumroad_customers_updated_at BEFORE UPDATE ON gumroad_customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gumroad_subscriptions_updated_at BEFORE UPDATE ON gumroad_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gumroad_products_updated_at BEFORE UPDATE ON gumroad_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 004: Gumroad integration created successfully!';
    RAISE NOTICE '💳 Gumroad customers and subscriptions tables ready';
    RAISE NOTICE '🔗 Webhook logging enabled';
    RAISE NOTICE '🎯 Subscription management functions active';
END $$;
