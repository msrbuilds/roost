-- Fix RLS policies for events table to allow community-wide events (NULL group_id)
-- Also fix usage of is_group_admin to is_group_admin_or_mod

-- 1. Alter schema to allow NULL group_id
ALTER TABLE events ALTER COLUMN group_id DROP NOT NULL;

-- 2. Update indices
DROP INDEX IF EXISTS idx_events_group;
CREATE INDEX idx_events_group ON events(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_events_no_group ON events(start_time) WHERE group_id IS NULL;

-- 3. Drop existing policies
DROP POLICY IF EXISTS "Events viewable by group members" ON events;
DROP POLICY IF EXISTS "Group members can create events" ON events;
DROP POLICY IF EXISTS "Creators and admins can update events" ON events;
DROP POLICY IF EXISTS "Creators and admins can delete events" ON events;
-- Drop any potentially created erroneous policies from previous attempts
DROP POLICY IF EXISTS "Events viewable by everyone or group members" ON events;
DROP POLICY IF EXISTS "Users can create events" ON events;
DROP POLICY IF EXISTS "Creators and group admins can update events" ON events;
DROP POLICY IF EXISTS "Creators and group admins can delete events" ON events;

-- 4. Create new policies

-- View Policy
CREATE POLICY "Events viewable by everyone or group members"
    ON events FOR SELECT
    USING (
        group_id IS NULL 
        OR is_group_member(group_id, auth.uid())
    );

-- Create Policy
CREATE POLICY "Users can create events"
    ON events FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
        AND (
            group_id IS NULL -- Community event
            OR is_group_member(group_id, auth.uid()) -- Group event
        )
    );

-- Update Policy
CREATE POLICY "Creators and group admins can update events"
    ON events FOR UPDATE
    USING (
        auth.uid() = created_by
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

-- Delete Policy
CREATE POLICY "Creators and group admins can delete events"
    ON events FOR DELETE
    USING (
        auth.uid() = created_by
        OR (group_id IS NOT NULL AND is_group_admin_or_mod(group_id, auth.uid()))
    );

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 015: Events RLS policies updated and group_id made nullable!';
END $$;
