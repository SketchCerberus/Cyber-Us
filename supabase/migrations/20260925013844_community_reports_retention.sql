-- Keep evidence awaiting a staff decision out of the existing permanent-purge jobs.
CREATE INDEX content_reports_open_target ON community_private.content_reports(kind,target_id) WHERE status='open';
CREATE INDEX content_reports_open_context ON community_private.content_reports(context) WHERE status='open' AND kind='fanart_comment';
CREATE FUNCTION community_private.artwork_has_open_reports(p_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM community_private.content_reports r WHERE r.status='open' AND
 ((r.kind='fanart' AND r.target_id=p_id::text) OR (r.kind='fanart_comment' AND r.context=p_id::text)))
$$;
REVOKE ALL ON FUNCTION community_private.artwork_has_open_reports(uuid) FROM PUBLIC,anon,authenticated;
-- Secret-key permissions are enforced with REVOKE/GRANT rather than legacy JWT settings.
CREATE OR REPLACE FUNCTION public.trash_due_fanarts() RETURNS TABLE(id uuid,image_path text,extension text,trash_bucket text,trash_path text,trash_previous_status text,expires_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN QUERY SELECT f.id,f.image_path,f.extension,f.trash_bucket,f.trash_path,f.trash_previous_status,f.purge_after FROM public.fanart_submissions f WHERE f.status='rejected' AND f.purge_after<=now() AND NOT community_private.artwork_has_open_reports(f.id) AND NOT EXISTS(SELECT 1 FROM public.fanart_comment_reports r JOIN public.fanart_comments c ON c.id=r.comment_id WHERE c.submission_id=f.id AND r.status='open') ORDER BY f.purge_after,f.id LIMIT 30;
END $$;
REVOKE ALL ON FUNCTION public.trash_due_fanarts() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trash_due_fanarts() TO service_role;
CREATE OR REPLACE FUNCTION public.trash_finalize_fanart(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.fanart_submissions%rowtype;
BEGIN
 SELECT * INTO f FROM public.fanart_submissions WHERE id=p_id AND status='rejected' AND purge_after<=now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF community_private.artwork_has_open_reports(f.id) THEN RETURN false; END IF;
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

CREATE OR REPLACE FUNCTION community_private.purge_expired_comments() RETURNS TABLE(episode_deleted integer,fanart_deleted integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_ep uuid[];v_fan bigint[];
BEGIN
 SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO v_ep FROM (SELECT c.id FROM public.comments c WHERE c.deleted_at IS NOT NULL AND c.purge_after<=now() AND NOT EXISTS(SELECT 1 FROM community_private.content_reports r WHERE r.kind='episode_comment' AND r.target_id=c.id::text AND r.status='open') ORDER BY c.purge_after,c.id LIMIT 100) due;
 DELETE FROM community_private.comment_edit_history WHERE kind='episode' AND episode_comment_id=ANY(v_ep);
 DELETE FROM community_private.moderation_log WHERE comment_id=ANY(v_ep);
 DELETE FROM public.comments WHERE id=ANY(v_ep) AND deleted_at IS NOT NULL AND purge_after<=now();
 GET DIAGNOSTICS episode_deleted=ROW_COUNT;
 SELECT coalesce(array_agg(id),ARRAY[]::bigint[]) INTO v_fan FROM (SELECT fc.id FROM public.fanart_comments fc WHERE fc.deleted_at IS NOT NULL AND fc.purge_after<=now() AND NOT EXISTS(SELECT 1 FROM community_private.content_reports r WHERE r.kind='fanart_comment' AND r.target_id=fc.id::text AND r.status='open') AND NOT EXISTS(SELECT 1 FROM public.fanart_comment_reports r WHERE r.comment_id=fc.id AND r.status='open') ORDER BY fc.purge_after,fc.id LIMIT 100) due;
 DELETE FROM community_private.comment_edit_history WHERE kind='fanart' AND fanart_comment_id=ANY(v_fan);
 DELETE FROM community_private.fanart_comment_moderation_log WHERE comment_id=ANY(v_fan);
 DELETE FROM public.fanart_comments WHERE id=ANY(v_fan) AND deleted_at IS NOT NULL AND purge_after<=now();
 GET DIAGNOSTICS fanart_deleted=ROW_COUNT;
 RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION community_private.purge_expired_comments() FROM PUBLIC,anon,authenticated;

