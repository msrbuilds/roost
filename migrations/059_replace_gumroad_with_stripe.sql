-- Migration 059: Replace Gumroad with Stripe Integration
-- Run this in Supabase SQL Editor
-- Created: 2026-03-23

-- =============================================================================
-- 1. CREATE STRIPE TABLES
-- =============================================================================

-- Stripe customers (maps app users to Stripe customer IDs)
CREATE TABLE IF NOT EXISTS stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_customer_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);
CREATE INDEX idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX idx_stripe_customers_email ON stripe_customers(email);

-- Stripe subscriptions
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    stripe_price_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT stripe_sub_status_check CHECK (
        status IN ('active', 'cancelled', 'expired', 'failed_payment', 'refunded', 'past_due', 'trialing')
    )
);

CREATE INDEX idx_stripe_subscriptions_sub_id ON stripe_subscriptions(stripe_subscription_id);
CREATE INDEX idx_stripe_subscriptions_customer_id ON stripe_subscriptions(stripe_customer_id);
CREATE INDEX idx_stripe_subscriptions_user_id ON stripe_subscriptions(user_id);
CREATE INDEX idx_stripe_subscriptions_status ON stripe_subscriptions(status);

-- Stripe webhook logs
CREATE TABLE IF NOT EXISTS stripe_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    stripe_event_id TEXT UNIQUE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_stripe_webhook_logs_event_id ON stripe_webhook_logs(stripe_event_id);
CREATE INDEX idx_stripe_webhook_logs_created_at ON stripe_webhook_logs(created_at DESC);
CREATE INDEX idx_stripe_webhook_logs_processed ON stripe_webhook_logs(processed);

-- =============================================================================
-- 2. RLS POLICIES
-- =============================================================================

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own customer record
CREATE POLICY "Users can view own stripe customer"
    ON stripe_customers FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can view their own subscriptions
CREATE POLICY "Users can view own stripe subscriptions"
    ON stripe_subscriptions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Webhook logs are admin-only (no user policy needed, accessed via service role)

-- Service role has full access (for webhook handler and admin APIs)
-- The supabaseAdmin client uses the service role key, which bypasses RLS

-- =============================================================================
-- 3. UPDATE has_active_subscription FUNCTION
-- =============================================================================

-- Drop old function if it exists with any signature
DROP FUNCTION IF EXISTS public.has_active_subscription(UUID);

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM stripe_subscriptions
        WHERE user_id = p_user_id
        AND status = 'active'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated;

-- =============================================================================
-- 4. DROP OLD GUMROAD OBJECTS
-- =============================================================================

-- Drop old Gumroad functions
DROP FUNCTION IF EXISTS public.cancel_gumroad_subscription(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.process_gumroad_purchase(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.reactivate_gumroad_subscription(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_subscriptions() CASCADE;
DROP FUNCTION IF EXISTS public.get_subscription_status(UUID) CASCADE;

-- Drop old Gumroad tables (order matters for FK constraints)
DROP TABLE IF EXISTS public.gumroad_webhook_logs CASCADE;
DROP TABLE IF EXISTS public.gumroad_subscriptions CASCADE;
DROP TABLE IF EXISTS public.gumroad_customers CASCADE;
DROP TABLE IF EXISTS public.gumroad_products CASCADE;

-- Drop old enum type (only if not used elsewhere)
DROP TYPE IF EXISTS public.subscription_status CASCADE;
DROP TYPE IF EXISTS public.webhook_event_type CASCADE;

-- =============================================================================
-- 5. UPDATED_AT TRIGGER FOR NEW TABLES
-- =============================================================================

-- Reuse the existing update_updated_at_column trigger function
CREATE TRIGGER update_stripe_customers_updated_at
    BEFORE UPDATE ON stripe_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_subscriptions_updated_at
    BEFORE UPDATE ON stripe_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
