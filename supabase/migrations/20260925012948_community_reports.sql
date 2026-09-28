-- Additive reporting API. Legacy fanart reports remain writable by cached clients.
-- Evidence and decisions survive content deletion; reporter identities never leave this schema.
CREATE TABLE community_private.content_reports (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 kind text NOT NULL CHECK(kind IN ('episode_comment','fanart_comment','fanart')),
 target_id text NOT NULL,
 reporter_id uuid NOT NULL,
 target_author uuid NOT NULL,
 reason text NOT NULL CHECK(char_length(reason) BETWEEN 3 AND 500),
 evidence text NOT NULL,
 context text NOT NULL,
 legacy_id bigint UNIQUE,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','dismissed','resolved')),
 created_at timestamptz NOT NULL DEFAULT now(),
 handled_at timestamptz,
 handled_by uuid,
 resolution_reason text,
 UNIQUE(kind,target_id,reporter_id),
 CHECK((status='open' AND handled_at IS NULL AND handled_by IS NULL AND resolution_reason IS NULL)
   OR (status<>'open' AND handled_at IS NOT NULL AND handled_by IS NOT NULL AND char_length(resolution_reason) BETWEEN 3 AND 500))
);
ALTER TABLE community_private.content_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON community_private.content_reports FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE community_private.content_reports_id_seq FROM PUBLIC,anon,authenticated;
CREATE INDEX content_reports_quota ON community_private.content_reports(reporter_id,created_at);
CREATE INDEX content_reports_queue ON community_private.content_reports(status,id);

INSERT INTO community_private.content_reports(kind,target_id,reporter_id,target_author,reason,evidence,context,legacy_id,status,created_at,handled_at,handled_by,resolution_reason)
 SELECT 'fanart_comment',r.comment_id::text,r.reporter_id,c.author_id,r.reason,c.body,c.submission_id::text,r.id,r.status,r.created_at,r.handled_at,r.handled_by,r.resolution_reason
 FROM public.fanart_comment_reports r JOIN public.fanart_comments c ON c.id=r.comment_id;

CREATE FUNCTION community_private.check_report_account() RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR community_private.is_banned() OR NOT EXISTS
 (SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND u.is_anonymous IS FALSE) THEN
  RAISE EXCEPTION 'Report not authorized' USING errcode='42501';
 END IF;
 -- Shared with the legacy endpoint: concurrent submissions cannot bypass the limit.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,77116));
 IF (SELECT count(*) FROM community_private.content_reports WHERE reporter_id=auth.uid() AND created_at>now()-interval '24 hours')>=20 THEN
  RAISE EXCEPTION 'Report daily limit reached' USING errcode='P0001';
 END IF;
END $$;
REVOKE ALL ON FUNCTION community_private.check_report_account() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION community_private.guard_fanart_report() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_author uuid;
BEGIN
 PERFORM community_private.check_report_account();
 IF NEW.reporter_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Report not authorized' USING errcode='42501'; END IF;
 SELECT c.author_id INTO v_author FROM public.fanart_comments c JOIN public.fanart_gallery g ON g.submission_id=c.submission_id
 WHERE c.id=NEW.comment_id AND c.deleted_at IS NULL AND NOT c.deleted_by_author;
 IF NOT FOUND OR v_author=auth.uid() THEN RAISE EXCEPTION 'Invalid report target' USING errcode='22023'; END IF;
 RETURN NEW;
END $$;

