-- Enforce role hierarchy in old entry points, not just in navigation.
ALTER TABLE community_private.bans ADD COLUMN target_staff_role text
 CHECK(target_staff_role IS NULL OR target_staff_role IN ('moderator','right_hand'));
CREATE OR REPLACE FUNCTION community_private.ban_member(p_user_id uuid,p_reason text,
 p_expires_at timestamptz DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_actor uuid:=auth.uid(); v_role text; v_target text;
BEGIN
 v_role:=community_private.staff_role(v_actor);
 IF v_role IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF p_user_id IS NULL OR p_user_id=v_actor OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500
  OR (p_expires_at IS NOT NULL AND p_expires_at<=now()) THEN
  RAISE EXCEPTION 'Invalid ban' USING errcode='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cyber-us-staff-'||p_user_id::text,0));
 SELECT role INTO v_target FROM community_private.staff WHERE user_id=p_user_id FOR UPDATE;
 IF v_target='creator' OR (v_target IS NOT NULL AND v_role<>'creator') THEN
  RAISE EXCEPTION 'Only creator can ban a staff account; creator cannot be banned' USING errcode='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN
  RAISE EXCEPTION 'Account not found' USING errcode='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cyber-us-ban-'||p_user_id::text,0));
 UPDATE community_private.bans SET revoked_at=now(),revoked_by=v_actor WHERE user_id=p_user_id AND revoked_at IS NULL;
 INSERT INTO community_private.bans(user_id,reason,issued_by,expires_at,target_staff_role)
 VALUES(p_user_id,btrim(p_reason),v_actor,p_expires_at,v_target) RETURNING id INTO v_id;
 UPDATE public.comments SET status='hidden' WHERE author_id=p_user_id AND status='visible';
 INSERT INTO community_private.moderation_log(actor_id,target_id,action,reason)
 VALUES(v_actor,p_user_id,'ban',btrim(p_reason));
 IF v_target IS NOT NULL THEN
  INSERT INTO community_private.staff_actions(target_id,actor_id,action,previous_role,new_role,reason)
  VALUES(p_user_id,v_actor,'ban',v_target,v_target,btrim(p_reason));
 END IF;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION community_private.unban_member(p_user_id uuid,p_reason text DEFAULT 'Ban revoked')
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_role text; v_count integer;
BEGIN
 v_role:=community_private.staff_role(v_actor);
 IF v_role IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF p_user_id IS NULL OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN
  RAISE EXCEPTION 'Invalid unban' USING errcode='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cyber-us-staff-'||p_user_id::text,0));
 IF (EXISTS(SELECT 1 FROM community_private.staff WHERE user_id=p_user_id)
  OR EXISTS(SELECT 1 FROM community_private.bans WHERE user_id=p_user_id AND target_staff_role IS NOT NULL
   AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()))) AND v_role<>'creator' THEN
  RAISE EXCEPTION 'Only creator can unban staff' USING errcode='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cyber-us-ban-'||p_user_id::text,0));
 UPDATE community_private.bans SET revoked_at=now(),revoked_by=v_actor
 WHERE user_id=p_user_id AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now());
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RETURN false; END IF;
 INSERT INTO community_private.moderation_log(actor_id,target_id,action,reason)
 VALUES(v_actor,p_user_id,'unban',btrim(p_reason));
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION community_private.moderate_comment(p_comment_id uuid,p_status text,p_reason text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_author uuid; v_role text; v_action text;
BEGIN
 v_role:=community_private.staff_role(v_actor);
 IF v_role IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF p_status NOT IN ('visible','hidden','removed') OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN
  RAISE EXCEPTION 'Invalid moderation action' USING errcode='22023'; END IF;
 SELECT author_id INTO v_author FROM public.comments WHERE id=p_comment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM community_private.staff WHERE user_id=v_author) AND v_role<>'creator' THEN
  RAISE EXCEPTION 'Only creator moderates staff content' USING errcode='42501'; END IF;
 IF p_status='visible' AND EXISTS(SELECT 1 FROM community_private.bans WHERE user_id=v_author AND
  revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())) THEN
  RAISE EXCEPTION 'Banned member comments cannot be restored' USING errcode='42501'; END IF;
 UPDATE public.comments SET status=p_status WHERE id=p_comment_id;
 v_action:=CASE p_status WHEN 'visible' THEN 'restore_comment' WHEN 'hidden' THEN 'hide_comment' ELSE 'remove_comment' END;
 INSERT INTO community_private.moderation_log(actor_id,target_id,comment_id,action,reason)
 VALUES(v_actor,v_author,p_comment_id,v_action,btrim(p_reason));
 RETURN true;
