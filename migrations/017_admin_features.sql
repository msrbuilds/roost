-- Migration 017: Admin Features - User Banning & Announcements
-- Run this in Supabase SQL Editor
-- Created: 2026-01-30

-- =============================================================================
-- 1. USER BANNING SYSTEM
-- =============================================================================

-- Add ban-related columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- Index for efficient ban checks
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON profiles(is_banned) WHERE is_banned = true;
CREATE INDEX IF NOT EXISTS idx_profiles_ban_expires ON profiles(ban_expires_at) WHERE ban_expires_at IS NOT NULL;

-- Function to check if a user is currently banned
CREATE OR REPLACE FUNCTION is_user_banned(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    banned BOOLEAN;
    expires_at TIMESTAMPTZ;
BEGIN
    SELECT is_banned, ban_expires_at INTO banned, expires_at
    FROM profiles
    WHERE id = user_id;
    
    -- Not banned
    IF NOT COALESCE(banned, false) THEN
        RETURN false;
    END IF;
    
    -- Permanently banned (no expiry)
    IF expires_at IS NULL THEN
        RETURN true;
    END IF;
    
    -- Check if ban has expired
    IF expires_at <= NOW() THEN
        -- Auto-unban expired bans
        UPDATE profiles
        SET is_banned = false, ban_reason = NULL, ban_expires_at = NULL, banned_by = NULL, banned_at = NULL
        WHERE id = user_id;
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ban a user
CREATE OR REPLACE FUNCTION ban_user(
    target_user_id UUID,
    admin_user_id UUID,
    reason TEXT DEFAULT NULL,
    duration_interval INTERVAL DEFAULT NULL -- NULL = permanent
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Verify admin has permission
    IF NOT is_platform_admin(admin_user_id) THEN
        RAISE EXCEPTION 'Only platform admins can ban users';
    END IF;
    
    -- Cannot ban superadmins
    IF is_superadmin(target_user_id) THEN
        RAISE EXCEPTION 'Cannot ban superadmin users';
    END IF;
    
    -- Cannot ban yourself
    IF target_user_id = admin_user_id THEN
        RAISE EXCEPTION 'Cannot ban yourself';
    END IF;
    
    UPDATE profiles
    SET 
        is_banned = true,
        ban_reason = reason,
        ban_expires_at = CASE WHEN duration_interval IS NOT NULL THEN NOW() + duration_interval ELSE NULL END,
        banned_by = admin_user_id,
        banned_at = NOW()
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unban a user
CREATE OR REPLACE FUNCTION unban_user(
    target_user_id UUID,
    admin_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Verify admin has permission
    IF NOT is_platform_admin(admin_user_id) THEN
        RAISE EXCEPTION 'Only platform admins can unban users';
    END IF;
    
    UPDATE profiles
    SET 
        is_banned = false,
        ban_reason = NULL,
        ban_expires_at = NULL,
        banned_by = NULL,
        banned_at = NULL
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. ANNOUNCEMENTS TABLE
-- =============================================================================

-- Create announcement type enum
DO $$ BEGIN
    CREATE TYPE announcement_type AS ENUM ('info', 'warning', 'success', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create announcement scope enum
DO $$ BEGIN
    CREATE TYPE announcement_scope AS ENUM ('global', 'group');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type announcement_type DEFAULT 'info',
    scope announcement_scope DEFAULT 'global',
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    is_dismissible BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create announcement dismissals table (tracks which users dismissed which announcements)
CREATE TABLE IF NOT EXISTS announcement_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    dismissed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);

-- Indexes for announcements
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_announcements_scope ON announcements(scope);
CREATE INDEX IF NOT EXISTS idx_announcements_group ON announcements(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_dates ON announcements(starts_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_announcement_dismissals_user ON announcement_dismissals(user_id);

-- Enable RLS on announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. ANNOUNCEMENTS RLS POLICIES
-- =============================================================================

-- Everyone can view active announcements (filtered by scope in application)
CREATE POLICY "Active announcements are viewable by authenticated users"
    ON announcements FOR SELECT
    TO authenticated
    USING (
        is_active = true
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (
            scope = 'global'
            OR (scope = 'group' AND is_group_member(group_id, auth.uid()))
        )
    );

-- Platform admins can view all announcements
CREATE POLICY "Platform admins can view all announcements"
    ON announcements FOR SELECT
    TO authenticated
    USING (is_platform_admin(auth.uid()));

-- Only platform admins can create announcements
CREATE POLICY "Platform admins can create announcements"
    ON announcements FOR INSERT
    TO authenticated
    WITH CHECK (is_platform_admin(auth.uid()));

-- Only platform admins can update announcements
CREATE POLICY "Platform admins can update announcements"
    ON announcements FOR UPDATE
    TO authenticated
    USING (is_platform_admin(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()));

-- Only platform admins can delete announcements
CREATE POLICY "Platform admins can delete announcements"
    ON announcements FOR DELETE
    TO authenticated
    USING (is_platform_admin(auth.uid()));

-- Users can view their own dismissals
CREATE POLICY "Users can view their own dismissals"
    ON announcement_dismissals FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can dismiss announcements
CREATE POLICY "Users can dismiss announcements"
    ON announcement_dismissals FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 4. CATEGORY MANAGEMENT ENHANCEMENTS
-- =============================================================================

-- Add display order to categories if not exists
ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Index for category ordering
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);

-- =============================================================================
-- 5. HELPER FUNCTIONS FOR ADMIN DASHBOARD
-- =============================================================================

-- Get dashboard statistics
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_members', (SELECT COUNT(*) FROM profiles WHERE is_banned = false),
        'banned_members', (SELECT COUNT(*) FROM profiles WHERE is_banned = true),
        'new_members_30d', (SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '30 days' AND is_banned = false),
        'total_posts', (SELECT COUNT(*) FROM posts),
        'posts_30d', (SELECT COUNT(*) FROM posts WHERE created_at >= NOW() - INTERVAL '30 days'),
        'total_comments', (SELECT COUNT(*) FROM comments),
        'comments_30d', (SELECT COUNT(*) FROM comments WHERE created_at >= NOW() - INTERVAL '30 days'),
        'total_groups', (SELECT COUNT(*) FROM groups),
        'active_groups', (SELECT COUNT(DISTINCT group_id) FROM posts WHERE created_at >= NOW() - INTERVAL '7 days' AND group_id IS NOT NULL),
        'total_events', (SELECT COUNT(*) FROM events),
        'upcoming_events', (SELECT COUNT(*) FROM events WHERE start_time > NOW()),
        'active_announcements', (SELECT COUNT(*) FROM announcements WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW()))
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user growth data (last 30 days)
CREATE OR REPLACE FUNCTION get_user_growth(days INTEGER DEFAULT 30)
RETURNS TABLE(date DATE, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
    FROM profiles
    WHERE created_at >= NOW() - (days || ' days')::INTERVAL
    GROUP BY DATE(created_at)
    ORDER BY date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get activity stats (posts and comments per day)
CREATE OR REPLACE FUNCTION get_activity_stats(days INTEGER DEFAULT 30)
RETURNS TABLE(date DATE, posts BIGINT, comments BIGINT) AS $$
BEGIN
    RETURN QUERY
    WITH dates AS (
        SELECT generate_series(
            (NOW() - (days || ' days')::INTERVAL)::DATE,
            NOW()::DATE,
            '1 day'::INTERVAL
        )::DATE as date
    ),
    post_counts AS (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM posts
        WHERE created_at >= NOW() - (days || ' days')::INTERVAL
        GROUP BY DATE(created_at)
    ),
    comment_counts AS (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM comments
        WHERE created_at >= NOW() - (days || ' days')::INTERVAL
        GROUP BY DATE(created_at)
    )
    SELECT 
        d.date,
        COALESCE(p.count, 0) as posts,
        COALESCE(c.count, 0) as comments
    FROM dates d
    LEFT JOIN post_counts p ON p.date = d.date
    LEFT JOIN comment_counts c ON c.date = d.date
    ORDER BY d.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active announcements for a user
CREATE OR REPLACE FUNCTION get_active_announcements(user_id UUID, p_group_id UUID DEFAULT NULL)
RETURNS TABLE(
    id UUID,
    title VARCHAR(200),
    content TEXT,
    type announcement_type,
    scope announcement_scope,
    group_id UUID,
    is_dismissible BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.content,
        a.type,
        a.scope,
        a.group_id,
        a.is_dismissible,
        a.created_at
    FROM announcements a
    LEFT JOIN announcement_dismissals ad ON ad.announcement_id = a.id AND ad.user_id = $1
    WHERE a.is_active = true
        AND (a.starts_at IS NULL OR a.starts_at <= NOW())
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND ad.id IS NULL -- Not dismissed by this user
        AND (
            a.scope = 'global'
            OR (a.scope = 'group' AND a.group_id = p_group_id)
        )
    ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. UPDATE TIMESTAMP TRIGGER FOR ANNOUNCEMENTS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_announcement_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_announcement_timestamp ON announcements;
CREATE TRIGGER update_announcement_timestamp
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcement_timestamp();

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 017: Admin features created successfully!';
    RAISE NOTICE '🚫 User banning system with duration support';
    RAISE NOTICE '📢 Announcements system (global & group-specific)';
    RAISE NOTICE '📊 Admin dashboard statistics functions';
END $$;
