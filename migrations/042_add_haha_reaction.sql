-- Migration 042: Add 'haha' Reaction Type
-- Purpose: Add 'haha' reaction to the reaction_type enum
-- Created: 2026-02-08

-- =============================================================================
-- ADD NEW REACTION TYPE TO ENUM
-- =============================================================================

-- Add 'haha' to the reaction_type enum
ALTER TYPE public.reaction_type ADD VALUE IF NOT EXISTS 'haha';

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 042: Added haha reaction type!';
    RAISE NOTICE '✓ reaction_type enum now includes: like, love, fire, clap, think, haha';
END $$;
