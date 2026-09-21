-- Additive migration: historic bans remain 'unspecified' until staff reviews them.
ALTER TABLE community_private.bans ADD COLUMN category text NOT NULL DEFAULT 'unspecified'
  CONSTRAINT bans_category_check CHECK (category IN ('unspecified','rule_violation','inappropriate_content','harassment','spam','other'));

CREATE TABLE community_private.ban_category_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ban_id uuid NOT NULL REFERENCES community_private.bans(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  previous_category text NOT NULL,
  category text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE community_private.ban_category_changes ENABLE ROW LEVEL SECURITY;

CREATE TABLE community_private.ban_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_id uuid NOT NULL UNIQUE REFERENCES community_private.bans(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 20 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  decision_note text,
  CONSTRAINT ban_appeal_review_consistency CHECK (
    (status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND decision_note IS NULL)
    OR (status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND decision_note IS NOT NULL)
  )
);
ALTER TABLE community_private.ban_appeals ENABLE ROW LEVEL SECURITY;
CREATE INDEX ban_appeals_pending_idx ON community_private.ban_appeals(created_at,id) WHERE status='pending';
CREATE INDEX ban_appeals_user_idx ON community_private.ban_appeals(user_id,created_at DESC);

-- New issuance requires a category and delegates existing ban validation/audit to the original function.
CREATE FUNCTION public.ban_member_categorized(p_user_id uuid,p_reason text,p_expires_at timestamptz,p_category text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501'; END IF;
  IF p_category IS NULL OR p_category NOT IN ('rule_violation','inappropriate_content','harassment','spam','other') THEN
    RAISE EXCEPTION 'Invalid ban category' USING errcode='22023'; END IF;
  v_id := community_private.ban_member(p_user_id,p_reason,p_expires_at);
  UPDATE community_private.bans SET category=p_category WHERE id=v_id;
  RETURN v_id;
END;
$fn$;

CREATE FUNCTION public.moderation_active_ban_categories()
RETURNS TABLE(ban_id uuid,user_id uuid,category text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501'; END IF;
  RETURN QUERY SELECT b.id,b.user_id,b.category FROM community_private.bans b
    WHERE b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>now())
    ORDER BY b.issued_at DESC,b.id DESC LIMIT 100;
END;
$fn$;

CREATE FUNCTION public.moderation_classify_ban(p_ban_id uuid,p_category text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_actor uuid := auth.uid(); v_old text;
BEGIN
  IF v_actor IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501'; END IF;
  IF p_category IS NULL OR p_category NOT IN ('rule_violation','inappropriate_content','harassment','spam','other') THEN
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

-- No user ID argument: the caller only sees their own currently active ban.
CREATE FUNCTION public.my_active_ban_details()
RETURNS TABLE(ban_id uuid,category text,reason text,issued_at timestamptz,expires_at timestamptz,
  appeal_status text,appeal_created_at timestamptz,decision_note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING errcode='42501'; END IF;
  RETURN QUERY SELECT b.id,b.category,b.reason,b.issued_at,b.expires_at,a.status,a.created_at,a.decision_note
    FROM community_private.bans b
    LEFT JOIN community_private.ban_appeals a ON a.ban_id=b.id AND a.user_id=auth.uid()
    WHERE b.user_id=auth.uid() AND b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>now())
    ORDER BY b.issued_at DESC,b.id DESC LIMIT 1;
END;
$fn$;

CREATE FUNCTION public.submit_ban_appeal(p_ban_id uuid,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required' USING errcode='42501'; END IF;
  IF p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION 'Appeal must be 20-2000 characters' USING errcode='22023'; END IF;
  PERFORM 1 FROM community_private.bans b WHERE b.id=p_ban_id AND b.user_id=v_user
    AND b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>now()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active ban belonging to this account' USING errcode='42501'; END IF;
  INSERT INTO community_private.ban_appeals(ban_id,user_id,body)
    VALUES(p_ban_id,v_user,btrim(p_body)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

CREATE FUNCTION public.moderation_pending_appeals()
RETURNS TABLE(appeal_id uuid,ban_id uuid,user_id uuid,display_name text,category text,
  ban_reason text,appeal_body text,appeal_created_at timestamptz,expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501'; END IF;
  RETURN QUERY SELECT a.id,b.id,a.user_id,p.display_name,b.category,b.reason,a.body,a.created_at,b.expires_at
    FROM community_private.ban_appeals a JOIN community_private.bans b ON b.id=a.ban_id
    LEFT JOIN public.profiles p ON p.id=a.user_id
    WHERE a.status='pending' ORDER BY a.created_at ASC,a.id ASC LIMIT 100;
END;
$fn$;

-- Approval revokes only the appealed ban, never a newer unrelated punishment.
CREATE FUNCTION public.moderation_decide_appeal(p_appeal_id uuid,p_approve boolean,p_note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_actor uuid := auth.uid(); v_appeal community_private.ban_appeals%ROWTYPE; v_revoked integer;
BEGIN
  IF v_actor IS NULL OR NOT community_private.is_moderator() THEN
    RAISE EXCEPTION 'Moderator access required' USING errcode='42501'; END IF;
  IF p_approve IS NULL OR p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Decision note must be 5-500 characters' USING errcode='22023'; END IF;
  SELECT * INTO v_appeal FROM community_private.ban_appeals WHERE id=p_appeal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appeal not found' USING errcode='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cyber-us-ban-'||v_appeal.user_id::text,0));
  SELECT * INTO v_appeal FROM community_private.ban_appeals WHERE id=p_appeal_id FOR UPDATE;
  IF v_appeal.status<>'pending' THEN RAISE EXCEPTION 'Appeal already reviewed' USING errcode='22023'; END IF;
  UPDATE community_private.ban_appeals SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by=v_actor,reviewed_at=now(),decision_note=btrim(p_note) WHERE id=p_appeal_id;
  IF p_approve THEN
    UPDATE community_private.bans SET revoked_at=now(),revoked_by=v_actor
      WHERE id=v_appeal.ban_id AND user_id=v_appeal.user_id AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at>now());
    GET DIAGNOSTICS v_revoked=ROW_COUNT;
    IF v_revoked>0 THEN INSERT INTO community_private.moderation_log(actor_id,target_id,action,reason)
      VALUES(v_actor,v_appeal.user_id,'unban','Appeal approved: '||btrim(p_note)); END IF;
  END IF;
  RETURN true;
END;
$fn$;

-- Private tables have RLS and no direct API grants. Each RPC validates auth.uid/role.
REVOKE ALL ON FUNCTION public.ban_member_categorized(uuid,text,timestamptz,text),
  public.moderation_active_ban_categories(),public.moderation_classify_ban(uuid,text),
  public.my_active_ban_details(),public.submit_ban_appeal(uuid,text),
  public.moderation_pending_appeals(),public.moderation_decide_appeal(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ban_member_categorized(uuid,text,timestamptz,text),
  public.moderation_active_ban_categories(),public.moderation_classify_ban(uuid,text),
  public.my_active_ban_details(),public.submit_ban_appeal(uuid,text),
  public.moderation_pending_appeals(),public.moderation_decide_appeal(uuid,boolean,text) TO authenticated;
