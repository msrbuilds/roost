-- Migration: Add feature_request_id to assets table
-- Allows images to be attached to feature requests

-- Add the column
ALTER TABLE public.assets
ADD COLUMN feature_request_id UUID REFERENCES public.feature_requests(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_assets_feature_request_id ON public.assets(feature_request_id)
WHERE feature_request_id IS NOT NULL;
