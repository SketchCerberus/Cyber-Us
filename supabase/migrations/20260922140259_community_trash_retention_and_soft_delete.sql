-- Retain removals for two calendar months, then let the background jobs purge them.
-- Existing removals start a fresh grace period because their removal dates were unknown.
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS purge_after timestamptz;
ALTER TABLE public.fanart_comments ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS purge_after timestamptz, ADD COLUMN IF NOT EXISTS deleted_by_author boolean NOT NULL DEFAULT false;
ALTER TABLE public.fanart_submissions ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS purge_after timestamptz, ADD COLUMN IF NOT EXISTS trash_bucket text, ADD COLUMN IF NOT EXISTS trash_path text, ADD COLUMN IF NOT EXISTS trash_previous_status text;
ALTER TABLE public.fanart_submissions ADD CONSTRAINT fanart_trash_bucket_valid CHECK (trash_bucket IS NULL OR trash_bucket IN ('fanart-pending','fanart-trash'));
ALTER TABLE public.fanart_submissions ADD CONSTRAINT fanart_trash_previous_valid CHECK (trash_previous_status IS NULL OR trash_previous_status IN ('pending','approved'));
UPDATE public.comments SET deleted_at=now(),purge_after=now()+interval '2 months' WHERE (status='removed' OR deleted_by_author) AND deleted_at IS NULL;
UPDATE public.fanart_submissions SET deleted_at=now(),purge_after=now()+interval '2 months' WHERE status='rejected' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS comments_purge_due_idx ON public.comments(purge_after) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS fanart_comments_purge_due_idx ON public.fanart_comments(purge_after) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS fanart_submissions_purge_due_idx ON public.fanart_submissions(purge_after) WHERE deleted_at IS NOT NULL;
CREATE OR REPLACE FUNCTION community_private.stamp_comment_trash() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='removed' OR NEW.deleted_by_author THEN
  IF OLD.deleted_at IS NULL THEN NEW.deleted_at=now(); NEW.purge_after=now()+interval '2 months';
  ELSE NEW.deleted_at=OLD.deleted_at; NEW.purge_after=OLD.purge_after; END IF;
 ELSIF OLD.deleted_at IS NOT NULL THEN NEW.deleted_at=NULL; NEW.purge_after=NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER comments_trash_stamp BEFORE UPDATE OF status,deleted_by_author ON public.comments FOR EACH ROW EXECUTE FUNCTION community_private.stamp_comment_trash();
CREATE OR REPLACE FUNCTION community_private.stamp_fanart_trash() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
  NEW.deleted_at=now(); NEW.purge_after=now()+interval '2 months';
 ELSIF NEW.status IS DISTINCT FROM 'rejected' AND OLD.status='rejected' THEN
  NEW.deleted_at=NULL; NEW.purge_after=NULL; NEW.trash_bucket=NULL; NEW.trash_path=NULL; NEW.trash_previous_status=NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fanart_trash_stamp BEFORE UPDATE OF status ON public.fanart_submissions FOR EACH ROW EXECUTE FUNCTION community_private.stamp_fanart_trash();
