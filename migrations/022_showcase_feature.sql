-- Migration 022: Showcase Feature
-- ProductHunt-style showcase section with voting, reviews, and admin moderation
-- Created: 2026-02-01

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

-- Showcase submission status
CREATE TYPE showcase_status AS ENUM ('pending', 'approved', 'rejected', 'featured');

-- Showcase categories (fixed list)
CREATE TYPE showcase_category AS ENUM (
    'web_app',
    'mobile_app',
    'saas',
    'tool',
    'api',
    'website',
    'game',
    'extension',
    'other'
);

-- Add 'showcase' to existing reactable_type enum for voting
ALTER TYPE reactable_type ADD VALUE IF NOT EXISTS 'showcase';

-- =============================================================================
-- 2. SHOWCASES TABLE (Main submissions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS showcases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    tagline VARCHAR(150) NOT NULL, -- Short description like ProductHunt
    description TEXT NOT NULL, -- Full rich text description
    url VARCHAR(500) NOT NULL, -- Project URL
    thumbnail_url VARCHAR(500), -- Main featured image
    category showcase_category NOT NULL,
    tech_stack TEXT[] DEFAULT '{}', -- Array of technologies used

    -- Author/Maker info
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Status & Moderation
    status showcase_status DEFAULT 'pending',
    moderation_notes TEXT, -- Admin feedback
    moderated_by UUID REFERENCES profiles(id),
    moderated_at TIMESTAMPTZ,

    -- Launch tracking
    launch_date DATE, -- When the showcase was "launched" (approved date)
    is_featured BOOLEAN DEFAULT false,
    featured_at TIMESTAMPTZ,

    -- Cached counts (for performance)
    vote_count INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    average_rating NUMERIC(2,1) DEFAULT 0, -- Average star rating (1-5)

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT showcase_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 255),
    CONSTRAINT showcase_tagline_length CHECK (char_length(tagline) >= 10 AND char_length(tagline) <= 150),
    CONSTRAINT showcase_description_length CHECK (char_length(description) >= 50 AND char_length(description) <= 10000),
    CONSTRAINT showcase_url_format CHECK (url ~ '^https?://')
);

-- Indexes for common queries
CREATE INDEX idx_showcases_status ON showcases(status);
CREATE INDEX idx_showcases_author ON showcases(author_id);
CREATE INDEX idx_showcases_category ON showcases(category);
CREATE INDEX idx_showcases_launch_date ON showcases(launch_date DESC NULLS LAST);
CREATE INDEX idx_showcases_vote_count ON showcases(vote_count DESC);
CREATE INDEX idx_showcases_featured ON showcases(is_featured) WHERE is_featured = true;
CREATE INDEX idx_showcases_created_at ON showcases(created_at DESC);

