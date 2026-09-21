-- In-app notifications are opt-in and never disclose account IDs to other readers.
CREATE TABLE public.community_notification_preferences (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  replies boolean NOT NULL DEFAULT false,
  mentions boolean NOT NULL DEFAULT false
);
ALTER TABLE public.community_notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_notification_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT(user_id,replies,mentions), INSERT(user_id,replies,mentions), UPDATE(replies,mentions)
  ON public.community_notification_preferences TO authenticated;
CREATE POLICY notification_preferences_read ON public.community_notification_preferences FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY notification_preferences_insert ON public.community_notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY notification_preferences_update ON public.community_notification_preferences FOR UPDATE TO authenticated
  USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));

CREATE TABLE public.community_notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('reply','mention')),
  episode_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  fanart_comment_id bigint REFERENCES public.fanart_comments(id) ON DELETE CASCADE,
  episode_slug text REFERENCES public.episodes(slug) ON DELETE CASCADE,
  fanart_submission_id uuid REFERENCES public.fanart_gallery(submission_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT notification_target CHECK (
    (episode_comment_id IS NOT NULL AND fanart_comment_id IS NULL AND episode_slug IS NOT NULL AND fanart_submission_id IS NULL) OR
    (episode_comment_id IS NULL AND fanart_comment_id IS NOT NULL AND episode_slug IS NULL AND fanart_submission_id IS NOT NULL AND kind='mention')
  ),
  CONSTRAINT notification_unique_episode UNIQUE(recipient_id,kind,episode_comment_id),
  CONSTRAINT notification_unique_fanart UNIQUE(recipient_id,kind,fanart_comment_id)
);
CREATE INDEX community_notifications_inbox ON public.community_notifications(recipient_id,created_at DESC);
ALTER TABLE public.community_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,kind,episode_comment_id,episode_slug,fanart_comment_id,fanart_submission_id,created_at,read_at),
  UPDATE(read_at) ON public.community_notifications TO authenticated;
CREATE POLICY notification_owner_read ON public.community_notifications FOR SELECT TO authenticated
  USING (recipient_id=(SELECT auth.uid()));
CREATE POLICY notification_owner_mark_read ON public.community_notifications FOR UPDATE TO authenticated
  USING (recipient_id=(SELECT auth.uid())) WITH CHECK (recipient_id=(SELECT auth.uid()));

-- Only database triggers can enqueue; preferences are checked on the server.
CREATE FUNCTION community_private.enqueue_community_notice(p_recipient uuid,p_actor uuid,p_kind text,
  p_episode_comment uuid,p_fanart_comment bigint,p_episode_slug text,p_fanart_submission uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF p_recipient IS NULL OR p_recipient=p_actor OR p_kind NOT IN ('reply','mention') THEN RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.community_notification_preferences AS pref
    WHERE pref.user_id=p_recipient AND
      ((p_kind='reply' AND pref.replies) OR (p_kind='mention' AND pref.mentions))) THEN RETURN; END IF;
  INSERT INTO public.community_notifications
    (recipient_id,kind,episode_comment_id,fanart_comment_id,episode_slug,fanart_submission_id)
  VALUES (p_recipient,p_kind,p_episode_comment,p_fanart_comment,p_episode_slug,p_fanart_submission)
  ON CONFLICT DO NOTHING;
END;$fn$;
REVOKE ALL ON FUNCTION community_private.enqueue_community_notice(uuid,uuid,text,uuid,bigint,text,uuid) FROM PUBLIC,anon,authenticated;

