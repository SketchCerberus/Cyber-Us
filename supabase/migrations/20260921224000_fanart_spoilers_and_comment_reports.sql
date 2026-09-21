-- Expand the existing controlled tag vocabulary, keeping the eight-tag cap and approval-only copying.
-- Spoiler protection is a reader-facing visual warning; approved files remain public.
ALTER TABLE public.fanart_submissions DROP CONSTRAINT fanart_tags_allowed;
ALTER TABLE public.fanart_gallery DROP CONSTRAINT fanart_public_tags_allowed;
ALTER TABLE public.fanart_submissions ADD CONSTRAINT fanart_tags_allowed CHECK (
  cardinality(tags) <= 8 AND
  tags <@ ARRAY['Auará','Kaubi','Óete','Sistema','Trojan','Malware','OC','Ships','Crossover','Grupo','Swap','E se...','Fofo','Sério','Chibi','AU','Humor','Colaboração','WIP','Spoiler']::text[]
);
ALTER TABLE public.fanart_gallery ADD CONSTRAINT fanart_public_tags_allowed CHECK (
  cardinality(tags) <= 8 AND
  tags <@ ARRAY['Auará','Kaubi','Óete','Sistema','Trojan','Malware','OC','Ships','Crossover','Grupo','Swap','E se...','Fofo','Sério','Chibi','AU','Humor','Colaboração','WIP','Spoiler']::text[]
);

-- Reports are private; deletion of the corresponding comment cascades to its reports.
-- The existing separate comment moderation log independently records comment removals.
CREATE TABLE public.fanart_comment_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comment_id bigint NOT NULL REFERENCES public.fanart_comments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_reason text CHECK (resolution_reason IS NULL OR char_length(btrim(resolution_reason)) BETWEEN 3 AND 500),
  UNIQUE(comment_id,reporter_id)
);
CREATE INDEX fanart_reports_status_date ON public.fanart_comment_reports(status,created_at DESC);
CREATE INDEX fanart_reports_user_date ON public.fanart_comment_reports(reporter_id,created_at DESC);
ALTER TABLE public.fanart_comment_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fanart_comment_reports FROM PUBLIC,anon,authenticated;
-- Never grant SELECT on reporter_id or handled_by to visitors or ordinary members.
GRANT INSERT(comment_id,reason) ON public.fanart_comment_reports TO authenticated;
GRANT SELECT(id,comment_id,reason,status,created_at) ON public.fanart_comment_reports TO authenticated;
GRANT UPDATE(status,resolution_reason) ON public.fanart_comment_reports TO authenticated;
GRANT USAGE ON SEQUENCE public.fanart_comment_reports_id_seq TO authenticated;
CREATE POLICY fanart_report_staff_read ON public.fanart_comment_reports
  FOR SELECT TO authenticated USING ((SELECT public.is_moderator()));
CREATE POLICY fanart_report_user_insert ON public.fanart_comment_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()) AND status = 'open'
    AND handled_at IS NULL AND handled_by IS NULL AND resolution_reason IS NULL
    AND NOT public.is_banned());
CREATE POLICY fanart_report_staff_update ON public.fanart_comment_reports
  FOR UPDATE TO authenticated USING ((SELECT public.is_moderator()))
  WITH CHECK ((SELECT public.is_moderator()));

-- A private trigger verifies identity and rate limits without granting access to
-- comment author IDs or reporter records to other authenticated members.
CREATE FUNCTION community_private.guard_fanart_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_author uuid;
BEGIN
  IF NEW.reporter_id IS DISTINCT FROM auth.uid() OR public.is_banned() OR
    NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id=NEW.reporter_id
      AND u.email_confirmed_at IS NOT NULL AND u.is_anonymous IS FALSE) THEN
    RAISE EXCEPTION 'Report not authorized' USING errcode='42501';
  END IF;
  SELECT author_id INTO v_author FROM public.fanart_comments WHERE id=NEW.comment_id;
  IF NOT FOUND OR v_author=NEW.reporter_id THEN
    RAISE EXCEPTION 'Invalid report target' USING errcode='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.reporter_id::text,77116));
  IF (SELECT count(*) FROM public.fanart_comment_reports AS r
      WHERE r.reporter_id=NEW.reporter_id AND r.created_at>now()-interval '24 hours')>=20 THEN
    RAISE EXCEPTION 'Report daily limit reached' USING errcode='22023';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION community_private.guard_fanart_report() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fanart_report_guard BEFORE INSERT ON public.fanart_comment_reports
FOR EACH ROW EXECUTE FUNCTION community_private.guard_fanart_report();

-- Moderators must explain dismissals. The server, not the client, stamps the actor
-- and time. Client writes cannot modify either audit field or reported content.
CREATE FUNCTION community_private.audit_fanart_report_dismissal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501';
  END IF;
  IF OLD.status IS DISTINCT FROM 'open' OR NEW.status IS DISTINCT FROM 'dismissed' OR
    NEW.resolution_reason IS NULL OR char_length(btrim(NEW.resolution_reason)) NOT BETWEEN 3 AND 500 OR
    NEW.comment_id IS DISTINCT FROM OLD.comment_id OR NEW.reporter_id IS DISTINCT FROM OLD.reporter_id OR
    NEW.reason IS DISTINCT FROM OLD.reason OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A dismissal reason of 3-500 characters is required' USING errcode='22023';
  END IF;
  NEW.handled_at=now();
  NEW.handled_by=auth.uid();
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION community_private.audit_fanart_report_dismissal() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fanart_report_audit BEFORE UPDATE ON public.fanart_comment_reports
FOR EACH ROW EXECUTE FUNCTION community_private.audit_fanart_report_dismissal();
