-- Fanarts are currently a static gallery without accounts or uploads. This change adds
-- a moderation reason category without fabricating submissions or altering existing bans.
-- Deploy this migration before publishing the fanarts moderation tab.
ALTER TABLE community_private.bans DROP CONSTRAINT bans_category_check;
ALTER TABLE community_private.bans ADD CONSTRAINT bans_category_check
  CHECK (category IN ('unspecified','rule_violation','inappropriate_content',
    'harassment','spam','other','fanart_violation'));

-- Keep the existing ban validations, staff restrictions, advisory lock, hidden-comments
-- behavior and moderation audit in community_private.ban_member().
CREATE OR REPLACE FUNCTION public.ban_member_categorized(
  p_user_id uuid, p_reason text, p_expires_at timestamptz, p_category text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501'; END IF;
  IF p_category IS NULL OR p_category NOT IN
    ('rule_violation','inappropriate_content','harassment','spam','other','fanart_violation') THEN
    RAISE EXCEPTION 'Invalid ban category' USING errcode='22023'; END IF;
  v_id := community_private.ban_member(p_user_id,p_reason,p_expires_at);
  UPDATE community_private.bans SET category=p_category WHERE id=v_id;
  RETURN v_id;
END;
$fn$;

-- Allow moderators to correct this category later, retaining the existing audit trail.
CREATE OR REPLACE FUNCTION public.moderation_classify_ban(p_ban_id uuid,p_category text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_actor uuid := auth.uid(); v_old text;
BEGIN
  IF v_actor IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501'; END IF;
  IF p_category IS NULL OR p_category NOT IN
    ('rule_violation','inappropriate_content','harassment','spam','other','fanart_violation') THEN
    RAISE EXCEPTION 'Invalid ban category' USING errcode='22023'; END IF;
  SELECT b.category INTO v_old FROM community_private.bans b WHERE b.id=p_ban_id
    AND b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>now()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active ban not found' USING errcode='22023'; END IF;
  IF v_old IS DISTINCT FROM p_category THEN
    UPDATE community_private.bans SET category=p_category WHERE id=p_ban_id;
    INSERT INTO community_private.ban_category_changes(ban_id,actor_id,previous_category,category)
      VALUES(p_ban_id,v_actor,v_old,p_category);
  END IF;
  RETURN true;
END;
$fn$;

-- Only signed-in callers can invoke these RPCs; each checks staff again internally.
REVOKE ALL ON FUNCTION public.ban_member_categorized(uuid,text,timestamptz,text),
  public.moderation_classify_ban(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ban_member_categorized(uuid,text,timestamptz,text),
  public.moderation_classify_ban(uuid,text) TO authenticated;
