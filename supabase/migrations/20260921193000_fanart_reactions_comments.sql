-- Proposed migration, not yet applied to production.
-- Public reads never include private account UUIDs; deleting a gallery entry
-- cascades to both comments and votes, including artist withdrawals.
CREATE TABLE public.fanart_votes (
  submission_id uuid NOT NULL REFERENCES public.fanart_gallery(submission_id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1,1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(submission_id,user_id)
);
ALTER TABLE public.fanart_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fanart_votes FROM PUBLIC,anon,authenticated;
-- Do not grant SELECT(user_id): visitor identities are private.
GRANT SELECT(submission_id,value) ON public.fanart_votes TO anon,authenticated;
GRANT INSERT(submission_id,user_id,value), UPDATE(value), DELETE ON public.fanart_votes TO authenticated;
CREATE POLICY fanart_votes_public_counts ON public.fanart_votes
  FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY fanart_votes_owner_insert ON public.fanart_votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id=(SELECT auth.uid()) AND NOT public.is_banned());
CREATE POLICY fanart_votes_owner_update ON public.fanart_votes
  FOR UPDATE TO authenticated
  USING (user_id=(SELECT auth.uid()) AND NOT public.is_banned())
  WITH CHECK (user_id=(SELECT auth.uid()) AND NOT public.is_banned());
CREATE POLICY fanart_votes_owner_delete ON public.fanart_votes
  FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()));

CREATE FUNCTION community_private.guard_fanart_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() OR public.is_banned() OR
    NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id=NEW.user_id
      AND u.email_confirmed_at IS NOT NULL AND u.is_anonymous IS FALSE)
  THEN
    RAISE EXCEPTION 'Fanart vote not authorized' USING errcode='42501';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION community_private.guard_fanart_vote() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fanart_vote_auth BEFORE INSERT OR UPDATE ON public.fanart_votes
FOR EACH ROW EXECUTE FUNCTION community_private.guard_fanart_vote();

-- Grouped results only, executed with caller permissions and RLS.
CREATE VIEW public.fanart_vote_totals WITH (security_invoker=true) AS
SELECT submission_id,
  count(*) FILTER (WHERE value=1)::integer AS upvotes,
  count(*) FILTER (WHERE value=-1)::integer AS downvotes
FROM public.fanart_votes GROUP BY submission_id;
REVOKE ALL ON public.fanart_vote_totals FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.fanart_vote_totals TO anon,authenticated;

CREATE TABLE public.fanart_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.fanart_gallery(submission_id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 60),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fanart_comments_work_date ON public.fanart_comments(submission_id,created_at DESC);
CREATE INDEX fanart_comments_author_date ON public.fanart_comments(author_id,created_at DESC);
ALTER TABLE public.fanart_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fanart_comments FROM PUBLIC,anon,authenticated;
-- The author_id column is intentionally NOT public, even for authenticated readers.
GRANT SELECT(id,submission_id,display_name,body,created_at)
  ON public.fanart_comments TO anon,authenticated;
GRANT INSERT(submission_id,author_id,display_name,body)
  ON public.fanart_comments TO authenticated;
GRANT DELETE ON public.fanart_comments TO authenticated;
CREATE POLICY fanart_comments_public_read ON public.fanart_comments
  FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY fanart_comments_owner_insert ON public.fanart_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id=(SELECT auth.uid()) AND NOT public.is_banned());
CREATE POLICY fanart_comments_owner_or_moderator_delete ON public.fanart_comments
  FOR DELETE TO authenticated
  USING (author_id=(SELECT auth.uid()) OR (SELECT public.is_moderator()));

CREATE FUNCTION community_private.guard_fanart_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF NEW.author_id IS DISTINCT FROM auth.uid() OR public.is_banned() OR
    NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id=NEW.author_id
      AND u.email_confirmed_at IS NOT NULL AND u.is_anonymous IS FALSE)
  THEN
    RAISE EXCEPTION 'Fanart comment not authorized' USING errcode='42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.author_id::text,91827));
  IF (SELECT count(*) FROM public.fanart_comments AS c
      WHERE c.author_id=NEW.author_id AND c.created_at>now()-interval '1 hour')>=10
  THEN
    RAISE EXCEPTION 'Fanart comment hourly limit reached' USING errcode='22023';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION community_private.guard_fanart_comment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fanart_comment_limit BEFORE INSERT ON public.fanart_comments
FOR EACH ROW EXECUTE FUNCTION community_private.guard_fanart_comment();
