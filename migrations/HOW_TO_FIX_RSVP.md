# How to Fix RSVP Error (403 Forbidden)

## Problem
You are seeing a `403` error when trying to RSVP to an event. This is because the database policies ("Row Level Security") currently check if you are a member of the event's group. For **community events** (which have no group), this check fails.

## Solution
We have created a new migration script `016_fix_event_attendees_rls.sql` that updates these policies to allow RSVPs for community events.

## Steps

1.  **Open Supabase SQL Editor**
    - Go to your Supabase project dashboard.
    - Click on the **SQL Editor** icon in the left sidebar.

2.  **Run the Migration**
    - Create a new query.
    - Copy the contents of `migrations/016_fix_event_attendees_rls.sql` (see below).
    - Paste it into the SQL Editor.
    - Click **Run**.

### Migration Script Content
```sql
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
```

3.  **Verify**
    - Go back to your application.
    - Try to RSVP to a community event.
    - It should work now!
