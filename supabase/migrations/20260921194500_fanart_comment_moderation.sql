-- Moderator removals of fanart comments are logged privately. Public viewers never
-- receive author account IDs or the moderation log.
CREATE TABLE community_private.fanart_comment_moderation_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comment_id bigint NOT NULL,
  submission_id uuid NOT NULL,
  author_id uuid NOT NULL,
  moderator_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE community_private.fanart_comment_moderation_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON community_private.fanart_comment_moderation_log FROM PUBLIC,anon,authenticated;
CREATE INDEX fanart_comment_moderation_log_created
  ON community_private.fanart_comment_moderation_log(created_at DESC);

CREATE FUNCTION public.moderate_fanart_comment(p_comment_id bigint,p_reason text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_comment public.fanart_comments%rowtype;
  v_reason text := nullif(btrim(p_reason),'');
BEGIN
  IF v_actor IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501';
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'Moderation reason required' USING errcode='22023';
  END IF;
  SELECT * INTO v_comment FROM public.fanart_comments
    WHERE id=p_comment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found' USING errcode='22023';
  END IF;
  INSERT INTO community_private.fanart_comment_moderation_log
    (comment_id,submission_id,author_id,moderator_id,reason)
  VALUES (v_comment.id,v_comment.submission_id,v_comment.author_id,v_actor,v_reason);
  DELETE FROM public.fanart_comments WHERE id=v_comment.id;
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.moderate_fanart_comment(bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_fanart_comment(bigint,text) TO authenticated;
