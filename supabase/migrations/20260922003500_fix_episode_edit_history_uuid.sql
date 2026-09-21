-- Defensive correction of UUID matching in the moderator-only history RPC.
CREATE OR REPLACE FUNCTION public.moderation_comment_edit_history(p_kind text,p_id text)
RETURNS TABLE(prior_text text,edited_at timestamptz,editor_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501';
  END IF;
  IF p_kind='episode' AND p_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN
    RETURN QUERY SELECT h.previous_body,h.edited_at,h.editor_id
      FROM community_private.comment_edit_history h
      WHERE h.kind='episode' AND h.episode_comment_id=p_id::uuid ORDER BY h.edited_at DESC LIMIT 50;
  ELSIF p_kind='fanart' AND p_id ~ '^[0-9]{1,19}$' THEN
    RETURN QUERY SELECT h.previous_body,h.edited_at,h.editor_id
      FROM community_private.comment_edit_history h
      WHERE h.kind='fanart' AND h.fanart_comment_id=p_id::bigint ORDER BY h.edited_at DESC LIMIT 50;
  ELSE
    RAISE EXCEPTION 'Invalid comment identifier' USING errcode='22023';
  END IF;
END;$fn$;
REVOKE ALL ON FUNCTION public.moderation_comment_edit_history(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.moderation_comment_edit_history(text,text) TO authenticated;
