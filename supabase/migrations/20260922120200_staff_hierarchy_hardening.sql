-- Every legacy entry point must respect the role of the TARGET, including staff content.
CREATE FUNCTION public.moderator_can_handle(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE
 SECURITY DEFINER SET search_path='' AS $$
 SELECT community_private.staff_role(auth.uid())='creator' OR NOT EXISTS
 (SELECT 1 FROM community_private.staff s WHERE s.user_id=p_user_id)
$$;
REVOKE ALL ON FUNCTION public.moderator_can_handle(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_can_handle(uuid) TO authenticated;
DROP POLICY fanart_moderator_read ON public.fanart_submissions;
CREATE POLICY fanart_moderator_read ON public.fanart_submissions FOR SELECT TO authenticated
 USING ((SELECT public.is_moderator()) AND public.moderator_can_handle(user_id));
-- Owner's own RLS SELECT policy remains unchanged.
CREATE FUNCTION public.creator_ban_staff(p_user_id uuid,p_reason text,p_expires_at timestamptz DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF community_private.staff_role(auth.uid()) IS DISTINCT FROM 'creator' THEN
  RAISE EXCEPTION 'Creator permission required' USING errcode='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM community_private.staff WHERE user_id=p_user_id AND role<>'creator') THEN
  RAISE EXCEPTION 'Only another staff member can be targeted here' USING errcode='42501'; END IF;
 RETURN community_private.ban_member(p_user_id,p_reason,p_expires_at);
END $$;
REVOKE ALL ON FUNCTION public.creator_ban_staff(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.creator_ban_staff(uuid,text,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.moderation_active_ban_categories()
 RETURNS TABLE(ban_id uuid,user_id uuid,category text) LANGUAGE plpgsql STABLE
 SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text:=community_private.staff_role(auth.uid());
BEGIN
 IF v_role IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 RETURN QUERY SELECT b.id,b.user_id,b.category FROM community_private.bans b
 WHERE b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>now())
 AND (v_role='creator' OR (b.target_staff_role IS NULL AND NOT EXISTS
 (SELECT 1 FROM community_private.staff s WHERE s.user_id=b.user_id)))
 ORDER BY b.issued_at DESC,b.id DESC LIMIT 100;
END $$;
CREATE OR REPLACE FUNCTION community_private.moderation_active_bans()
 RETURNS TABLE(user_id uuid,display_name text,reason text,issued_at timestamptz,expires_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text:=community_private.staff_role(auth.uid());
BEGIN
 IF v_role IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 RETURN QUERY SELECT b.user_id,p.display_name,b.reason,b.issued_at,b.expires_at
 FROM community_private.bans b LEFT JOIN public.profiles p ON p.id=b.user_id
 WHERE b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>now())
 AND (v_role='creator' OR (b.target_staff_role IS NULL AND NOT EXISTS
  (SELECT 1 FROM community_private.staff s WHERE s.user_id=b.user_id)))
 ORDER BY b.issued_at DESC LIMIT 100;
END $$;
CREATE OR REPLACE FUNCTION public.moderation_active_bans_with_history()
 RETURNS TABLE(user_id uuid,display_name text,reason text,issued_at timestamptz,
 expires_at timestamptz,account_created_at timestamptz,ban_count bigint,days_banned numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text:=community_private.staff_role(auth.uid());
BEGIN
 IF v_role IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 RETURN QUERY WITH active AS (
 SELECT b.id,b.user_id,b.reason,b.issued_at,b.expires_at FROM community_private.bans b
 WHERE b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>now())
 AND (v_role='creator' OR (b.target_staff_role IS NULL AND NOT EXISTS
  (SELECT 1 FROM community_private.staff s WHERE s.user_id=b.user_id)))
 ORDER BY b.issued_at DESC,b.id DESC LIMIT 100),
 history AS (SELECT b.user_id,count(*)::bigint ban_count,
 round(sum(greatest(0::numeric,extract(epoch FROM
 (least(coalesce(b.revoked_at,now()),coalesce(b.expires_at,now()),now())-b.issued_at))::numeric))/86400,2) days_banned
 FROM community_private.bans b WHERE b.user_id IN (SELECT a.user_id FROM active a) GROUP BY b.user_id)
 SELECT a.user_id,p.display_name,a.reason,a.issued_at,a.expires_at,u.created_at,h.ban_count,h.days_banned
 FROM active a JOIN auth.users u ON u.id=a.user_id JOIN history h ON h.user_id=a.user_id
 LEFT JOIN public.profiles p ON p.id=a.user_id ORDER BY a.issued_at DESC,a.id DESC;
END $$;
CREATE OR REPLACE FUNCTION public.moderation_classify_ban(p_ban_id uuid,p_category text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_role text:=community_private.staff_role(auth.uid());
 v_old text;v_target uuid;v_staff_role text;
BEGIN
 IF v_role IS NULL THEN RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF p_category NOT IN ('rule_violation','inappropriate_content','harassment','spam','other','fanart_violation') THEN
  RAISE EXCEPTION 'Invalid category' USING errcode='22023'; END IF;
 SELECT b.category,b.user_id,b.target_staff_role INTO v_old,v_target,v_staff_role
 FROM community_private.bans b WHERE b.id=p_ban_id AND b.revoked_at IS NULL
 AND (b.expires_at IS NULL OR b.expires_at>now()) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active ban not found' USING errcode='22023'; END IF;
 IF v_role<>'creator' AND (v_staff_role IS NOT NULL OR EXISTS
 (SELECT 1 FROM community_private.staff s WHERE s.user_id=v_target)) THEN
  RAISE EXCEPTION 'Creator required for staff ban' USING errcode='42501'; END IF;
 IF v_old IS DISTINCT FROM p_category THEN
  UPDATE community_private.bans SET category=p_category WHERE id=p_ban_id;
  INSERT INTO community_private.ban_category_changes(ban_id,actor_id,previous_category,category)
  VALUES(p_ban_id,v_actor,v_old,p_category);
 END IF;
 RETURN true;
END $$;
-- A report on a staff member's comment cannot be resolved by a lower-level moderator.
CREATE FUNCTION community_private.protect_staff_report() RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND EXISTS
 (SELECT 1 FROM public.fanart_comments c JOIN community_private.staff s ON s.user_id=c.author_id
 WHERE c.id=OLD.comment_id)
 AND community_private.staff_role(auth.uid()) IS DISTINCT FROM 'creator' THEN
  RAISE EXCEPTION 'Creator handles staff reports' USING errcode='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fanart_report_staff_protection BEFORE UPDATE ON public.fanart_comment_reports
 FOR EACH ROW EXECUTE FUNCTION community_private.protect_staff_report();
REVOKE ALL ON FUNCTION community_private.protect_staff_report() FROM PUBLIC,anon,authenticated;
-- Editorial picks on staff-owned art require the creator as well.
CREATE FUNCTION community_private.protect_staff_feature() RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.featured IS DISTINCT FROM OLD.featured AND EXISTS
 (SELECT 1 FROM public.fanart_submissions f JOIN community_private.staff s ON s.user_id=f.user_id
 WHERE f.id=OLD.submission_id)
 AND community_private.staff_role(auth.uid()) IS DISTINCT FROM 'creator' THEN
  RAISE EXCEPTION 'Creator handles staff artwork' USING errcode='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fanart_feature_staff_protection BEFORE UPDATE OF featured ON public.fanart_gallery
 FOR EACH ROW EXECUTE FUNCTION community_private.protect_staff_feature();
REVOKE ALL ON FUNCTION community_private.protect_staff_feature() FROM PUBLIC,anon,authenticated;
