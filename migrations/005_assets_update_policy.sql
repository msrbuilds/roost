-- Migration 005: Add missing RLS policies for Assets
-- Added: 2026-01-20

-- Assets need to be updatable by the uploader so they can be linked to posts/messages after upload
CREATE POLICY "Uploaders can update their own assets"
    ON assets FOR UPDATE
    USING (auth.uid() = uploaded_by)
    WITH CHECK (auth.uid() = uploaded_by);

-- Ensure users can see assets associated with posts they can see
-- Note: Migration 002 already had a basic 'true' policy for SELECT, 
-- but we can make it more explicit or keep it simple for now if it works.
-- The current policy in 002 is:
-- CREATE POLICY "Assets are viewable based on context" ON assets FOR SELECT USING (true);
