-- A private audit feed for episode comments, replies and fanart comments.
-- No ordinary account may read edit history, including its own entries.
CREATE FUNCTION public.moderation_recent_comment_edits(p_limit integer DEFAULT 30)
RETURNS TABLE(kind text,comment_id text,prior_text text,edited_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501';
  END IF;
  RETURN QUERY SELECT h.kind,coalesce(h.episode_comment_id::text,h.fanart_comment_id::text),
    h.previous_body,h.edited_at FROM community_private.comment_edit_history AS h
    ORDER BY h.edited_at DESC LIMIT least(greatest(coalesce(p_limit,30),1),50);
END;$fn$;
REVOKE ALL ON FUNCTION public.moderation_recent_comment_edits(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.moderation_recent_comment_edits(integer) TO authenticated;
