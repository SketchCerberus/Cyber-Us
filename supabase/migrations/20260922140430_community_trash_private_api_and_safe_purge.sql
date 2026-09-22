-- Staff-visible trash and service-only purge. The browser never receives private storage credentials.
CREATE OR REPLACE FUNCTION public.moderation_trash() RETURNS TABLE(kind text,item_id text,title text,preview text,removed_at timestamptz,expires_at timestamptz,restorable boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid();
BEGIN
 IF v_actor IS NULL OR community_private.staff_role(v_actor) IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 RETURN QUERY
 SELECT 'episode_comment'::text,c.id::text,c.episode_slug,CASE WHEN c.deleted_by_author THEN '[removed by author]' ELSE left(c.body,180) END,c.deleted_at,c.purge_after,NOT c.deleted_by_author
 FROM public.comments c WHERE c.deleted_at IS NOT NULL AND public.moderator_can_handle(c.author_id)
 UNION ALL
 SELECT 'fanart_comment',fc.id::text,fs.title,left(fc.body,180),fc.deleted_at,fc.purge_after,NOT fc.deleted_by_author AND fs.status='approved'
 FROM public.fanart_comments fc JOIN public.fanart_submissions fs ON fs.id=fc.submission_id
 WHERE fc.deleted_at IS NOT NULL AND public.moderator_can_handle(fc.author_id)
 UNION ALL
 SELECT 'fanart',f.id::text,f.title,CASE WHEN f.trash_previous_status IS NULL THEN 'Legacy file already removed' ELSE f.artist_name END,f.deleted_at,f.purge_after,f.trash_bucket IS NOT NULL AND f.trash_previous_status IS NOT NULL
 FROM public.fanart_submissions f WHERE f.status='rejected' AND f.deleted_at IS NOT NULL AND public.moderator_can_handle(f.user_id)
 ORDER BY removed_at DESC LIMIT 150;
END $$;
REVOKE ALL ON FUNCTION public.moderation_trash() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.moderation_trash() TO authenticated;
CREATE OR REPLACE FUNCTION public.restore_trash_comment(p_kind text,p_id text,p_reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid();v_author uuid;v_episode_id uuid;v_fanart_id bigint;
BEGIN
 IF v_actor IS NULL OR community_private.staff_role(v_actor) IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Reason required' USING errcode='22023'; END IF;
 IF p_kind='episode_comment' THEN
  v_episode_id:=p_id::uuid;
  SELECT author_id INTO v_author FROM public.comments WHERE id=v_episode_id AND deleted_at IS NOT NULL AND status='removed' AND NOT deleted_by_author FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT public.moderator_can_handle(v_author) THEN RAISE EXCEPTION 'Creator only for staff' USING errcode='42501'; END IF;
  RETURN community_private.moderate_comment(v_episode_id,'visible',btrim(p_reason));
 ELSIF p_kind='fanart_comment' THEN
  v_fanart_id:=p_id::bigint;
  SELECT fc.author_id INTO v_author FROM public.fanart_comments fc JOIN public.fanart_gallery g ON g.submission_id=fc.submission_id WHERE fc.id=v_fanart_id AND fc.deleted_at IS NOT NULL AND NOT fc.deleted_by_author FOR UPDATE OF fc;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT public.moderator_can_handle(v_author) THEN RAISE EXCEPTION 'Creator only for staff' USING errcode='42501'; END IF;
  UPDATE public.fanart_comments SET deleted_at=NULL,purge_after=NULL WHERE id=v_fanart_id;
  INSERT INTO community_private.fanart_comment_moderation_log(comment_id,submission_id,author_id,moderator_id,reason)
   SELECT id,submission_id,author_id,v_actor,'RESTORED: '||btrim(p_reason) FROM public.fanart_comments WHERE id=v_fanart_id;
  RETURN true;
 END IF;
 RAISE EXCEPTION 'Unsupported item' USING errcode='22023';
END $$;
REVOKE ALL ON FUNCTION public.restore_trash_comment(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.restore_trash_comment(text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.restore_trash_fanart(p_id uuid,p_reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.fanart_submissions%rowtype;v_public_path text;
BEGIN
 IF auth.uid() IS NULL OR community_private.staff_role(auth.uid()) IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Reason required' USING errcode='22023'; END IF;
 SELECT * INTO f FROM public.fanart_submissions WHERE id=p_id AND status='rejected' AND deleted_at IS NOT NULL AND purge_after>now() AND trash_bucket IS NOT NULL AND trash_previous_status IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT public.moderator_can_handle(f.user_id) THEN RAISE EXCEPTION 'Creator only for staff' USING errcode='42501'; END IF;
 IF f.trash_previous_status='approved' THEN
  v_public_path:=f.id::text||'.'||f.extension;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='fanart-public' AND name=v_public_path) THEN RAISE EXCEPTION 'Restore image to public bucket first' USING errcode='22023'; END IF;
  UPDATE public.fanart_submissions SET status='approved' WHERE id=f.id;
  INSERT INTO public.fanart_gallery(submission_id,title,artist_name,artist_link,region,accent,image_path)
   VALUES(f.id,f.title,f.artist_name,f.artist_link,CASE WHEN f.show_region THEN nullif(btrim(f.region),'') END,f.accent,v_public_path);
 ELSE
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='fanart-pending' AND name=f.image_path) THEN RAISE EXCEPTION 'Private image missing' USING errcode='22023'; END IF;
  UPDATE public.fanart_submissions SET status='pending' WHERE id=f.id;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.restore_trash_fanart(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.restore_trash_fanart(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION community_private.purge_expired_comments() RETURNS TABLE(episode_deleted integer,fanart_deleted integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_ep uuid[];v_fan bigint[];
BEGIN
 SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO v_ep FROM (SELECT id FROM public.comments WHERE deleted_at IS NOT NULL AND purge_after<=now() ORDER BY purge_after,id LIMIT 100) due;
 DELETE FROM community_private.comment_edit_history WHERE kind='episode' AND episode_comment_id=ANY(v_ep);
 DELETE FROM community_private.moderation_log WHERE comment_id=ANY(v_ep);
 DELETE FROM public.comments WHERE id=ANY(v_ep) AND deleted_at IS NOT NULL AND purge_after<=now();
 GET DIAGNOSTICS episode_deleted=ROW_COUNT;
 SELECT coalesce(array_agg(id),ARRAY[]::bigint[]) INTO v_fan FROM (SELECT fc.id FROM public.fanart_comments fc WHERE fc.deleted_at IS NOT NULL AND fc.purge_after<=now() AND NOT EXISTS(SELECT 1 FROM public.fanart_comment_reports r WHERE r.comment_id=fc.id AND r.status='open') ORDER BY fc.purge_after,fc.id LIMIT 100) due;
 DELETE FROM community_private.comment_edit_history WHERE kind='fanart' AND fanart_comment_id=ANY(v_fan);
 DELETE FROM community_private.fanart_comment_moderation_log WHERE comment_id=ANY(v_fan);
 DELETE FROM public.fanart_comments WHERE id=ANY(v_fan) AND deleted_at IS NOT NULL AND purge_after<=now();
 GET DIAGNOSTICS fanart_deleted=ROW_COUNT;
 RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION community_private.purge_expired_comments() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.trash_finalize_fanart(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.fanart_submissions%rowtype;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role only' USING errcode='42501'; END IF;
 SELECT * INTO f FROM public.fanart_submissions WHERE id=p_id AND status='rejected' AND purge_after<=now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE (bucket_id='fanart-pending' AND name=f.image_path) OR (bucket_id='fanart-public' AND name=f.id::text||'.'||f.extension) OR (bucket_id='fanart-trash' AND name=f.id::text||'.'||f.extension)) THEN RAISE EXCEPTION 'Image still present; use Storage API first' USING errcode='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.fanart_comment_reports r JOIN public.fanart_comments fc ON fc.id=r.comment_id WHERE fc.submission_id=f.id AND r.status='open') THEN RETURN false; END IF;
 DELETE FROM community_private.comment_edit_history WHERE kind='fanart' AND fanart_comment_id IN(SELECT id FROM public.fanart_comments WHERE submission_id=f.id);
 DELETE FROM community_private.fanart_comment_moderation_log WHERE submission_id=f.id;
 DELETE FROM community_private.fanart_moderation_log WHERE submission_id=f.id;
 DELETE FROM community_private.fanart_feature_history WHERE submission_id=f.id;
 DELETE FROM public.fanart_submissions WHERE id=f.id AND status='rejected' AND purge_after<=now();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.trash_finalize_fanart(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trash_finalize_fanart(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.trash_authorize_cron(p_token text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT current_setting('request.jwt.claim.role',true)='service_role' AND EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='cyberus_trash_cron_token' AND decrypted_secret=p_token);
$$;
REVOKE ALL ON FUNCTION public.trash_authorize_cron(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trash_authorize_cron(text) TO service_role;
CREATE OR REPLACE FUNCTION public.trash_due_fanarts() RETURNS TABLE(id uuid,image_path text,extension text,trash_bucket text,trash_path text,trash_previous_status text,expires_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role only' USING errcode='42501'; END IF;
 RETURN QUERY SELECT f.id,f.image_path,f.extension,f.trash_bucket,f.trash_path,f.trash_previous_status,f.purge_after FROM public.fanart_submissions f WHERE f.status='rejected' AND f.purge_after<=now() AND NOT EXISTS(SELECT 1 FROM public.fanart_comment_reports r JOIN public.fanart_comments c ON c.id=r.comment_id WHERE c.submission_id=f.id AND r.status='open') ORDER BY f.purge_after,f.id LIMIT 30;
END $$;
REVOKE ALL ON FUNCTION public.trash_due_fanarts() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trash_due_fanarts() TO service_role;