-- Mirror old clients and old dismissal actions without ever exposing the private ledger.
CREATE FUNCTION community_private.mirror_fanart_report() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO community_private.content_reports(kind,target_id,reporter_id,target_author,reason,evidence,context,legacy_id,created_at)
   SELECT 'fanart_comment',NEW.comment_id::text,NEW.reporter_id,c.author_id,NEW.reason,c.body,c.submission_id::text,NEW.id,NEW.created_at
   FROM public.fanart_comments c WHERE c.id=NEW.comment_id;
 ELSE
  UPDATE community_private.content_reports SET status=NEW.status,handled_at=NEW.handled_at,handled_by=NEW.handled_by,resolution_reason=NEW.resolution_reason
   WHERE legacy_id=NEW.id AND status='open';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION community_private.mirror_fanart_report() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER mirror_community_report AFTER INSERT OR UPDATE ON public.fanart_comment_reports
 FOR EACH ROW EXECUTE FUNCTION community_private.mirror_fanart_report();

CREATE FUNCTION community_private.submit_content_report(p_kind text,p_target_id text,p_reason text,p_details text) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_author uuid;v_evidence text;v_context text;v_target text;v_reason text;
BEGIN
 PERFORM community_private.check_report_account();
 IF p_reason IS NULL OR p_reason NOT IN ('spam','harassment','spoiler','copyright','inappropriate','other')
 OR char_length(coalesce(p_details,''))>300 THEN RAISE EXCEPTION 'Invalid report reason' USING errcode='22023'; END IF;
 v_reason:=p_reason||CASE WHEN btrim(coalesce(p_details,''))<>'' THEN ': '||btrim(p_details) ELSE '' END;
 IF p_kind='fanart_comment' THEN
  INSERT INTO public.fanart_comment_reports(comment_id,reason) VALUES(p_target_id::bigint,v_reason);
  RETURN true;
 ELSIF p_kind='episode_comment' THEN
  v_target:=p_target_id::uuid::text;
  SELECT c.author_id,c.body,c.episode_slug INTO v_author,v_evidence,v_context
   FROM public.comments c JOIN public.episodes e ON e.slug=c.episode_slug
   WHERE c.id=v_target::uuid AND c.status='visible' AND NOT c.deleted_by_author AND c.deleted_at IS NULL AND e.community_enabled;
 ELSIF p_kind='fanart' THEN
  v_target:=p_target_id::uuid::text;
  SELECT s.user_id,g.title||' — '||g.artist_name,g.image_path INTO v_author,v_evidence,v_context
   FROM public.fanart_gallery g JOIN public.fanart_submissions s ON s.id=g.submission_id WHERE g.submission_id=v_target::uuid;
 ELSE RAISE EXCEPTION 'Invalid report target' USING errcode='22023';
 END IF;
 IF v_author IS NULL OR v_author=auth.uid() THEN RAISE EXCEPTION 'Invalid report target' USING errcode='22023'; END IF;
 INSERT INTO community_private.content_reports(kind,target_id,reporter_id,target_author,reason,evidence,context)
 VALUES(p_kind,v_target,auth.uid(),v_author,v_reason,v_evidence,v_context);
 RETURN true;