ALTER TABLE public.fanart_comments DROP CONSTRAINT fanart_comments_submission_id_fkey;
ALTER TABLE public.fanart_comments ADD CONSTRAINT fanart_comments_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.fanart_submissions(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS fanart_comments_public_read ON public.fanart_comments;
CREATE POLICY fanart_comments_public_read ON public.fanart_comments FOR SELECT TO anon,authenticated USING (deleted_at IS NULL AND EXISTS(SELECT 1 FROM public.fanart_gallery g WHERE g.submission_id=fanart_comments.submission_id));
DROP POLICY IF EXISTS fanart_comments_owner_insert ON public.fanart_comments;
CREATE POLICY fanart_comments_owner_insert ON public.fanart_comments FOR INSERT TO authenticated WITH CHECK (author_id=(SELECT auth.uid()) AND NOT public.is_banned() AND EXISTS(SELECT 1 FROM public.fanart_gallery g WHERE g.submission_id=fanart_comments.submission_id));
DROP POLICY IF EXISTS fanart_comments_owner_or_moderator_delete ON public.fanart_comments;
REVOKE DELETE ON public.fanart_comments FROM anon,authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('fanart-trash','fanart-trash',false,5242880,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY fanart_trash_staff_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='fanart-trash' AND EXISTS(SELECT 1 FROM public.fanart_submissions f WHERE f.id::text||'.'||f.extension=storage.objects.name AND public.moderator_can_handle(f.user_id)));
CREATE POLICY fanart_trash_staff_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='fanart-trash' AND EXISTS(SELECT 1 FROM public.fanart_submissions f WHERE f.id::text||'.'||f.extension=storage.objects.name AND public.moderator_can_handle(f.user_id)));
CREATE POLICY fanart_trash_staff_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='fanart-trash' AND EXISTS(SELECT 1 FROM public.fanart_submissions f WHERE f.id::text||'.'||f.extension=storage.objects.name AND public.moderator_can_handle(f.user_id)));
CREATE OR REPLACE FUNCTION public.trash_own_fanart_comment(p_comment_id bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_author uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING errcode='42501'; END IF;
 SELECT author_id INTO v_author FROM public.fanart_comments WHERE id=p_comment_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF v_author IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not your comment' USING errcode='42501'; END IF;
 UPDATE public.fanart_comments SET deleted_at=now(),purge_after=now()+interval '2 months',deleted_by_author=true WHERE id=p_comment_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.trash_own_fanart_comment(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.trash_own_fanart_comment(bigint) TO authenticated;
CREATE OR REPLACE FUNCTION public.moderate_fanart_comment(p_comment_id bigint,p_reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid();v_comment public.fanart_comments%rowtype;v_reason text:=nullif(btrim(p_reason),'');
BEGIN
 IF v_actor IS NULL OR NOT community_private.is_moderator() THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Reason required' USING errcode='22023'; END IF;
 SELECT * INTO v_comment FROM public.fanart_comments WHERE id=p_comment_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT public.moderator_can_handle(v_comment.author_id) THEN RAISE EXCEPTION 'Cannot moderate staff' USING errcode='42501'; END IF;
 UPDATE public.fanart_comments SET deleted_at=now(),purge_after=now()+interval '2 months' WHERE id=p_comment_id;
 INSERT INTO community_private.fanart_comment_moderation_log(comment_id,submission_id,author_id,moderator_id,reason) VALUES(v_comment.id,v_comment.submission_id,v_comment.author_id,v_actor,v_reason);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.moderate_fanart_comment(bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.moderate_fanart_comment(bigint,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.moderate_fanart_submission(p_submission_id uuid,p_decision text,p_reason text DEFAULT NULL::text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid();v_work public.fanart_submissions%rowtype;v_reason text:=nullif(btrim(p_reason),'');v_published boolean;v_file text;
BEGIN
 IF v_actor IS NULL OR NOT community_private.is_moderator() THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF p_decision <> 'rejected' OR v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Invalid rejection' USING errcode='22023'; END IF;
 SELECT * INTO v_work FROM public.fanart_submissions WHERE id=p_submission_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found' USING errcode='22023'; END IF;
 IF v_work.status NOT IN('pending','withdrawal_requested') OR NOT public.moderator_can_handle(v_work.user_id) THEN RAISE EXCEPTION 'Submission not eligible' USING errcode='42501'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.fanart_gallery WHERE submission_id=v_work.id) INTO v_published;
 v_file:=v_work.id::text||'.'||v_work.extension;
 IF v_published AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='fanart-trash' AND o.name=v_file) THEN RAISE EXCEPTION 'Copy public artwork to private trash before rejection' USING errcode='22023'; END IF;
 DELETE FROM public.fanart_gallery WHERE submission_id=v_work.id;
 UPDATE public.fanart_submissions SET status='rejected',trash_previous_status=CASE WHEN v_published THEN 'approved' ELSE 'pending' END,trash_bucket=CASE WHEN v_published THEN 'fanart-trash' ELSE 'fanart-pending' END,trash_path=CASE WHEN v_published THEN v_file ELSE v_work.image_path END WHERE id=v_work.id;
 INSERT INTO community_private.fanart_moderation_log(submission_id,submitter_id,moderator_id,previous_status,decision,reason) VALUES(v_work.id,v_work.user_id,v_actor,v_work.status,'rejected',v_reason);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.moderate_fanart_submission(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.moderate_fanart_submission(uuid,text,text) TO authenticated;