-- =============================================================================
-- 3. SHOWCASE_IMAGES TABLE (Multiple screenshots per showcase)
-- =============================================================================
CREATE TABLE IF NOT EXISTS showcase_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    showcase_id UUID NOT NULL REFERENCES showcases(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    display_order INTEGER DEFAULT 0,
    caption VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_showcase_images_showcase ON showcase_images(showcase_id);
CREATE INDEX idx_showcase_images_order ON showcase_images(showcase_id, display_order);

-- =============================================================================
-- 4. SHOWCASE_TAGS TABLE (Tag definitions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS showcase_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#6B7280', -- Hex color
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT showcase_tag_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 50),
    CONSTRAINT showcase_tag_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_showcase_tags_slug ON showcase_tags(slug);

-- =============================================================================
-- 5. SHOWCASE_TAG_RELATIONS TABLE (Many-to-many junction)
-- =============================================================================
CREATE TABLE IF NOT EXISTS showcase_tag_relations (
    showcase_id UUID NOT NULL REFERENCES showcases(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES showcase_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (showcase_id, tag_id)
);

CREATE INDEX idx_showcase_tag_relations_tag ON showcase_tag_relations(tag_id);

-- =============================================================================
-- 6. SHOWCASE_REVIEWS TABLE (Reviews with star ratings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS showcase_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    showcase_id UUID NOT NULL REFERENCES showcases(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating

    -- Maker can reply to reviews
    maker_reply TEXT,
    maker_replied_at TIMESTAMPTZ,

    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One review per user per showcase
    UNIQUE(showcase_id, author_id),

    -- Constraints
    CONSTRAINT showcase_review_content_length CHECK (char_length(content) >= 10 AND char_length(content) <= 2000)
);

CREATE INDEX idx_showcase_reviews_showcase ON showcase_reviews(showcase_id);
CREATE INDEX idx_showcase_reviews_author ON showcase_reviews(author_id);
CREATE INDEX idx_showcase_reviews_rating ON showcase_reviews(rating);
CREATE INDEX idx_showcase_reviews_created_at ON showcase_reviews(created_at DESC);

-- =============================================================================
-- 7. DATABASE TRIGGERS
-- =============================================================================

-- Trigger: Update vote_count on showcases when reactions change
CREATE OR REPLACE FUNCTION update_showcase_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.reactable_type = 'showcase' THEN
        UPDATE showcases
        SET vote_count = vote_count + 1, updated_at = NOW()
        WHERE id = NEW.reactable_id;
    ELSIF TG_OP = 'DELETE' AND OLD.reactable_type = 'showcase' THEN
        UPDATE showcases
        SET vote_count = GREATEST(0, vote_count - 1), updated_at = NOW()
        WHERE id = OLD.reactable_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_showcase_vote_count
AFTER INSERT OR DELETE ON reactions
FOR EACH ROW
EXECUTE FUNCTION update_showcase_vote_count();

-- Trigger: Update review_count and average_rating on showcases when reviews change
CREATE OR REPLACE FUNCTION update_showcase_review_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_showcase_id UUID;
    v_avg_rating NUMERIC(2,1);
    v_review_count INTEGER;
BEGIN
    -- Determine which showcase was affected
    IF TG_OP = 'DELETE' THEN
        v_showcase_id := OLD.showcase_id;
    ELSE
        v_showcase_id := NEW.showcase_id;
    END IF;

    -- Calculate new stats
    SELECT
        COUNT(*)::INTEGER,
        COALESCE(ROUND(AVG(rating)::NUMERIC, 1), 0)
    INTO v_review_count, v_avg_rating
    FROM showcase_reviews
    WHERE showcase_id = v_showcase_id;

    -- Update the showcase
    UPDATE showcases
    SET
        review_count = v_review_count,
        average_rating = v_avg_rating,
        updated_at = NOW()
    WHERE id = v_showcase_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_showcase_review_stats
AFTER INSERT OR UPDATE OR DELETE ON showcase_reviews
FOR EACH ROW
EXECUTE FUNCTION update_showcase_review_stats();

-- Trigger: Award points when showcase is approved
CREATE OR REPLACE FUNCTION award_showcase_approval_points()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when status changes to 'approved' or 'featured'
    IF NEW.status IN ('approved', 'featured') AND OLD.status = 'pending' THEN
        -- Award 10 points for approval
        INSERT INTO point_activities (
            user_id,
            action_type,
            points,
            description,
            reference_id,
            group_id
        ) VALUES (
            NEW.author_id,
            'event_created', -- Reusing existing type, or you could add 'showcase_approved' to the enum
            10,
            'Showcase approved: ' || NEW.title,
            NEW.id,
            NULL
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_showcase_approval_points
AFTER UPDATE ON showcases
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION award_showcase_approval_points();

-- =============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all showcase tables
ALTER TABLE showcases ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_reviews ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is platform admin/moderator
-- (Reuses existing is_platform_admin function if available)

-- SHOWCASES POLICIES --

-- Anyone can view approved/featured showcases
CREATE POLICY "Anyone can view approved showcases"
ON showcases FOR SELECT
USING (status IN ('approved', 'featured'));

-- Authors can view their own showcases (any status)
CREATE POLICY "Authors can view own showcases"
ON showcases FOR SELECT
USING (auth.uid() = author_id);

-- Admins/moderators can view all showcases
CREATE POLICY "Admins can view all showcases"
ON showcases FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('moderator', 'admin', 'superadmin')
    )
);

-- Authenticated users can create showcases
CREATE POLICY "Authenticated users can create showcases"
ON showcases FOR INSERT
WITH CHECK (auth.uid() = author_id);

-- Authors can update their pending showcases
CREATE POLICY "Authors can update pending showcases"
ON showcases FOR UPDATE
USING (auth.uid() = author_id AND status = 'pending')
WITH CHECK (auth.uid() = author_id AND status = 'pending');

-- Admins/moderators can update any showcase (for moderation)
CREATE POLICY "Admins can update any showcase"
ON showcases FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('moderator', 'admin', 'superadmin')
    )
);

