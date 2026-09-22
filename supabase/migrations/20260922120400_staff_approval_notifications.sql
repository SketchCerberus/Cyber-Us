-- Staff requests and staff appeals are system notifications for the Creator, independent of optional social-alert preferences.
ALTER TABLE public.community_notifications
 ADD COLUMN staff_request_id uuid REFERENCES community_private.staff_requests(id) ON DELETE CASCADE,
 ADD COLUMN staff_role_appeal_id uuid REFERENCES community_private.staff_role_appeals(id) ON DELETE CASCADE;
ALTER TABLE public.community_notifications DROP CONSTRAINT community_notifications_kind_check;
ALTER TABLE public.community_notifications ADD CONSTRAINT community_notifications_kind_check
 CHECK(kind IN ('reply','mention','staff_request','staff_role_appeal'));
ALTER TABLE public.community_notifications DROP CONSTRAINT notification_target;
ALTER TABLE public.community_notifications ADD CONSTRAINT notification_target CHECK(
 (staff_request_id IS NULL AND staff_role_appeal_id IS NULL AND
  ((episode_comment_id IS NOT NULL AND fanart_comment_id IS NULL AND episode_slug IS NOT NULL
    AND fanart_submission_id IS NULL AND kind IN ('reply','mention')) OR
   (episode_comment_id IS NULL AND fanart_comment_id IS NOT NULL AND episode_slug IS NULL
    AND fanart_submission_id IS NOT NULL AND kind='mention')))
 OR
 (kind='staff_request' AND staff_request_id IS NOT NULL AND staff_role_appeal_id IS NULL
  AND episode_comment_id IS NULL AND fanart_comment_id IS NULL
  AND episode_slug IS NULL AND fanart_submission_id IS NULL)
 OR
 (kind='staff_role_appeal' AND staff_request_id IS NULL AND staff_role_appeal_id IS NOT NULL
  AND episode_comment_id IS NULL AND fanart_comment_id IS NULL
  AND episode_slug IS NULL AND fanart_submission_id IS NULL));
CREATE UNIQUE INDEX community_notice_unique_staff_request
 ON public.community_notifications(recipient_id,staff_request_id) WHERE staff_request_id IS NOT NULL;
CREATE UNIQUE INDEX community_notice_unique_staff_role_appeal
 ON public.community_notifications(recipient_id,staff_role_appeal_id) WHERE staff_role_appeal_id IS NOT NULL;
-- No direct client insert/recipient read grant changes; existing RLS still owns the inbox.
CREATE FUNCTION community_private.notify_creator_staff_request() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.community_notifications(recipient_id,kind,staff_request_id)
 SELECT a.user_id,'staff_request',NEW.id FROM community_private.creator_anchor a
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER staff_request_notify_creator AFTER INSERT ON community_private.staff_requests
 FOR EACH ROW EXECUTE FUNCTION community_private.notify_creator_staff_request();
CREATE FUNCTION community_private.notify_creator_staff_appeal() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.community_notifications(recipient_id,kind,staff_role_appeal_id)
 SELECT a.user_id,'staff_role_appeal',NEW.id FROM community_private.creator_anchor a
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER staff_appeal_notify_creator AFTER INSERT ON community_private.staff_role_appeals
 FOR EACH ROW EXECUTE FUNCTION community_private.notify_creator_staff_appeal();
REVOKE ALL ON FUNCTION community_private.notify_creator_staff_request(),
 community_private.notify_creator_staff_appeal() FROM PUBLIC,anon,authenticated;