END $$;
CREATE FUNCTION community_private.protect_staff_fanart_comment() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM community_private.staff WHERE user_id=OLD.author_id)
  AND auth.uid() IS DISTINCT FROM OLD.author_id
  AND community_private.staff_role(auth.uid()) IS DISTINCT FROM 'creator' THEN
  RAISE EXCEPTION 'Only creator may moderate staff comments' USING errcode='42501'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER fanart_staff_comment_protection BEFORE DELETE ON public.fanart_comments
 FOR EACH ROW EXECUTE FUNCTION community_private.protect_staff_fanart_comment();
CREATE FUNCTION community_private.protect_staff_fanart_submission() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status
 AND EXISTS(SELECT 1 FROM community_private.staff WHERE user_id=OLD.user_id)
 AND auth.uid() IS DISTINCT FROM OLD.user_id
 AND community_private.staff_role(auth.uid()) IS DISTINCT FROM 'creator' THEN
  RAISE EXCEPTION 'Only creator may moderate staff artwork' USING errcode='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fanart_staff_submission_protection BEFORE UPDATE OF status ON public.fanart_submissions
 FOR EACH ROW EXECUTE FUNCTION community_private.protect_staff_fanart_submission();
DROP POLICY fanart_moderator_read ON public.fanart_submissions;
CREATE POLICY fanart_moderator_read ON public.fanart_submissions FOR SELECT TO authenticated
 USING ((SELECT public.is_moderator()) AND (NOT EXISTS
  (SELECT 1 FROM community_private.staff s WHERE s.user_id=user_id)
  OR (SELECT public.my_staff_role())='creator'));
