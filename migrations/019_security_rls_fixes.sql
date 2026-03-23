-- =====================================================
-- Migration 019: Security RLS Policy Fixes
-- Created: 2026-01-31
-- Purpose: Fix critical RLS policy vulnerabilities identified in security audit
-- =====================================================

-- =====================================================
-- 1. FIX LEADERBOARD_ENTRIES - Remove overly permissive ALL policy
-- =====================================================

-- Drop the dangerous policy that allows any user to modify leaderboard
DROP POLICY IF EXISTS "System can manage leaderboard" ON leaderboard_entries;

-- Create read-only policy for authenticated users
-- Note: Checks if group_id column exists and creates appropriate policy
DO $$
BEGIN
    -- Check if group_id column exists in leaderboard_entries
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leaderboard_entries' AND column_name = 'group_id'
    ) THEN
        -- Drop existing policy if any
        DROP POLICY IF EXISTS "Users can view leaderboard entries" ON leaderboard_entries;

        -- Create policy with group awareness
        EXECUTE '
            CREATE POLICY "Users can view leaderboard entries"
                ON leaderboard_entries FOR SELECT
                TO authenticated
                USING (
                    group_id IS NULL
                    OR
                    EXISTS (
                        SELECT 1 FROM group_members
                        WHERE group_members.group_id = leaderboard_entries.group_id
                        AND group_members.user_id = auth.uid()
                    )
                )
        ';
    ELSE
        -- No group_id column - create simpler policy (all authenticated users can view)
        DROP POLICY IF EXISTS "Users can view leaderboard entries" ON leaderboard_entries;

        EXECUTE '
            CREATE POLICY "Users can view leaderboard entries"
                ON leaderboard_entries FOR SELECT
                TO authenticated
                USING (true)
        ';
    END IF;
END $$;

-- Note: Leaderboard entries should ONLY be modified via database functions/triggers
-- No INSERT/UPDATE/DELETE policies are created intentionally

-- =====================================================
-- 2. FIX POINT_ACTIVITIES - Prevent direct user inserts
-- =====================================================

-- Only run if point_activities table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'point_activities') THEN
        -- Drop the overly permissive insert policy
        DROP POLICY IF EXISTS "System can insert point activities" ON point_activities;

        -- Point activities should only be inserted via triggers, not directly by users
        -- The read policy remains unchanged - users can view their own activity

        -- Add admin view policy for auditing (drop first if exists)
        DROP POLICY IF EXISTS "Platform admins can view all point activities" ON point_activities;

        EXECUTE '
            CREATE POLICY "Platform admins can view all point activities"
                ON point_activities FOR SELECT
                TO authenticated
                USING (
                    user_id = auth.uid()
                    OR
                    EXISTS (
                        SELECT 1 FROM profiles
                        WHERE profiles.id = auth.uid()
                        AND profiles.role IN (''admin'', ''superadmin'')
                    )
                )
        ';
    END IF;
END $$;

-- =====================================================
-- 3. FIX COMMENTS RLS - Restore group privacy awareness
-- =====================================================

-- Only run if comments table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments') THEN
        -- Drop the overly permissive select policy
        DROP POLICY IF EXISTS "Users can view all comments" ON comments;
        DROP POLICY IF EXISTS "Comments viewable based on post visibility" ON comments;

        -- Create privacy-aware comment viewing policy
        EXECUTE '
            CREATE POLICY "Comments viewable based on post visibility"
                ON comments FOR SELECT
                TO authenticated
                USING (
                    EXISTS (
                        SELECT 1 FROM posts
                        WHERE posts.id = comments.post_id
                        AND (
                            posts.group_id IS NULL
                            OR
                            EXISTS (
                                SELECT 1 FROM group_members
                                WHERE group_members.group_id = posts.group_id
                                AND group_members.user_id = auth.uid()
                            )
                        )
                    )
                )
        ';
    END IF;
END $$;

