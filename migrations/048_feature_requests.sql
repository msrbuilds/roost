-- =============================================================================
-- Migration 048: Feature Requests & Bug Reporting System
-- =============================================================================
--
-- Adds a Feature Roadmap / Bug Report board where users can submit requests,
-- upvote them, and track progress through Kanban-style status columns.
--
-- Tables: feature_requests, feature_request_comments
-- Voting: Reuses existing `reactions` table with reactable_type = 'feature_request'
-- =============================================================================

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

CREATE TYPE feature_request_status AS ENUM (
    'under_review',
    'planned',
    'in_progress',
    'released',
    'declined',
    'duplicate'
);

CREATE TYPE feature_request_type AS ENUM (
    'feature_request',
    'bug_report',
    'improvement'
);

-- Extend existing reactable_type enum for voting
ALTER TYPE reactable_type ADD VALUE IF NOT EXISTS 'feature_request';

-- =============================================================================
-- 2. FEATURE_REQUESTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type feature_request_type NOT NULL DEFAULT 'feature_request',
    status feature_request_status NOT NULL DEFAULT 'under_review',

    -- Author
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Admin fields
    admin_response TEXT,
    is_pinned BOOLEAN DEFAULT false,

    -- Cached counts
    vote_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fr_title_length CHECK (char_length(title) >= 5 AND char_length(title) <= 255),
    CONSTRAINT fr_description_length CHECK (char_length(description) >= 20 AND char_length(description) <= 10000)
);

-- Indexes
CREATE INDEX idx_feature_requests_status ON feature_requests(status);
CREATE INDEX idx_feature_requests_type ON feature_requests(type);
CREATE INDEX idx_feature_requests_author ON feature_requests(author_id);
CREATE INDEX idx_feature_requests_vote_count ON feature_requests(vote_count DESC);
CREATE INDEX idx_feature_requests_created_at ON feature_requests(created_at DESC);
CREATE INDEX idx_feature_requests_pinned ON feature_requests(is_pinned) WHERE is_pinned = true;

-- =============================================================================
-- 3. FEATURE_REQUEST_COMMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS feature_request_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES feature_request_comments(id) ON DELETE CASCADE,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fr_comment_length CHECK (char_length(content) >= 1 AND char_length(content) <= 5000)
);

CREATE INDEX idx_fr_comments_request ON feature_request_comments(feature_request_id);
CREATE INDEX idx_fr_comments_author ON feature_request_comments(author_id);
CREATE INDEX idx_fr_comments_parent ON feature_request_comments(parent_comment_id);
CREATE INDEX idx_fr_comments_created ON feature_request_comments(created_at);

-- =============================================================================
-- 4. TRIGGERS
-- =============================================================================

-- 4a. Vote count trigger (on reactions table)
CREATE OR REPLACE FUNCTION update_feature_request_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.reactable_type = 'feature_request' THEN
        UPDATE public.feature_requests
        SET vote_count = vote_count + 1, updated_at = NOW()
        WHERE id = NEW.reactable_id;
    ELSIF TG_OP = 'DELETE' AND OLD.reactable_type = 'feature_request' THEN
        UPDATE public.feature_requests
        SET vote_count = GREATEST(0, vote_count - 1), updated_at = NOW()
        WHERE id = OLD.reactable_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_feature_request_vote_count
AFTER INSERT OR DELETE ON reactions
FOR EACH ROW
EXECUTE FUNCTION update_feature_request_vote_count();

-- 4b. Comment count trigger
CREATE OR REPLACE FUNCTION update_feature_request_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_request_id := OLD.feature_request_id;
    ELSE
        v_request_id := NEW.feature_request_id;
    END IF;

    UPDATE public.feature_request_comments AS dummy SET id = id WHERE FALSE;

    UPDATE public.feature_requests
    SET comment_count = (
        SELECT COUNT(*) FROM public.feature_request_comments
        WHERE feature_request_id = v_request_id
    ), updated_at = NOW()
    WHERE id = v_request_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_feature_request_comment_count
AFTER INSERT OR DELETE ON feature_request_comments
FOR EACH ROW
EXECUTE FUNCTION update_feature_request_comment_count();

-- 4c. Updated_at trigger on feature_requests
CREATE TRIGGER trg_feature_request_updated_at
BEFORE UPDATE ON feature_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4d. Updated_at trigger on feature_request_comments
CREATE TRIGGER trg_fr_comment_updated_at
BEFORE UPDATE ON feature_request_comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_request_comments ENABLE ROW LEVEL SECURITY;

-- FEATURE_REQUESTS POLICIES --

-- Authenticated users can view all feature requests
CREATE POLICY "Authenticated users can view feature requests"
ON feature_requests FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Authenticated users can create feature requests
CREATE POLICY "Authenticated users can create feature requests"
ON feature_requests FOR INSERT
WITH CHECK (auth.uid() = author_id);

-- Authors can update their own feature requests
CREATE POLICY "Authors can update own feature requests"
ON feature_requests FOR UPDATE
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

-- Admins/mods can update any feature request (status, pin, admin_response)
CREATE POLICY "Admins can update any feature request"
ON feature_requests FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('moderator', 'admin', 'superadmin')
    )
);

-- Authors can delete their own feature requests
CREATE POLICY "Authors can delete own feature requests"
ON feature_requests FOR DELETE
USING (auth.uid() = author_id);

-- Admins can delete any feature request
CREATE POLICY "Admins can delete any feature request"
ON feature_requests FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
);

-- FEATURE_REQUEST_COMMENTS POLICIES --

-- Authenticated users can view comments
CREATE POLICY "Authenticated users can view fr comments"
ON feature_request_comments FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create fr comments"
ON feature_request_comments FOR INSERT
WITH CHECK (auth.uid() = author_id);

-- Authors can update their own comments
CREATE POLICY "Authors can update own fr comments"
ON feature_request_comments FOR UPDATE
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

-- Authors can delete their own comments
CREATE POLICY "Authors can delete own fr comments"
ON feature_request_comments FOR DELETE
USING (auth.uid() = author_id);

-- Admins can delete any comment
CREATE POLICY "Admins can delete any fr comment"
ON feature_request_comments FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
);

-- =============================================================================
-- 6. VERIFICATION
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 048: feature_requests table created';
    RAISE NOTICE 'Migration 048: feature_request_comments table created';
    RAISE NOTICE 'Migration 048: Vote count trigger on reactions created';
    RAISE NOTICE 'Migration 048: Comment count trigger created';
    RAISE NOTICE 'Migration 048: RLS policies applied';
END;
$$;
