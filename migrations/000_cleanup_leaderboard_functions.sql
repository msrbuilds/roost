-- Cleanup Script: Remove All Existing Leaderboard Functions
-- Run this BEFORE migration 010 if you encounter "function name is not unique" errors
-- This will remove all versions of the leaderboard functions

-- 1. Drop all versions of calculate_user_points
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc 
        WHERE proname = 'calculate_user_points'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS calculate_user_points(' || r.argtypes || ') CASCADE';
        RAISE NOTICE 'Dropped function: calculate_user_points(%)' , r.argtypes;
    END LOOP;
END $$;

-- 2. Drop all versions of update_leaderboard_entry
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc 
        WHERE proname = 'update_leaderboard_entry'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS update_leaderboard_entry(' || r.argtypes || ') CASCADE';
        RAISE NOTICE 'Dropped function: update_leaderboard_entry(%)' , r.argtypes;
    END LOOP;
END $$;

-- 3. Drop all versions of award_points
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc 
        WHERE proname = 'award_points'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS award_points(' || r.argtypes || ') CASCADE';
        RAISE NOTICE 'Dropped function: award_points(%)' , r.argtypes;
    END LOOP;
END $$;

-- 4. Drop all versions of get_user_rank
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc 
        WHERE proname = 'get_user_rank'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS get_user_rank(' || r.argtypes || ') CASCADE';
        RAISE NOTICE 'Dropped function: get_user_rank(%)' , r.argtypes;
    END LOOP;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ All leaderboard functions cleaned up successfully!';
    RAISE NOTICE '📝 You can now run migration 010_leaderboard_functions.sql';
END $$;
