-- Migration: Fix table-level permissions for feature_requests tables
-- The authenticated role needs explicit GRANT to access these tables

-- Grant table access to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON feature_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON feature_request_comments TO authenticated;

-- Allow anon role to read (if needed for public pages)
GRANT SELECT ON feature_requests TO anon;
GRANT SELECT ON feature_request_comments TO anon;
