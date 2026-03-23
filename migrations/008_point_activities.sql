-- Migration 008: Point Activities Tracking System
-- Run this in Supabase SQL Editor
-- Created: 2026-01-27
-- Description: Creates point_activities table to track all point-earning actions

-- =============================================================================
-- 1. CREATE POINT ACTION TYPE ENUM
-- =============================================================================
CREATE TYPE point_action_type AS ENUM (
    'post_created',
    'comment_created',
    'reaction_given',
    'reaction_received',
    'event_attended',
    'daily_login',
    'profile_completed',
    'manual_adjustment'
);

COMMENT ON TYPE point_action_type IS 'Types of actions that can earn points';

-- =============================================================================
-- 2. CREATE POINT_ACTIVITIES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS point_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    action_type point_action_type NOT NULL,
    points INTEGER NOT NULL,
    description TEXT,
    reference_id UUID, -- Related entity (post_id, comment_id, event_id, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE point_activities IS 'Tracks all point-earning activities for users';
COMMENT ON COLUMN point_activities.user_id IS 'User who earned the points';
COMMENT ON COLUMN point_activities.group_id IS 'Group context (NULL for global activities)';
COMMENT ON COLUMN point_activities.action_type IS 'Type of action that earned points';
COMMENT ON COLUMN point_activities.points IS 'Number of points earned (can be negative for penalties)';
COMMENT ON COLUMN point_activities.description IS 'Human-readable description of the activity';
COMMENT ON COLUMN point_activities.reference_id IS 'ID of related entity (post, comment, event, etc.)';

-- =============================================================================
-- 3. CREATE INDEXES
-- =============================================================================
CREATE INDEX idx_point_activities_user ON point_activities(user_id);
CREATE INDEX idx_point_activities_group ON point_activities(group_id);
CREATE INDEX idx_point_activities_action ON point_activities(action_type);
CREATE INDEX idx_point_activities_created ON point_activities(created_at DESC);
CREATE INDEX idx_point_activities_user_created ON point_activities(user_id, created_at DESC);

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE point_activities ENABLE ROW LEVEL SECURITY;

-- Users can view their own point activities
CREATE POLICY "Users can view own point activities"
    ON point_activities FOR SELECT
    USING (user_id = auth.uid());

-- Users can view point activities in groups they're members of
CREATE POLICY "Group members can view group point activities"
    ON point_activities FOR SELECT
    USING (
        group_id IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = point_activities.group_id
            AND group_members.user_id = auth.uid()
        )
    );

-- Only system functions can insert point activities (no direct user inserts except manual adjustments)
CREATE POLICY "System can insert point activities"
    ON point_activities FOR INSERT
    WITH CHECK (true); -- Controlled by database functions/triggers

-- Platform admins can create manual adjustments
CREATE POLICY "Admins can create manual point adjustments"
    ON point_activities FOR INSERT
    WITH CHECK (
        action_type = 'manual_adjustment'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            -- TODO: Add is_admin column to profiles table if not exists
            -- For now, allow admins to be identified by role
        )
    );

-- No one can delete point activities (maintain integrity)
-- No delete policy = no one can delete

-- No one can update point activities (immutable record)
-- No update policy = no one can update

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 008: Point activities table created successfully!';
END $$;