-- Authors can delete their pending showcases
CREATE POLICY "Authors can delete pending showcases"
ON showcases FOR DELETE
USING (auth.uid() = author_id AND status = 'pending');

-- Admins can delete any showcase
CREATE POLICY "Admins can delete any showcase"
ON showcases FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
);

-- SHOWCASE_IMAGES POLICIES --

-- Anyone can view images of visible showcases
CREATE POLICY "View images of visible showcases"
ON showcase_images FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM showcases
        WHERE id = showcase_images.showcase_id
        AND (
            status IN ('approved', 'featured')
            OR author_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid()
                AND role IN ('moderator', 'admin', 'superadmin')
            )
        )
    )
);

-- Authors can manage their showcase images
CREATE POLICY "Authors can insert showcase images"
ON showcase_images FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM showcases
        WHERE id = showcase_images.showcase_id
        AND author_id = auth.uid()
    )
);

CREATE POLICY "Authors can update showcase images"
ON showcase_images FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM showcases
        WHERE id = showcase_images.showcase_id
        AND author_id = auth.uid()
    )
);

CREATE POLICY "Authors can delete showcase images"
ON showcase_images FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM showcases
        WHERE id = showcase_images.showcase_id
        AND author_id = auth.uid()
    )
);

-- SHOWCASE_TAGS POLICIES --

-- Anyone can view tags
CREATE POLICY "Anyone can view tags"
ON showcase_tags FOR SELECT
USING (true);

-- Only admins can manage tags
CREATE POLICY "Admins can insert tags"
ON showcase_tags FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
);

CREATE POLICY "Admins can update tags"
ON showcase_tags FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
);

CREATE POLICY "Admins can delete tags"
ON showcase_tags FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
);

-- SHOWCASE_TAG_RELATIONS POLICIES --

-- Anyone can view tag relations
CREATE POLICY "Anyone can view tag relations"
ON showcase_tag_relations FOR SELECT
USING (true);

-- Authors can manage tags on their showcases
CREATE POLICY "Authors can add tags to showcases"
ON showcase_tag_relations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM showcases
        WHERE id = showcase_tag_relations.showcase_id
        AND author_id = auth.uid()
    )
);

CREATE POLICY "Authors can remove tags from showcases"
ON showcase_tag_relations FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM showcases
        WHERE id = showcase_tag_relations.showcase_id
        AND author_id = auth.uid()
    )
);

-- SHOWCASE_REVIEWS POLICIES --

-- Anyone can view reviews on approved showcases
CREATE POLICY "Anyone can view reviews"
ON showcase_reviews FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM showcases
        WHERE id = showcase_reviews.showcase_id
        AND status IN ('approved', 'featured')
    )
);

-- Authenticated users can create reviews (one per showcase)
CREATE POLICY "Users can create reviews"
ON showcase_reviews FOR INSERT
WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
        SELECT 1 FROM showcases
        WHERE id = showcase_reviews.showcase_id
        AND status IN ('approved', 'featured')
    )
);

-- Authors can update their own reviews
CREATE POLICY "Authors can update their reviews"
ON showcase_reviews FOR UPDATE
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

-- Showcase makers can add replies to reviews
CREATE POLICY "Makers can reply to reviews"
ON showcase_reviews FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM showcases
        WHERE id = showcase_reviews.showcase_id
        AND author_id = auth.uid()
    )
);

-- Authors and admins can delete reviews
CREATE POLICY "Authors can delete their reviews"
ON showcase_reviews FOR DELETE
USING (auth.uid() = author_id);

CREATE POLICY "Admins can delete any review"
ON showcase_reviews FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
);

-- =============================================================================
-- 9. SEED DATA: Default Tags
-- =============================================================================
INSERT INTO showcase_tags (name, slug, color) VALUES
    ('Open Source', 'open-source', '#22C55E'),
    ('AI/ML', 'ai-ml', '#8B5CF6'),
    ('No-Code', 'no-code', '#F59E0B'),
    ('Developer Tool', 'developer-tool', '#3B82F6'),
    ('Productivity', 'productivity', '#EC4899'),
    ('Design', 'design', '#14B8A6'),
    ('Marketing', 'marketing', '#F97316'),
    ('Finance', 'finance', '#06B6D4'),
    ('Education', 'education', '#84CC16'),
    ('Social', 'social', '#EF4444')
ON CONFLICT (slug) DO NOTHING;
