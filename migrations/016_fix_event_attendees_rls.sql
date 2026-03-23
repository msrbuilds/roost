-- Fix RLS policies for event_attendees table to allow RSVPs for community events (NULL group_id)

-- Drop existing policies
DROP POLICY IF EXISTS "Event attendees viewable by group members" ON event_attendees;
DROP POLICY IF EXISTS "Users can RSVP to events" ON event_attendees;

-- Recreate SELECT policy
CREATE POLICY "Event attendees viewable by everyone or group members"
    ON event_attendees FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_id
            AND (
                events.group_id IS NULL -- Community event
                OR is_group_member(events.group_id, auth.uid()) -- Group event
            )
        )
    );

-- Recreate INSERT policy
CREATE POLICY "Users can RSVP to events"
    ON event_attendees FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_id
            AND (
                events.group_id IS NULL -- Community event
                OR is_group_member(events.group_id, auth.uid()) -- Group event
            )
        )
    );

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 016: Event Attendees RLS policies updated!';
END $$;
