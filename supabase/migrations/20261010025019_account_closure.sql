-- Auth soft deletion preserves discussions and private moderation evidence.
-- Reject current staff closure so publishing/creator permissions stay intact.
CREATE FUNCTION community_private.anonymize_closed_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
  IF EXISTS(SELECT 1 FROM community_private.staff WHERE user_id=NEW.id) THEN
   RAISE EXCEPTION 'Staff must transfer responsibilities before account closure' USING errcode='42501';
  END IF;
  UPDATE public.profiles SET username=NULL,display_name='Conta excluída / Deleted account',avatar=NULL WHERE id=NEW.id;
  UPDATE public.fanart_submissions SET artist_name='Conta excluída / Deleted account',artist_link=NULL,region=NULL,show_region=false WHERE user_id=NEW.id;
  UPDATE public.fanart_gallery SET artist_name='Conta excluída / Deleted account',artist_link=NULL,region=NULL WHERE submission_id IN(SELECT id FROM public.fanart_submissions WHERE user_id=NEW.id);
  DELETE FROM public.community_notifications WHERE recipient_id=NEW.id;
  DELETE FROM public.community_notification_preferences WHERE user_id=NEW.id;
  DELETE FROM auth.sessions WHERE user_id=NEW.id;
  DELETE FROM auth.refresh_tokens WHERE user_id=NEW.id::text;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION community_private.anonymize_closed_account() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cyberus_anonymize_closed_account AFTER UPDATE OF deleted_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION community_private.anonymize_closed_account();
CREATE OR REPLACE FUNCTION community_private.is_banned() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.deleted_at IS NOT NULL)
 OR EXISTS(SELECT 1 FROM community_private.bans b WHERE b.user_id=auth.uid() AND b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>now()));
$$;