CREATE OR REPLACE FUNCTION public.moderation_pending_appeals() RETURNS TABLE(
 appeal_id uuid,ban_id uuid,user_id uuid,display_name text,category text,ban_reason text,
 appeal_body text,appeal_created_at timestamptz,expires_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text:=community_private.staff_role(auth.uid());
BEGIN
 IF v_role IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 RETURN QUERY SELECT a.id,b.id,a.user_id,p.display_name,b.category,b.reason,a.body,a.created_at,b.expires_at
 FROM community_private.ban_appeals a JOIN community_private.bans b ON b.id=a.ban_id
 LEFT JOIN public.profiles p ON p.id=a.user_id WHERE a.status='pending'
 AND (v_role='creator' OR (b.target_staff_role IS NULL AND NOT EXISTS(
  SELECT 1 FROM community_private.staff s WHERE s.user_id=a.user_id)))
 ORDER BY a.created_at,a.id LIMIT 100;
END $$;
CREATE OR REPLACE FUNCTION public.moderation_decide_appeal(p_appeal_id uuid,p_approve boolean,p_note text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_role text; v_appeal community_private.ban_appeals%ROWTYPE;
 v_staff_role text; v_count integer;
BEGIN
 v_role:=community_private.staff_role(v_actor);
 IF v_role IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF p_approve IS NULL OR char_length(btrim(coalesce(p_note,''))) NOT BETWEEN 5 AND 500 THEN
  RAISE EXCEPTION 'Invalid decision note' USING errcode='22023'; END IF;
 SELECT * INTO v_appeal FROM community_private.ban_appeals WHERE id=p_appeal_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Appeal not found' USING errcode='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cyber-us-ban-'||v_appeal.user_id::text,0));
 SELECT * INTO v_appeal FROM community_private.ban_appeals WHERE id=p_appeal_id FOR UPDATE;
 IF v_appeal.status<>'pending' THEN RAISE EXCEPTION 'Appeal already reviewed' USING errcode='22023'; END IF;
 SELECT b.target_staff_role INTO v_staff_role FROM community_private.bans b WHERE b.id=v_appeal.ban_id;
 IF v_role<>'creator' AND (v_staff_role IS NOT NULL OR
  EXISTS(SELECT 1 FROM community_private.staff WHERE user_id=v_appeal.user_id)) THEN
  RAISE EXCEPTION 'Creator alone decides staff appeals' USING errcode='42501'; END IF;
 UPDATE community_private.ban_appeals SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 reviewed_by=v_actor,reviewed_at=now(),decision_note=btrim(p_note) WHERE id=p_appeal_id;
 IF p_approve THEN
  UPDATE community_private.bans SET revoked_at=now(),revoked_by=v_actor
   WHERE id=v_appeal.ban_id AND user_id=v_appeal.user_id AND revoked_at IS NULL
   AND (expires_at IS NULL OR expires_at>now());
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count>0 THEN
   INSERT INTO community_private.moderation_log(actor_id,target_id,action,reason)
   VALUES(v_actor,v_appeal.user_id,'unban','Appeal approved: '||btrim(p_note));
  END IF;
 END IF;
 RETURN true;
END $$;
-- Preserve moderator-removal event so an ex-moderator can appeal without a current staff row.
CREATE FUNCTION public.my_staff_removal() RETURNS TABLE(action_id bigint,reason text,created_at timestamptz,
 appeal_status text,decision_note text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING errcode='42501'; END IF;
 IF EXISTS(SELECT 1 FROM community_private.staff WHERE user_id=auth.uid()) THEN RETURN; END IF;
 RETURN QUERY SELECT a.id,a.reason,a.created_at,p.status,p.decision_note
 FROM community_private.staff_actions a LEFT JOIN community_private.staff_role_appeals p ON p.action_id=a.id
 WHERE a.target_id=auth.uid() AND a.action='remove' ORDER BY a.id DESC LIMIT 1;
END $$;
CREATE FUNCTION public.staff_appeal_removal(p_action_id bigint,p_body text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL OR char_length(btrim(coalesce(p_body,''))) NOT BETWEEN 20 AND 2000 THEN
  RAISE EXCEPTION 'Appeal requires 20-2000 characters' USING errcode='22023'; END IF;
 IF EXISTS(SELECT 1 FROM community_private.staff WHERE user_id=v_user) THEN
  RAISE EXCEPTION 'Current staff cannot appeal removal' USING errcode='42501'; END IF;
 IF p_action_id IS DISTINCT FROM (SELECT max(id) FROM community_private.staff_actions
  WHERE target_id=v_user AND action='remove') THEN
  RAISE EXCEPTION 'Invalid removal action' USING errcode='42501'; END IF;
 INSERT INTO community_private.staff_role_appeals(action_id,user_id,body)
 VALUES(p_action_id,v_user,btrim(p_body)) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
CREATE FUNCTION public.staff_pending_role_appeals() RETURNS TABLE(appeal_id uuid,user_id uuid,
 display_name text,reason text,body text,created_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF community_private.staff_role(auth.uid()) IS DISTINCT FROM 'creator' THEN
  RAISE EXCEPTION 'Creator required' USING errcode='42501'; END IF;
 RETURN QUERY SELECT a.id,a.user_id,coalesce(p.display_name,p.username),s.reason,a.body,a.created_at
 FROM community_private.staff_role_appeals a JOIN community_private.staff_actions s ON s.id=a.action_id
 LEFT JOIN public.profiles p ON p.id=a.user_id WHERE a.status='pending' ORDER BY a.created_at LIMIT 100;
END $$;
CREATE FUNCTION public.staff_decide_role_appeal(p_appeal_id uuid,p_approve boolean,p_note text) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_action community_private.staff_role_appeals%ROWTYPE; v_actor uuid:=auth.uid();
BEGIN
 IF community_private.staff_role(v_actor) IS DISTINCT FROM 'creator' THEN
  RAISE EXCEPTION 'Creator required' USING errcode='42501'; END IF;
 IF p_approve IS NULL OR char_length(btrim(coalesce(p_note,''))) NOT BETWEEN 5 AND 500 THEN
  RAISE EXCEPTION 'Decision reason required' USING errcode='22023'; END IF;
 SELECT * INTO v_action FROM community_private.staff_role_appeals WHERE id=p_appeal_id FOR UPDATE;
 IF NOT FOUND OR v_action.status<>'pending' THEN RAISE EXCEPTION 'Appeal not pending' USING errcode='22023'; END IF;
 IF p_approve THEN
  IF EXISTS(SELECT 1 FROM community_private.staff WHERE user_id=v_action.user_id) THEN
   RAISE EXCEPTION 'Staff role already restored' USING errcode='42501'; END IF;
  PERFORM public.staff_assign(v_action.user_id,'moderator',btrim(p_note));
  INSERT INTO community_private.staff_actions(target_id,actor_id,action,previous_role,new_role,reason)
  VALUES(v_action.user_id,v_actor,'appeal_restore',NULL,'moderator',btrim(p_note));
 END IF;
 UPDATE community_private.staff_role_appeals SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 decided_by=v_actor,decided_at=now(),decision_note=btrim(p_note) WHERE id=p_appeal_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION community_private.protect_staff_fanart_comment(),
 community_private.protect_staff_fanart_submission() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.my_staff_removal(),public.staff_appeal_removal(bigint,text),
 public.staff_pending_role_appeals(),public.staff_decide_role_appeal(uuid,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.my_staff_removal(),public.staff_appeal_removal(bigint,text),
 public.staff_pending_role_appeals(),public.staff_decide_role_appeal(uuid,boolean,text) TO authenticated;
