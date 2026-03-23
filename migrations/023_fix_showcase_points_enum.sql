-- Migration 023: Fix Showcase Points Enum
-- Run this in Supabase SQL Editor
-- Created: 2026-02-01
-- Description: Adds 'showcase_approved' to point_action_type enum and fixes the trigger

-- =============================================================================
-- 1. ADD NEW ENUM VALUE
-- =============================================================================
ALTER TYPE point_action_type ADD VALUE IF NOT EXISTS 'showcase_approved';

-- =============================================================================
-- 2. UPDATE THE TRIGGER FUNCTION
-- =============================================================================
-- Use SECURITY DEFINER to bypass RLS when inserting point_activities from trigger
CREATE OR REPLACE FUNCTION award_showcase_approval_points()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only trigger when status changes to 'approved' or 'featured'
    IF NEW.status IN ('approved', 'featured') AND OLD.status = 'pending' THEN
        -- Award 10 points for approval
        INSERT INTO point_activities (
            user_id,
            action_type,
            points,
            description,
            reference_id,
            group_id
        ) VALUES (
            NEW.author_id,
            'showcase_approved',
            10,
            'Showcase approved: ' || NEW.title,
            NEW.id,
            NULL
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