-- Extract exact @username tokens, not parts of email addresses or unknown usernames.
CREATE FUNCTION community_private.notice_episode_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_parent uuid; v_username text; v_recipient uuid; v_old text := '';
BEGIN
  IF NEW.status <> 'visible' OR NEW.deleted_by_author THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' AND NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO v_parent FROM public.comments
      WHERE id=NEW.parent_id AND status='visible' AND NOT deleted_by_author;
    PERFORM community_private.enqueue_community_notice(v_parent,NEW.author_id,'reply',NEW.id,NULL,NEW.episode_slug,NULL);
  END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.body IS NOT DISTINCT FROM OLD.body THEN RETURN NEW; END IF;
    v_old:=OLD.body;
  END IF;
  FOR v_username IN
    SELECT DISTINCT substring(token FROM '^@([a-z0-9_]{3,24})$')
    FROM regexp_split_to_table(lower(NEW.body),'[^a-z0-9_@]+') AS token
    WHERE token ~ '^@[a-z0-9_]{3,24}$'
    EXCEPT
    SELECT DISTINCT substring(token FROM '^@([a-z0-9_]{3,24})$')
    FROM regexp_split_to_table(lower(v_old),'[^a-z0-9_@]+') AS token
    WHERE token ~ '^@[a-z0-9_]{3,24}$'
    LIMIT 5
  LOOP
    SELECT id INTO v_recipient FROM public.profiles WHERE username=v_username;
    PERFORM community_private.enqueue_community_notice(v_recipient,NEW.author_id,'mention',NEW.id,NULL,NEW.episode_slug,NULL);
  END LOOP;
  RETURN NEW;
END;$fn$;
REVOKE ALL ON FUNCTION community_private.notice_episode_comment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER episode_notify_comment_insert AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION community_private.notice_episode_comment();
CREATE TRIGGER episode_notify_comment_edit AFTER UPDATE OF body ON public.comments
  FOR EACH ROW EXECUTE FUNCTION community_private.notice_episode_comment();

CREATE FUNCTION community_private.notice_fanart_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_username text; v_recipient uuid; v_old text := '';
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.body IS NOT DISTINCT FROM OLD.body THEN RETURN NEW; END IF;
    v_old:=OLD.body;
  END IF;
  FOR v_username IN
    SELECT DISTINCT substring(token FROM '^@([a-z0-9_]{3,24})$')
    FROM regexp_split_to_table(lower(NEW.body),'[^a-z0-9_@]+') AS token
    WHERE token ~ '^@[a-z0-9_]{3,24}$'
    EXCEPT
    SELECT DISTINCT substring(token FROM '^@([a-z0-9_]{3,24})$')
    FROM regexp_split_to_table(lower(v_old),'[^a-z0-9_@]+') AS token
    WHERE token ~ '^@[a-z0-9_]{3,24}$'
    LIMIT 5
  LOOP
    SELECT id INTO v_recipient FROM public.profiles WHERE username=v_username;
    PERFORM community_private.enqueue_community_notice(v_recipient,NEW.author_id,'mention',NULL,NEW.id,NULL,NEW.submission_id);
  END LOOP;
  RETURN NEW;
END;$fn$;
REVOKE ALL ON FUNCTION community_private.notice_fanart_comment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fanart_notify_comment_insert AFTER INSERT ON public.fanart_comments
  FOR EACH ROW EXECUTE FUNCTION community_private.notice_fanart_comment();
CREATE TRIGGER fanart_notify_comment_edit AFTER UPDATE OF body ON public.fanart_comments
  FOR EACH ROW EXECUTE FUNCTION community_private.notice_fanart_comment();

-- Preserve previous content on every edit, even when a reported comment changes.
-- No user-facing role receives access to this private log.
ALTER TABLE public.fanart_comments ADD COLUMN IF NOT EXISTS updated_at timestamptz;
GRANT SELECT(updated_at) ON public.fanart_comments TO anon,authenticated;
CREATE TABLE community_private.comment_edit_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK(kind IN ('episode','fanart')),
  episode_comment_id uuid,
  fanart_comment_id bigint,
  previous_body text NOT NULL,
  editor_id uuid,
  edited_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind='episode' AND episode_comment_id IS NOT NULL AND fanart_comment_id IS NULL) OR
         (kind='fanart' AND fanart_comment_id IS NOT NULL AND episode_comment_id IS NULL))
);
CREATE INDEX comment_edit_history_episode ON community_private.comment_edit_history(episode_comment_id,edited_at DESC);
CREATE INDEX comment_edit_history_fanart ON community_private.comment_edit_history(fanart_comment_id,edited_at DESC);
ALTER TABLE community_private.comment_edit_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON community_private.comment_edit_history FROM PUBLIC,anon,authenticated;
CREATE FUNCTION community_private.archive_episode_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    INSERT INTO community_private.comment_edit_history(kind,episode_comment_id,previous_body,editor_id)
      VALUES('episode',OLD.id,OLD.body,auth.uid());
  END IF;
  RETURN NEW;
