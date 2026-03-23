-- FIX: Comments RLS Policy
-- Run this in Supabase SQL Editor

-- =============================================================================
-- Enable RLS on comments table
-- =============================================================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Drop existing policies
-- =============================================================================
DROP POLICY IF EXISTS "Users can view all comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
DROP POLICY IF EXISTS "Comment authors can update their comments" ON comments;
DROP POLICY IF EXISTS "Comment authors can delete their comments" ON comments;

-- =============================================================================
-- Create new policies
-- =============================================================================

-- SELECT: Anyone authenticated can view all comments
CREATE POLICY "Users can view all comments"
    ON comments FOR SELECT
    TO authenticated
    USING (true);

-- INSERT: Authenticated users can create comments (must be their own user_id)
CREATE POLICY "Users can create comments"
    ON comments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

-- UPDATE: Users can only update their own comments
CREATE POLICY "Users can update own comments"
    ON comments FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

-- DELETE: Users can delete their own comments OR admins can delete any
CREATE POLICY "Users can delete own comments"
    ON comments FOR DELETE
    TO authenticated
    USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    );

-- =============================================================================
-- SUCCESS!
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Comments RLS policies fixed!';
END $$;
