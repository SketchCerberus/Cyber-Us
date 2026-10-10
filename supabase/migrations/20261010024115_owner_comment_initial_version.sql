CREATE OR REPLACE FUNCTION community_private.edit_own_comment(p_kind text,p_id text,p_body text,p_expected timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_body text:=btrim(p_body); v_current timestamptz; v_previous text; v_stamp timestamptz;
BEGIN
 IF v_uid IS NULL OR community_private.is_banned() OR NOT EXISTS(
 SELECT 1 FROM auth.users WHERE id=v_uid AND email_confirmed_at IS NOT NULL AND is_anonymous IS FALSE
 ) THEN RAISE EXCEPTION 'Verified account required' USING errcode='42501'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('episode','fanart') OR v_body IS NULL OR char_length(v_body)<1 OR char_length(v_body)>(CASE WHEN p_kind='episode' THEN 2000 ELSE 1000 END)
 THEN RAISE EXCEPTION 'Invalid comment' USING errcode='22023'; END IF;
 IF p_kind='episode' THEN
 SELECT coalesce(c.updated_at,c.created_at),c.body INTO v_current,v_previous FROM public.comments c
 WHERE c.id=p_id::uuid AND c.author_id=v_uid AND c.status='visible' AND NOT c.deleted_by_author AND c.deleted_at IS NULL
 AND EXISTS(SELECT 1 FROM public.episodes e WHERE e.slug=c.episode_slug AND e.community_enabled) FOR UPDATE;
 ELSE
 SELECT coalesce(c.updated_at,c.created_at),c.body INTO v_current,v_previous FROM public.fanart_comments c
 WHERE c.id=p_id::bigint AND c.author_id=v_uid AND c.deleted_at IS NULL AND NOT c.deleted_by_author
 AND EXISTS(SELECT 1 FROM public.fanart_gallery g WHERE g.submission_id=c.submission_id) FOR UPDATE;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Comment unavailable' USING errcode='42501'; END IF;
 IF p_expected IS NULL OR v_current IS DISTINCT FROM p_expected THEN
 RAISE EXCEPTION 'Comment changed; reload before editing' USING errcode='40001'; END IF;
 IF v_previous=v_body THEN RETURN v_current; END IF;
 -- Serialize edits for this author; private history is also the rate-limit log.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('comment-edit-'||v_uid::text,0));
 IF (SELECT count(*) FROM community_private.comment_edit_history WHERE editor_id=v_uid AND edited_at>now()-interval '1 hour')>=30
 THEN RAISE EXCEPTION 'Edit limit reached' USING errcode='P0001'; END IF;
 IF p_kind='episode' THEN
 UPDATE public.comments SET body=v_body,edited_at=clock_timestamp() WHERE id=p_id::uuid RETURNING updated_at INTO v_stamp;
 ELSE
 UPDATE public.fanart_comments SET body=v_body,edited_at=clock_timestamp() WHERE id=p_id::bigint RETURNING updated_at INTO v_stamp;
 END IF;
 RETURN v_stamp;
END $$;
