-- Proposed migration: apply before deploying tagged submission/gallery JavaScript.
-- Tags contain only a fixed public vocabulary; no owner/account metadata is copied.
ALTER TABLE public.fanart_submissions
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.fanart_gallery
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.fanart_submissions ADD CONSTRAINT fanart_tags_allowed CHECK (
  cardinality(tags) <= 8 AND
  tags <@ ARRAY['Auará','Kaubi','Óete','Sistema','Trojan','Malwer','OC','Ships','Crossover','Grupo']::text[]
);
ALTER TABLE public.fanart_gallery ADD CONSTRAINT fanart_public_tags_allowed CHECK (
  cardinality(tags) <= 8 AND
  tags <@ ARRAY['Auará','Kaubi','Óete','Sistema','Trojan','Malwer','OC','Ships','Crossover','Grupo']::text[]
);
-- The original INSERT grant deliberately excluded non-approved columns.
-- Explicitly grant only this new, constrained field.
GRANT INSERT(tags) ON public.fanart_submissions TO authenticated;

-- Runs inside the existing moderator-only publication function, and copies
-- server-side values instead of trusting metadata supplied by the moderator UI.
CREATE FUNCTION community_private.copy_fanart_tags_to_gallery()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  SELECT s.tags INTO NEW.tags
  FROM public.fanart_submissions AS s
  WHERE s.id = NEW.submission_id AND s.status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only an approved submission may publish tags' USING errcode='42501';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION community_private.copy_fanart_tags_to_gallery() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fanart_gallery_copy_tags
BEFORE INSERT ON public.fanart_gallery
FOR EACH ROW EXECUTE FUNCTION community_private.copy_fanart_tags_to_gallery();

-- Preserve historical approved works if this feature ships after approval.
UPDATE public.fanart_gallery AS g SET tags = s.tags
FROM public.fanart_submissions AS s
WHERE g.submission_id = s.id;
