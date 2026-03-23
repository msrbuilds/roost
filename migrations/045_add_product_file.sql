    -- Migration 045: Add file fields to activation_products
    -- Purpose: Allow admins to upload plugin/theme files per product,
    --          so users can download them after submitting an activation request.
    -- Created: 2026-02-09

    ALTER TABLE public.activation_products
        ADD COLUMN IF NOT EXISTS file_url TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS file_name TEXT DEFAULT NULL;

    COMMENT ON COLUMN public.activation_products.file_url
        IS 'S3 URL for the plugin/theme file users can download';
    COMMENT ON COLUMN public.activation_products.file_name
        IS 'Original file name of the uploaded plugin/theme file';

    DO $$
    BEGIN
        RAISE NOTICE '==============================================';
        RAISE NOTICE 'Migration 045: Add file fields to activation_products';
        RAISE NOTICE '==============================================';
    END $$;
