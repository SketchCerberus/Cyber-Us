-- A fanart comment must always use the identity of its verified account.
-- Username takes precedence; accounts without one use their public profile display name.
-- display_name is kept as a public snapshot so author_id never needs public SELECT access.
ALTER TABLE public.fanart_comments ALTER COLUMN display_name SET DEFAULT 'Leitor';

CREATE OR REPLACE FUNCTION community_private.guard_fanart_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_profile_name text;
BEGIN
 IF NEW.author_id IS DISTINCT FROM auth.uid()
    OR public.is_banned()
    OR NOT EXISTS (
      SELECT 1 FROM auth.users AS u WHERE u.id=NEW.author_id
        AND u.email_confirmed_at IS NOT NULL AND u.is_anonymous IS FALSE
    ) THEN
   RAISE EXCEPTION 'Fanart comment not authorized' USING errcode='42501';
 END IF;

 SELECT COALESCE(NULLIF(btrim(p.username),''),NULLIF(btrim(p.display_name),''))
   INTO v_profile_name
   FROM public.profiles AS p
   WHERE p.id=NEW.author_id;
 IF v_profile_name IS NULL THEN
   RAISE EXCEPTION 'A profile name is required' USING errcode='22023';
 END IF;
 -- Never trust display_name supplied through the API: the trigger is authoritative.
 NEW.display_name:=v_profile_name;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.author_id::text,91827));
 IF (
   SELECT count(*) FROM public.fanart_comments AS c
   WHERE c.author_id=NEW.author_id AND c.created_at>now()-interval '1 hour'
 )>=10 THEN
   RAISE EXCEPTION 'Fanart comment hourly limit reached' USING errcode='22023';
 END IF;
 RETURN NEW;
END;
$$;

-- Correct older fanart comments which used a manually entered, potentially misleading name.
UPDATE public.fanart_comments AS c
   SET display_name=COALESCE(NULLIF(btrim(p.username),''),p.display_name)
  FROM public.profiles AS p
 WHERE c.author_id=p.id
   AND c.display_name IS DISTINCT FROM COALESCE(NULLIF(btrim(p.username),''),p.display_name);

-- Renaming an account keeps the same public identity on all of its fanart comments.
CREATE OR REPLACE FUNCTION community_private.refresh_fanart_comment_profile_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_name text;
BEGIN
 v_name:=COALESCE(NULLIF(btrim(NEW.username),''),NEW.display_name);
 IF v_name IS DISTINCT FROM COALESCE(NULLIF(btrim(OLD.username),''),OLD.display_name) THEN
   UPDATE public.fanart_comments AS c SET display_name=v_name
    WHERE c.author_id=NEW.id AND c.display_name IS DISTINCT FROM v_name;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER fanart_comments_sync_profile_name
AFTER UPDATE OF username,display_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION community_private.refresh_fanart_comment_profile_name();