END $$;
CREATE FUNCTION public.submit_content_report(p_kind text,p_target_id text,p_reason text,p_details text DEFAULT '') RETURNS boolean
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT community_private.submit_content_report(p_kind,p_target_id,p_reason,p_details) $$;
REVOKE ALL ON FUNCTION community_private.submit_content_report(text,text,text,text),public.submit_content_report(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION community_private.submit_content_report(text,text,text,text),public.submit_content_report(text,text,text,text) TO authenticated;

CREATE FUNCTION community_private.list_content_reports(p_before bigint,p_status text) RETURNS TABLE(
 id bigint,kind text,target_id text,reason text,evidence text,context text,status text,created_at timestamptz,resolution_reason text,handled_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF p_status NOT IN ('open','dismissed','resolved') OR p_status IS NULL THEN RAISE EXCEPTION 'Invalid status' USING errcode='22023'; END IF;
 RETURN QUERY SELECT r.id,r.kind,r.target_id,r.reason,r.evidence,r.context,r.status,r.created_at,r.resolution_reason,r.handled_at
 FROM community_private.content_reports r WHERE r.status=p_status AND (p_before IS NULL OR r.id<p_before)
 AND public.moderator_can_handle(r.target_author) ORDER BY r.id DESC LIMIT 50;
END $$;
CREATE FUNCTION public.list_content_reports(p_before bigint DEFAULT NULL,p_status text DEFAULT 'open') RETURNS TABLE(
 id bigint,kind text,target_id text,reason text,evidence text,context text,status text,created_at timestamptz,resolution_reason text,handled_at timestamptz)
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM community_private.list_content_reports(p_before,p_status) $$;
REVOKE ALL ON FUNCTION community_private.list_content_reports(bigint,text),public.list_content_reports(bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION community_private.list_content_reports(bigint,text),public.list_content_reports(bigint,text) TO authenticated;

CREATE FUNCTION community_private.resolve_content_report(p_id bigint,p_action text,p_reason text) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r community_private.content_reports%rowtype;f public.fanart_submissions%rowtype;v_path text;v_changed boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('dismiss','remove') OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN
  RAISE EXCEPTION 'Reason required' USING errcode='22023'; END IF;
 -- Cached legacy clients lock the legacy row first, so use that same order.
 PERFORM 1 FROM public.fanart_comment_reports WHERE id=(SELECT legacy_id FROM community_private.content_reports WHERE id=p_id) FOR UPDATE;
 SELECT * INTO r FROM community_private.content_reports WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT public.moderator_can_handle(r.target_author) THEN RAISE EXCEPTION 'Creator handles staff reports' USING errcode='42501'; END IF;
 IF r.status<>'open' THEN RETURN false; END IF;
 IF p_action='remove' THEN
  IF r.kind='episode_comment' THEN
   v_changed:=community_private.moderate_comment(r.target_id::uuid,'removed',p_reason);
  ELSIF r.kind='fanart_comment' THEN
   v_changed:=public.moderate_fanart_comment(r.target_id::bigint,p_reason);
  ELSE
   SELECT * INTO f FROM public.fanart_submissions WHERE id=r.target_id::uuid FOR UPDATE;
   IF FOUND AND EXISTS(SELECT 1 FROM public.fanart_gallery WHERE submission_id=f.id) THEN
    v_path:=f.id::text||'.'||f.extension;
    IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='fanart-trash' AND name=v_path) THEN
     RAISE EXCEPTION 'Copy artwork to private trash first' USING errcode='22023'; END IF;
    DELETE FROM public.fanart_gallery WHERE submission_id=f.id;
    UPDATE public.fanart_submissions SET status='rejected',trash_previous_status='approved',trash_bucket='fanart-trash',trash_path=v_path WHERE id=f.id;
    INSERT INTO community_private.fanart_moderation_log(submission_id,submitter_id,moderator_id,previous_status,decision,reason)
     VALUES(f.id,f.user_id,auth.uid(),f.status,'rejected',btrim(p_reason));
   END IF;
  END IF;
 END IF;
 -- Keep cached moderation clients and existing retention jobs consistent.
 IF r.legacy_id IS NOT NULL THEN
  UPDATE public.fanart_comment_reports SET status='dismissed',resolution_reason=btrim(p_reason) WHERE id=r.legacy_id AND status='open';
 END IF;
 UPDATE community_private.content_reports SET status=CASE p_action WHEN 'dismiss' THEN 'dismissed' ELSE 'resolved' END,
  handled_at=now(),handled_by=auth.uid(),resolution_reason=btrim(p_reason) WHERE id=r.id;
 RETURN true;
END $$;
CREATE FUNCTION public.resolve_content_report(p_id bigint,p_action text,p_reason text) RETURNS boolean
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT community_private.resolve_content_report(p_id,p_action,p_reason) $$;
REVOKE ALL ON FUNCTION community_private.resolve_content_report(bigint,text,text),public.resolve_content_report(bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION community_private.resolve_content_report(bigint,text,text),public.resolve_content_report(bigint,text,text) TO authenticated;
