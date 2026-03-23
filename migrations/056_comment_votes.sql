-- Migration 056: Comment Votes (Upvote/Downvote)

CREATE TABLE IF NOT EXISTS comment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, comment_id)
);

-- Indexes
CREATE INDEX idx_comment_votes_comment ON comment_votes(comment_id);
CREATE INDEX idx_comment_votes_user ON comment_votes(user_id);

-- Enable RLS
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Comment votes are viewable by everyone"
    ON comment_votes FOR SELECT
    USING (true);

CREATE POLICY "Users can add comment votes"
    ON comment_votes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their comment votes"
    ON comment_votes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their comment votes"
    ON comment_votes FOR DELETE
    USING (auth.uid() = user_id);

-- Toggle vote function (single roundtrip, similar to toggle_reaction)
CREATE OR REPLACE FUNCTION public.toggle_comment_vote(
    p_user_id UUID,
    p_comment_id UUID,
    p_vote_type TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    existing_id UUID;
    existing_type TEXT;
BEGIN
    SELECT id, vote_type INTO existing_id, existing_type
    FROM comment_votes
    WHERE user_id = p_user_id AND comment_id = p_comment_id;

    IF existing_id IS NOT NULL AND existing_type = p_vote_type THEN
        -- Same vote: remove it
        DELETE FROM comment_votes WHERE id = existing_id;
        RETURN json_build_object('action', 'removed', 'voteType', NULL);
    ELSIF existing_id IS NOT NULL THEN
        -- Different vote: switch
        UPDATE comment_votes SET vote_type = p_vote_type WHERE id = existing_id;
        RETURN json_build_object('action', 'switched', 'voteType', p_vote_type);
    ELSE
        -- New vote
        INSERT INTO comment_votes (user_id, comment_id, vote_type)
        VALUES (p_user_id, p_comment_id, p_vote_type);
        RETURN json_build_object('action', 'added', 'voteType', p_vote_type);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_comment_vote(UUID, UUID, TEXT) TO authenticated;
