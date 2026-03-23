# How to Fix Event Creation (RLS Error)

The "new row violates row-level security policy" error (403) occurs because the database currently doesn't allow creating events without a group (Community Events).

## Steps to Fix

1.  **Open Supabase SQL Editor**
    Go to your Supabase project dashboard -> SQL Editor.

2.  **Run Migration 015**
    Copy the content of `migrations/015_fix_events_rls_null_group.sql` and run it.

    ```sql
    -- Fix RLS policies for events table to allow community-wide events (NULL group_id)

    -- Drop existing policies
    DROP POLICY IF EXISTS "Group members can view events" ON events;
    DROP POLICY IF EXISTS "Group admins can insert events" ON events;
    DROP POLICY IF EXISTS "Group admins can update events" ON events;
    DROP POLICY IF EXISTS "Group admins can delete events" ON events;
    DROP POLICY IF EXISTS "Events are viewable by group members" ON events; -- Possible alternate name

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
                group_id IS NULL -- Community event (allow any auth user)
                OR is_group_member(group_id, auth.uid()) -- Group event
            )
        );

    -- Update Policy
    CREATE POLICY "Creators and group admins can update events"
        ON events FOR UPDATE
        USING (
            auth.uid() = created_by
            OR (group_id IS NOT NULL AND is_group_admin(group_id, auth.uid()))
        );

    -- Delete Policy
    CREATE POLICY "Creators and group admins can delete events"
        ON events FOR DELETE
        USING (
            auth.uid() = created_by
            OR (group_id IS NOT NULL AND is_group_admin(group_id, auth.uid()))
        );
    ```

3.  **Verify**
    Try creating a global event again. It should work!
