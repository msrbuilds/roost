-- Migration 044: Add license_key to activation_products
-- Purpose: Store a license key per product so admins can quickly copy it
--          when processing activation requests.
-- Created: 2026-02-09

ALTER TABLE public.activation_products
    ADD COLUMN IF NOT EXISTS license_key TEXT DEFAULT NULL;

COMMENT ON COLUMN public.activation_products.license_key
    IS 'License key associated with this product, shown to admins when processing requests';

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 044: Add license_key to activation_products';
    RAISE NOTICE '==============================================';
END $$;
