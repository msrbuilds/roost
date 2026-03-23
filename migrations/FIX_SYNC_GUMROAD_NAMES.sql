-- Sync Gumroad user names from auth.users to profiles table
-- Run this in Supabase SQL Editor

-- =============================================================================
-- STEP 1: Preview what will be updated
-- =============================================================================
-- First, let's see which users have names in auth metadata but not in profiles
SELECT
    p.id,
    p.display_name as current_display_name,
    p.username as current_username,
    u.raw_user_meta_data->>'full_name' as auth_full_name,
    u.raw_user_meta_data->>'name' as auth_name,
    u.raw_user_meta_data->>'display_name' as auth_display_name,
    u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.display_name = 'New User'
   OR p.display_name IS NULL
   OR p.display_name = '';

-- =============================================================================
-- STEP 2: Update display_name from auth metadata
-- =============================================================================
-- Priority: full_name > name > display_name > email prefix
UPDATE profiles p
SET
    display_name = COALESCE(
        NULLIF(u.raw_user_meta_data->>'full_name', ''),
        NULLIF(u.raw_user_meta_data->>'name', ''),
        NULLIF(u.raw_user_meta_data->>'display_name', ''),
        SPLIT_PART(u.email, '@', 1)
    ),
    updated_at = NOW()
FROM auth.users u
WHERE u.id = p.id
  AND (p.display_name = 'New User' OR p.display_name IS NULL OR p.display_name = '');

-- =============================================================================
-- STEP 3: Generate better usernames from display names
-- =============================================================================
-- Update usernames that are auto-generated (user_xxxxx pattern)
-- Truncate to 20 chars max (leaving room for _xxxx suffix = 25 total)
UPDATE profiles p
SET
    username = SUBSTRING(
        LOWER(
            TRIM(BOTH '_' FROM
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        COALESCE(
                            NULLIF(u.raw_user_meta_data->>'full_name', ''),
                            NULLIF(u.raw_user_meta_data->>'name', ''),
                            SPLIT_PART(u.email, '@', 1)
                        ),
                        '[^a-zA-Z0-9]', '_', 'g'  -- Replace non-alphanumeric with underscore
                    ),
                    '_+', '_', 'g'  -- Collapse multiple underscores
                )
            )
        ),
        1, 20  -- Truncate to 20 chars max
    ) || '_' || SUBSTRING(p.id::text, 1, 4),  -- Add unique suffix (total max ~25 chars)
    updated_at = NOW()
FROM auth.users u
WHERE u.id = p.id
  AND p.username LIKE 'user_%'
  AND LENGTH(p.username) = 13;  -- Only update auto-generated usernames (user_xxxxxxxx)

-- =============================================================================
-- STEP 4: Verify the updates
-- =============================================================================
SELECT
    p.id,
    p.display_name,
    p.username,
    u.email,
    u.raw_user_meta_data->>'full_name' as auth_full_name
FROM profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC
LIMIT 20;

-- =============================================================================
-- SUCCESS!
-- =============================================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM profiles
    WHERE display_name != 'New User' AND display_name IS NOT NULL;

    RAISE NOTICE '✅ Synced display names for % users', updated_count;
END $$;
