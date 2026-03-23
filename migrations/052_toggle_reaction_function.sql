-- Migration: Create toggle_reaction function for single-roundtrip reaction toggle
-- This replaces the 2-query pattern (check existing + insert/update/delete) with a single RPC call

-- Drop if exists (for re-running)
DROP FUNCTION IF EXISTS public.toggle_reaction(UUID, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.toggle_reaction(
    p_user_id UUID,
    p_reactable_type TEXT,
    p_reactable_id UUID,
    p_reaction_type TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    existing_id UUID;
    existing_type TEXT;
    v_reactable_type reactable_type;
    v_reaction_type reaction_type;
BEGIN
    -- Cast text params to enum types
    v_reactable_type := p_reactable_type::reactable_type;
    v_reaction_type := p_reaction_type::reaction_type;

    -- Check for existing reaction
    SELECT id, reaction_type::TEXT INTO existing_id, existing_type
    FROM reactions
    WHERE user_id = p_user_id
      AND reactable_type = v_reactable_type
      AND reactable_id = p_reactable_id;

    IF existing_id IS NOT NULL AND existing_type = p_reaction_type THEN
        -- Same reaction type: toggle off (remove)
        DELETE FROM reactions WHERE id = existing_id;
        RETURN json_build_object('added', false, 'reactionType', NULL);
    ELSIF existing_id IS NOT NULL THEN
        -- Different reaction type: update
        UPDATE reactions SET reaction_type = v_reaction_type WHERE id = existing_id;
        RETURN json_build_object('added', true, 'reactionType', p_reaction_type);
    ELSE
        -- No existing reaction: insert new
        INSERT INTO reactions (user_id, reactable_type, reactable_id, reaction_type)
        VALUES (p_user_id, v_reactable_type, p_reactable_id, v_reaction_type);
        RETURN json_build_object('added', true, 'reactionType', p_reaction_type);
    END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.toggle_reaction(UUID, TEXT, UUID, TEXT) TO authenticated;
