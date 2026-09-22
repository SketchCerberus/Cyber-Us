-- Staff-only moderation visibility is scoped by the target account at the database boundary.
-- Never let a regular member use the helper to probe staff membership.
CREATE OR REPLACE FUNCTION public.moderator_can_handle(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT community_private.staff_role(auth.uid()) IS NOT NULL AND
 (community_private.staff_role(auth.uid())='creator' OR
  (p_user_id IS NOT NULL AND NOT EXISTS
   (SELECT 1 FROM community_private.staff s WHERE s.user_id=p_user_id)))
$$;
DROP POLICY comments_read_authenticated ON public.comments;
CREATE POLICY comments_read_authenticated ON public.comments FOR SELECT TO authenticated
 USING (((status='visible' AND EXISTS
  (SELECT 1 FROM public.episodes e WHERE e.slug=episode_slug AND e.community_enabled))
  OR author_id=(SELECT auth.uid()) OR
  ((SELECT public.is_moderator()) AND public.moderator_can_handle(author_id))));
DROP POLICY fanart_report_staff_read ON public.fanart_comment_reports;
CREATE POLICY fanart_report_staff_read ON public.fanart_comment_reports FOR SELECT TO authenticated
 USING ((SELECT public.is_moderator()) AND public.moderator_can_handle(
  (SELECT c.author_id FROM public.fanart_comments c WHERE c.id=comment_id)));
DROP POLICY fanart_report_staff_update ON public.fanart_comment_reports;
CREATE POLICY fanart_report_staff_update ON public.fanart_comment_reports FOR UPDATE TO authenticated
 USING ((SELECT public.is_moderator()) AND public.moderator_can_handle(
  (SELECT c.author_id FROM public.fanart_comments c WHERE c.id=comment_id)))
 WITH CHECK ((SELECT public.is_moderator()) AND public.moderator_can_handle(
  (SELECT c.author_id FROM public.fanart_comments c WHERE c.id=comment_id)));
CREATE OR REPLACE FUNCTION community_private.protect_staff_report() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.fanart_comments c
  JOIN community_private.staff s ON s.user_id=c.author_id WHERE c.id=OLD.comment_id)
 AND community_private.staff_role(auth.uid()) IS DISTINCT FROM 'creator' THEN
  RAISE EXCEPTION 'Creator handles staff reports' USING errcode='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.moderation_comment_edit_history(p_kind text,p_id text)
RETURNS TABLE(prior_text text,edited_at timestamptz,editor_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF community_private.staff_role(auth.uid()) IS NULL THEN
  RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 IF p_kind='episode' AND p_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN
  RETURN QUERY SELECT h.previous_body,h.edited_at,h.editor_id
  FROM community_private.comment_edit_history h
  JOIN public.comments c ON c.id=h.episode_comment_id
  WHERE h.kind='episode' AND h.episode_comment_id=p_id::uuid
   AND public.moderator_can_handle(c.author_id)
  ORDER BY h.edited_at DESC LIMIT 50;
 ELSIF p_kind='fanart' AND p_id ~ '^[0-9]{1,19}$' THEN
  RETURN QUERY SELECT h.previous_body,h.edited_at,h.editor_id
  FROM community_private.comment_edit_history h
  JOIN public.fanart_comments c ON c.id=h.fanart_comment_id
  WHERE h.kind='fanart' AND h.fanart_comment_id=p_id::bigint
   AND public.moderator_can_handle(c.author_id)
  ORDER BY h.edited_at DESC LIMIT 50;
 ELSE RAISE EXCEPTION 'Invalid comment identifier' USING errcode='22023'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.moderation_recent_comment_edits(p_limit integer DEFAULT 30)
RETURNS TABLE(kind text,comment_id text,prior_text text,edited_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF community_private.staff_role(auth.uid()) IS NULL THEN
  RAISE EXCEPTION 'Moderator required' USING errcode='42501'; END IF;
 RETURN QUERY SELECT h.kind,coalesce(h.episode_comment_id::text,h.fanart_comment_id::text),
 h.previous_body,h.edited_at FROM community_private.comment_edit_history h
 LEFT JOIN public.comments c ON h.kind='episode' AND c.id=h.episode_comment_id
 LEFT JOIN public.fanart_comments f ON h.kind='fanart' AND f.id=h.fanart_comment_id
 WHERE (c.id IS NOT NULL AND public.moderator_can_handle(c.author_id)) OR
 (f.id IS NOT NULL AND public.moderator_can_handle(f.author_id))
 ORDER BY h.edited_at DESC LIMIT least(greatest(coalesce(p_limit,30),1),50);
END $$;
