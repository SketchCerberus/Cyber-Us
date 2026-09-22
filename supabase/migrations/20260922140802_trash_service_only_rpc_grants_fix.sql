-- Secret-key permissions are enforced with REVOKE/GRANT rather than legacy JWT settings.
CREATE OR REPLACE FUNCTION public.trash_due_fanarts() RETURNS TABLE(id uuid,image_path text,extension text,trash_bucket text,trash_path text,trash_previous_status text,expires_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN QUERY SELECT f.id,f.image_path,f.extension,f.trash_bucket,f.trash_path,f.trash_previous_status,f.purge_after FROM public.fanart_submissions f WHERE f.status='rejected' AND f.purge_after<=now() AND NOT EXISTS(SELECT 1 FROM public.fanart_comment_reports r JOIN public.fanart_comments c ON c.id=r.comment_id WHERE c.submission_id=f.id AND r.status='open') ORDER BY f.purge_after,f.id LIMIT 30;
END $$;
REVOKE ALL ON FUNCTION public.trash_due_fanarts() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trash_due_fanarts() TO service_role;
CREATE OR REPLACE FUNCTION public.trash_finalize_fanart(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.fanart_submissions%rowtype;
BEGIN
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
