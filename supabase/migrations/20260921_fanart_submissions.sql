-- Fanarts: private files, owner-bound submissions and moderator-only publication.
-- Deploy database first, then the fanart-submit Edge Function, then the web UI.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('cyber-fanarts','cyber-fanarts',false,1572864,ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.fanarts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  image_path text NOT NULL UNIQUE CHECK (image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 100),
  artist text NOT NULL CHECK (char_length(btrim(artist)) BETWEEN 2 AND 60),
  region text CHECK (region IS NULL OR char_length(btrim(region)) BETWEEN 2 AND 80),
  show_region boolean NOT NULL DEFAULT false,
  artist_url text CHECK (artist_url IS NULL OR (char_length(artist_url)<=240 AND artist_url ~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$')),
  accent text NOT NULL DEFAULT 'random' CHECK (accent IN ('random','blue','red','green')),
  tags text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK (cardinality(tags) <= 8),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','removed','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  review_note text,
  CONSTRAINT fanarts_region_consent CHECK (NOT show_region OR region IS NOT NULL),
  CONSTRAINT fanarts_review_state CHECK (
    (status='pending' AND reviewed_at IS NULL AND reviewed_by IS NULL AND review_note IS NULL)
    OR (status<>'pending')
  )
);
CREATE INDEX fanarts_public_idx ON public.fanarts(reviewed_at DESC,id DESC) WHERE status='approved';
CREATE INDEX fanarts_queue_idx ON public.fanarts(created_at,id) WHERE status='pending';
CREATE INDEX fanarts_owner_idx ON public.fanarts(owner_id,created_at DESC);
ALTER TABLE public.fanarts ENABLE ROW LEVEL SECURITY;

-- Private schema helper avoids exposing the bans table to public API roles.
CREATE FUNCTION community_private.fanart_author_banned(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
  SELECT EXISTS(SELECT 1 FROM community_private.bans b WHERE b.user_id=p_user
    AND b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>now()));
$fn$;
REVOKE ALL ON FUNCTION community_private.fanart_author_banned(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION community_private.fanart_author_banned(uuid) TO anon,authenticated;

CREATE POLICY fanarts_public_read ON public.fanarts FOR SELECT TO anon,authenticated
  USING (status='approved' AND NOT community_private.fanart_author_banned(owner_id));
CREATE POLICY fanarts_owner_read ON public.fanarts FOR SELECT TO authenticated
  USING (owner_id=(SELECT auth.uid()));
CREATE POLICY fanarts_staff_read ON public.fanarts FOR SELECT TO authenticated
  USING ((SELECT community_private.is_moderator()));
REVOKE ALL ON TABLE public.fanarts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.fanarts TO anon,authenticated;

-- Storage is private. No INSERT/UPDATE/DELETE policy exists for browsers: uploads
-- go only through the authenticated Edge Function, which validates actual WebP bytes.
CREATE POLICY fanarts_public_object_read ON storage.objects FOR SELECT TO anon,authenticated
  USING (bucket_id='cyber-fanarts' AND EXISTS (
    SELECT 1 FROM public.fanarts f WHERE f.image_path=name AND f.status='approved'
      AND NOT community_private.fanart_author_banned(f.owner_id)
  ));
CREATE POLICY fanarts_owner_object_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='cyber-fanarts' AND EXISTS (
    SELECT 1 FROM public.fanarts f WHERE f.image_path=name AND f.owner_id=(SELECT auth.uid())
  ));
CREATE POLICY fanarts_staff_object_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='cyber-fanarts' AND (SELECT community_private.is_moderator()));

-- Read-only quota check before receiving a validated file; final insert checks again.
CREATE FUNCTION public.fanart_submission_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
  SELECT auth.uid() IS NOT NULL AND NOT community_private.is_banned()
    AND (SELECT count(*) FROM public.fanarts WHERE owner_id=auth.uid() AND status='pending')<3
    AND (SELECT count(*) FROM public.fanarts WHERE owner_id=auth.uid()
         AND created_at>now()-interval '24 hours')<5;
$fn$;

-- The Edge Function first uploads a validated file, then invokes this as the user.
-- If this fails, the Edge Function removes that file. The user cannot write rows directly.
CREATE FUNCTION public.submit_fanart(p_image_path text,p_title text,p_artist text,
  p_region text,p_show_region boolean,p_artist_url text,p_accent text,p_tags text[],p_consent boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid(); v_id uuid; v_region text:=nullif(btrim(p_region),'');
  v_url text:=nullif(btrim(p_artist_url),'');
BEGIN
  IF v_user IS NULL OR p_consent IS DISTINCT FROM true OR community_private.is_banned() THEN
    RAISE EXCEPTION 'Sign in and confirm permission; banned accounts cannot submit' USING errcode='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fanart-submit-'||v_user::text,0));
  IF (SELECT count(*) FROM public.fanarts WHERE owner_id=v_user AND status='pending')>=3
    OR (SELECT count(*) FROM public.fanarts WHERE owner_id=v_user AND created_at>now()-interval '24 hours')>=5 THEN
    RAISE EXCEPTION 'Submission limit reached' USING errcode='22023'; END IF;
  IF p_image_path IS NULL OR p_image_path !~ ('^'||v_user::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
    OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='cyber-fanarts'
      AND o.name=p_image_path AND o.created_at>now()-interval '10 minutes'
      AND (o.metadata->>'mimetype')='image/webp'
      AND (o.metadata->>'size')::bigint<=1572864) THEN
    RAISE EXCEPTION 'Validated artwork file not found' USING errcode='22023'; END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 2 AND 100
    OR p_artist IS NULL OR char_length(btrim(p_artist)) NOT BETWEEN 2 AND 60
    OR (v_region IS NOT NULL AND char_length(v_region) NOT BETWEEN 2 AND 80)
    OR (p_show_region IS DISTINCT FROM false AND p_show_region IS DISTINCT FROM true)
    OR (p_show_region AND v_region IS NULL)
    OR (v_url IS NOT NULL AND (char_length(v_url)>240 OR v_url !~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$'))
    OR p_accent IS NULL OR p_accent NOT IN ('random','blue','red','green')
    OR p_tags IS NULL OR cardinality(p_tags)>8
    OR EXISTS (SELECT 1 FROM unnest(p_tags) tag WHERE tag IS NULL OR char_length(btrim(tag)) NOT BETWEEN 1 AND 32)
    THEN RAISE EXCEPTION 'Invalid fanart metadata' USING errcode='22023'; END IF;
  INSERT INTO public.fanarts(owner_id,image_path,title,artist,region,show_region,artist_url,accent,tags)
    VALUES(v_user,p_image_path,btrim(p_title),btrim(p_artist),v_region,p_show_region,v_url,p_accent,p_tags)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

CREATE FUNCTION public.my_fanarts()
RETURNS SETOF public.fanarts LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING errcode='42501'; END IF;
  RETURN QUERY SELECT * FROM public.fanarts WHERE owner_id=auth.uid()
    ORDER BY created_at DESC,id DESC LIMIT 50;
END;
$fn$;

CREATE FUNCTION public.withdraw_fanart(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid(); v_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required' USING errcode='42501'; END IF;
  SELECT status INTO v_status FROM public.fanarts WHERE id=p_id AND owner_id=v_user FOR UPDATE;
  IF NOT FOUND OR v_status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'Artwork cannot be withdrawn' USING errcode='42501'; END IF;
  UPDATE public.fanarts SET status='withdrawn' WHERE id=p_id;
  RETURN true;
END;
$fn$;

CREATE TABLE community_private.fanart_moderation_log(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fanart_id uuid NOT NULL REFERENCES public.fanarts(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('approve','reject','remove','ban_author')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE community_private.fanart_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.moderation_fanart_queue(p_status text DEFAULT 'pending',p_offset integer DEFAULT 0)
RETURNS SETOF public.fanarts LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501'; END IF;
  IF p_status NOT IN ('pending','approved','rejected','removed','withdrawn')
     OR p_offset IS NULL OR p_offset<0 OR p_offset>1000 THEN
    RAISE EXCEPTION 'Invalid query' USING errcode='22023'; END IF;
  RETURN QUERY SELECT * FROM public.fanarts WHERE status=p_status
    ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET p_offset;
END;
$fn$;

CREATE FUNCTION public.moderate_fanart(p_id uuid,p_action text,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_actor uuid:=auth.uid(); v_status text; v_owner uuid;
BEGIN
  IF v_actor IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501'; END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 500
    OR p_action NOT IN ('approve','reject','remove') THEN
    RAISE EXCEPTION 'Invalid moderation action' USING errcode='22023'; END IF;
  SELECT status,owner_id INTO v_status,v_owner FROM public.fanarts WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR (p_action IN ('approve','reject') AND v_status<>'pending')
    OR (p_action='remove' AND v_status<>'approved') THEN
    RAISE EXCEPTION 'Artwork status changed; refresh' USING errcode='22023'; END IF;
  IF p_action='approve' AND community_private.fanart_author_banned(v_owner) THEN
    RAISE EXCEPTION 'Cannot approve artwork from a banned account' USING errcode='42501'; END IF;
  UPDATE public.fanarts SET status=CASE p_action WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected' ELSE 'removed' END,
    reviewed_at=now(),reviewed_by=v_actor,review_note=btrim(p_reason) WHERE id=p_id;
  INSERT INTO community_private.fanart_moderation_log(fanart_id,actor_id,action,reason)
    VALUES(p_id,v_actor,p_action,btrim(p_reason));
  RETURN true;
END;
$fn$;

-- Reuse original ban_member authorization, active-ban replacement and general audit.
-- The fanart ID remains in a private audit table rather than exposed to the member.
CREATE FUNCTION public.ban_fanart_author(p_id uuid,p_reason text,p_expires_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_actor uuid:=auth.uid(); v_owner uuid; v_ban uuid;
BEGIN
  IF v_actor IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501'; END IF;
  SELECT owner_id INTO v_owner FROM public.fanarts WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Artwork not found' USING errcode='22023'; END IF;
  v_ban:=community_private.ban_member(v_owner,p_reason,p_expires_at);
  UPDATE community_private.bans SET category='fanart_violation' WHERE id=v_ban;
  INSERT INTO community_private.fanart_moderation_log(fanart_id,actor_id,action,reason)
    VALUES(p_id,v_actor,'ban_author',btrim(p_reason));
  RETURN v_ban;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fanart_submission_allowed(),public.submit_fanart(text,text,text,text,boolean,text,text,text[],boolean),
 public.my_fanarts(),public.withdraw_fanart(uuid),public.moderation_fanart_queue(text,integer),
 public.moderate_fanart(uuid,text,text),public.ban_fanart_author(uuid,text,timestamptz)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fanart_submission_allowed(),public.submit_fanart(text,text,text,text,boolean,text,text,text[],boolean),
 public.my_fanarts(),public.withdraw_fanart(uuid),public.moderation_fanart_queue(text,integer),
 public.moderate_fanart(uuid,text,text),public.ban_fanart_author(uuid,text,timestamptz)
 TO authenticated;