-- =====================================================
-- 4. FIX REACTIONS RLS - Respect post/group visibility
-- =====================================================

-- Only run if reactions table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reactions') THEN
        -- Drop the overly permissive select policy
        DROP POLICY IF EXISTS "Reactions are viewable by everyone" ON reactions;
        DROP POLICY IF EXISTS "Reactions viewable based on content visibility" ON reactions;

        -- Create visibility-aware reaction viewing policy
        EXECUTE '
            CREATE POLICY "Reactions viewable based on content visibility"
                ON reactions FOR SELECT
                TO authenticated
                USING (
                    CASE
                        WHEN reactable_type = ''post'' THEN
                            EXISTS (
                                SELECT 1 FROM posts
                                WHERE posts.id = reactions.reactable_id
                                AND (
                                    posts.group_id IS NULL
                                    OR EXISTS (
                                        SELECT 1 FROM group_members
                                        WHERE group_members.group_id = posts.group_id
                                        AND group_members.user_id = auth.uid()
                                    )
                                )
                            )
                        WHEN reactable_type = ''comment'' THEN
                            EXISTS (
                                SELECT 1 FROM comments c
                                JOIN posts p ON p.id = c.post_id
                                WHERE c.id = reactions.reactable_id
                                AND (
                                    p.group_id IS NULL
                                    OR EXISTS (
                                        SELECT 1 FROM group_members
                                        WHERE group_members.group_id = p.group_id
                                        AND group_members.user_id = auth.uid()
                                    )
                                )
                            )
                        ELSE false
                    END
                )
        ';
    END IF;
END $$;

-- =====================================================
-- 5. FIX ASSETS RLS - Check post/message visibility
-- =====================================================

-- Only run if assets table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assets') THEN
        -- Drop the overly permissive select policy
        DROP POLICY IF EXISTS "Assets are viewable based on context" ON assets;
        DROP POLICY IF EXISTS "Assets viewable based on parent visibility" ON assets;

        -- Create context-aware asset viewing policy
        -- Note: assets table uses 'uploaded_by' not 'user_id', and may not have 'group_id'
        EXECUTE '
            CREATE POLICY "Assets viewable based on parent visibility"
                ON assets FOR SELECT
                TO authenticated
                USING (
                    (
                        post_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM posts
                            WHERE posts.id = assets.post_id
                            AND (
                                posts.group_id IS NULL
                                OR EXISTS (
                                    SELECT 1 FROM group_members
                                    WHERE group_members.group_id = posts.group_id
                                    AND group_members.user_id = auth.uid()
                                )
                            )
                        )
                    )
                    OR
                    (
                        message_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM messages
                            WHERE messages.id = assets.message_id
                            AND (
                                messages.sender_id = auth.uid()
                                OR messages.recipient_id = auth.uid()
                            )
                        )
                    )
                    OR
                    uploaded_by = auth.uid()
                )
        ';
    END IF;
END $$;

-- =====================================================
-- 6. ADD WEBHOOK LOGS ADMIN POLICY
-- =====================================================

-- Only run if gumroad_webhook_logs table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gumroad_webhook_logs') THEN
        -- Drop existing policy if any
        DROP POLICY IF EXISTS "Platform admins can view webhook logs" ON gumroad_webhook_logs;

        -- Allow platform admins to view webhook logs for debugging
        EXECUTE '
            CREATE POLICY "Platform admins can view webhook logs"
                ON gumroad_webhook_logs FOR SELECT
                TO authenticated
                USING (
                    EXISTS (
                        SELECT 1 FROM profiles
                        WHERE profiles.id = auth.uid()
                        AND profiles.role IN (''admin'', ''superadmin'')
                    )
                )
        ';
    END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERIES (run these to verify policies)
-- =====================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('leaderboard_entries', 'point_activities', 'comments', 'reactions', 'assets', 'gumroad_webhook_logs')
-- ORDER BY tablename, policyname;