END;$fn$;
REVOKE ALL ON FUNCTION community_private.archive_episode_edit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER episode_archive_edit BEFORE UPDATE OF body ON public.comments
  FOR EACH ROW EXECUTE FUNCTION community_private.archive_episode_edit();
CREATE FUNCTION community_private.archive_fanart_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    INSERT INTO community_private.comment_edit_history(kind,fanart_comment_id,previous_body,editor_id)
      VALUES('fanart',OLD.id,OLD.body,auth.uid());
    NEW.updated_at:=now();
  END IF;
  RETURN NEW;
END;$fn$;
REVOKE ALL ON FUNCTION community_private.archive_fanart_edit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fanart_archive_edit BEFORE UPDATE OF body ON public.fanart_comments
  FOR EACH ROW EXECUTE FUNCTION community_private.archive_fanart_edit();

CREATE FUNCTION public.moderation_comment_edit_history(p_kind text,p_id text)
RETURNS TABLE(prior_text text,edited_at timestamptz,editor_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501';
  END IF;
  IF p_kind='episode' AND p_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN QUERY SELECT h.previous_body,h.edited_at,h.editor_id
      FROM community_private.comment_edit_history h
      WHERE h.kind='episode' AND h.episode_comment_id=p_id::uuid ORDER BY h.edited_at DESC LIMIT 50;
  ELSIF p_kind='fanart' AND p_id ~ '^[0-9]{1,19}$' THEN
    RETURN QUERY SELECT h.previous_body,h.edited_at,h.editor_id
      FROM community_private.comment_edit_history h
      WHERE h.kind='fanart' AND h.fanart_comment_id=p_id::bigint ORDER BY h.edited_at DESC LIMIT 50;
  ELSE
    RAISE EXCEPTION 'Invalid comment identifier' USING errcode='22023';
  END IF;
END;$fn$;
REVOKE ALL ON FUNCTION public.moderation_comment_edit_history(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.moderation_comment_edit_history(text,text) TO authenticated;

-- Editorial selection, never derived from votes or automated rankings.
ALTER TABLE public.fanart_gallery
  ADD COLUMN featured boolean NOT NULL DEFAULT false,
  ADD COLUMN featured_at timestamptz;
GRANT SELECT(featured,featured_at) ON public.fanart_gallery TO anon,authenticated;
GRANT UPDATE(featured) ON public.fanart_gallery TO authenticated;
CREATE POLICY fanart_feature_moderator_update ON public.fanart_gallery
  FOR UPDATE TO authenticated USING ((SELECT public.is_moderator()))
  WITH CHECK ((SELECT public.is_moderator()));
CREATE TABLE community_private.fanart_feature_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id uuid NOT NULL,
  moderator_id uuid NOT NULL,
  featured boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE community_private.fanart_feature_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON community_private.fanart_feature_history FROM PUBLIC,anon,authenticated;
CREATE FUNCTION community_private.guard_fanart_feature()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF NEW.featured IS NOT DISTINCT FROM OLD.featured THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cyberus_fanart_feature_slots',0));
  IF NEW.featured AND (SELECT count(*) FROM public.fanart_gallery
    WHERE featured AND submission_id<>NEW.submission_id)>=6 THEN
    RAISE EXCEPTION 'At most six featured artworks' USING errcode='22023';
  END IF;
  NEW.featured_at:=CASE WHEN NEW.featured THEN now() ELSE NULL END;
  INSERT INTO community_private.fanart_feature_history(submission_id,moderator_id,featured)
    VALUES(NEW.submission_id,auth.uid(),NEW.featured);
  RETURN NEW;
END;$fn$;
REVOKE ALL ON FUNCTION community_private.guard_fanart_feature() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fanart_feature_guard BEFORE UPDATE OF featured ON public.fanart_gallery
  FOR EACH ROW EXECUTE FUNCTION community_private.guard_fanart_feature();
