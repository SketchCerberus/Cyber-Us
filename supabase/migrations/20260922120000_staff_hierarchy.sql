-- Cyber-Us staff hierarchy. The only existing admin becomes the immutable Creator.
DO $$ BEGIN
 IF (SELECT count(*) FROM community_private.staff WHERE role='admin') <> 1 THEN
  RAISE EXCEPTION 'Expected exactly one existing admin; no roles changed';
 END IF;
END $$;
ALTER TABLE community_private.staff DROP CONSTRAINT staff_role_check;
UPDATE community_private.staff SET role='creator' WHERE role='admin';
ALTER TABLE community_private.staff ADD CONSTRAINT staff_role_check
 CHECK(role IN ('creator','right_hand','moderator'));
CREATE UNIQUE INDEX staff_one_creator ON community_private.staff(role) WHERE role='creator';
CREATE TABLE community_private.creator_anchor(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT);
INSERT INTO community_private.creator_anchor SELECT user_id FROM community_private.staff WHERE role='creator';
REVOKE ALL ON community_private.creator_anchor FROM PUBLIC,anon,authenticated;
CREATE FUNCTION community_private.protect_creator() RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.user_id IN (SELECT user_id FROM community_private.creator_anchor) THEN
   RAISE EXCEPTION 'Creator cannot be removed' USING errcode='42501';
  END IF;
  RETURN OLD;
 END IF;
 IF NEW.role='creator' AND NEW.user_id NOT IN (SELECT user_id FROM community_private.creator_anchor) THEN
  RAISE EXCEPTION 'Only the original creator has this role' USING errcode='42501';
 END IF;
 IF TG_OP='UPDATE' AND OLD.user_id IN (SELECT user_id FROM community_private.creator_anchor)
  AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.role IS DISTINCT FROM OLD.role) THEN
  RAISE EXCEPTION 'Creator role is immutable' USING errcode='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER staff_protect_creator BEFORE INSERT OR UPDATE OR DELETE ON community_private.staff
 FOR EACH ROW EXECUTE FUNCTION community_private.protect_creator();
REVOKE ALL ON FUNCTION community_private.protect_creator() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION community_private.staff_role(p_user uuid) RETURNS text LANGUAGE sql STABLE
 SECURITY DEFINER SET search_path='' AS $$
 SELECT s.role FROM community_private.staff s WHERE s.user_id=p_user
 AND (s.role='creator' OR NOT EXISTS(
  SELECT 1 FROM community_private.bans b WHERE b.user_id=p_user AND b.revoked_at IS NULL
   AND (b.expires_at IS NULL OR b.expires_at>now())))
$$;
REVOKE ALL ON FUNCTION community_private.staff_role(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION community_private.is_moderator() RETURNS boolean LANGUAGE sql STABLE
 SECURITY DEFINER SET search_path='' AS $$
 SELECT community_private.staff_role(auth.uid()) IS NOT NULL
$$;
CREATE FUNCTION public.my_staff_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path='' AS $$ SELECT community_private.staff_role(auth.uid()) $$;
REVOKE ALL ON FUNCTION public.my_staff_role() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.my_staff_role() TO authenticated;

CREATE TABLE community_private.staff_actions(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, target_id uuid NOT NULL REFERENCES auth.users(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id), action text NOT NULL
 CHECK(action IN ('grant','promote','demote','remove','ban','appeal_restore')),
 previous_role text, new_role text, reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 5 AND 500),
 created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE community_private.staff_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON community_private.staff_actions FROM PUBLIC,anon,authenticated;
CREATE TABLE community_private.staff_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requested_by uuid NOT NULL REFERENCES auth.users(id),
 target_id uuid NOT NULL REFERENCES auth.users(id), kind text NOT NULL
 CHECK(kind IN ('grant_normal','remove_normal','ban_normal')),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 5 AND 500),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), decided_by uuid REFERENCES auth.users(id),
 decided_at timestamptz, decision_note text,
 CHECK((status='pending' AND decided_by IS NULL AND decided_at IS NULL AND decision_note IS NULL)
  OR (status<>'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL
   AND char_length(btrim(decision_note)) BETWEEN 5 AND 500)));
CREATE UNIQUE INDEX staff_request_unique_pending ON community_private.staff_requests(target_id,kind) WHERE status='pending';
ALTER TABLE community_private.staff_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON community_private.staff_requests FROM PUBLIC,anon,authenticated;
CREATE TABLE community_private.staff_role_appeals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action_id bigint NOT NULL UNIQUE REFERENCES community_private.staff_actions(id),
 user_id uuid NOT NULL REFERENCES auth.users(id), body text NOT NULL CHECK(char_length(btrim(body)) BETWEEN 20 AND 2000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), decided_by uuid REFERENCES auth.users(id),
 decided_at timestamptz, decision_note text);
ALTER TABLE community_private.staff_role_appeals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON community_private.staff_role_appeals FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.staff_roster() RETURNS TABLE(user_id uuid,username text,display_name text,role text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text:=community_private.staff_role(auth.uid());
BEGIN
 IF v_role NOT IN ('creator','right_hand') OR v_role IS NULL THEN
  RAISE EXCEPTION 'Staff management permission required' USING errcode='42501'; END IF;
 RETURN QUERY SELECT s.user_id,p.username,p.display_name,s.role FROM community_private.staff s
 LEFT JOIN public.profiles p ON p.id=s.user_id
 WHERE v_role='creator' OR s.role='moderator' ORDER BY s.added_at;
END $$;
CREATE FUNCTION public.staff_assign(p_user_id uuid,p_role text,p_reason text) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_before text; v_actor uuid:=auth.uid();
BEGIN
 IF community_private.staff_role(v_actor) IS DISTINCT FROM 'creator' THEN
  RAISE EXCEPTION 'Creator approval required' USING errcode='42501'; END IF;
 IF p_user_id IS NULL OR p_user_id=v_actor OR p_role NOT IN ('moderator','right_hand','remove')
  OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN
  RAISE EXCEPTION 'Invalid staff action' USING errcode='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cyber-us-staff-'||p_user_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN
  RAISE EXCEPTION 'Account not found' USING errcode='22023'; END IF;
 SELECT role INTO v_before FROM community_private.staff WHERE user_id=p_user_id FOR UPDATE;
 IF v_before='creator' THEN RAISE EXCEPTION 'Creator cannot be modified' USING errcode='42501'; END IF;
 IF p_role='remove' THEN
  IF v_before IS NULL THEN RAISE EXCEPTION 'Not a moderator' USING errcode='22023'; END IF;
  DELETE FROM community_private.staff WHERE user_id=p_user_id;
 ELSE
  IF EXISTS(SELECT 1 FROM community_private.bans WHERE user_id=p_user_id AND revoked_at IS NULL
   AND (expires_at IS NULL OR expires_at>now())) THEN
   RAISE EXCEPTION 'Unban before granting permissions' USING errcode='42501'; END IF;
  INSERT INTO community_private.staff(user_id,role) VALUES(p_user_id,p_role)
  ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role;
 END IF;
 INSERT INTO community_private.staff_actions(target_id,actor_id,action,previous_role,new_role,reason)
 VALUES(p_user_id,v_actor,CASE WHEN p_role='remove' THEN 'remove' WHEN v_before IS NULL THEN 'grant'
  WHEN p_role='right_hand' THEN 'promote' ELSE 'demote' END,
  v_before,NULLIF(p_role,'remove'),btrim(p_reason));
 RETURN true;
END $$;
CREATE FUNCTION public.staff_request(p_user_id uuid,p_kind text,p_reason text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_role text; v_id uuid;
BEGIN
 IF community_private.staff_role(v_actor) IS DISTINCT FROM 'right_hand' THEN
  RAISE EXCEPTION 'Right Hand permission required' USING errcode='42501'; END IF;
 IF p_user_id IS NULL OR p_user_id=v_actor OR p_kind NOT IN ('grant_normal','remove_normal','ban_normal')
  OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN
  RAISE EXCEPTION 'Invalid staff request' USING errcode='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cyber-us-staff-'||p_user_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN
  RAISE EXCEPTION 'Account not found' USING errcode='22023'; END IF;
 SELECT role INTO v_role FROM community_private.staff WHERE user_id=p_user_id;
 IF (p_kind='grant_normal' AND v_role IS NOT NULL) OR
  (p_kind<>'grant_normal' AND v_role IS DISTINCT FROM 'moderator') THEN
  RAISE EXCEPTION 'Only normal moderators can be targeted' USING errcode='42501'; END IF;
 IF (SELECT count(*) FROM community_private.staff_requests WHERE requested_by=v_actor
  AND created_at>now()-interval '1 day')>=20 THEN
  RAISE EXCEPTION 'Daily request limit reached' USING errcode='42501'; END IF;
 INSERT INTO community_private.staff_requests(requested_by,target_id,kind,reason)
 VALUES(v_actor,p_user_id,p_kind,btrim(p_reason)) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
CREATE FUNCTION public.staff_pending_requests() RETURNS TABLE(
 request_id uuid,requested_by uuid,requester text,target_id uuid,target_name text,
 kind text,reason text,created_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF community_private.staff_role(auth.uid()) IS DISTINCT FROM 'creator' THEN
  RAISE EXCEPTION 'Creator permission required' USING errcode='42501'; END IF;
 RETURN QUERY SELECT r.id,r.requested_by,coalesce(p1.display_name,p1.username),r.target_id,
 coalesce(p2.display_name,p2.username),r.kind,r.reason,r.created_at
 FROM community_private.staff_requests r LEFT JOIN public.profiles p1 ON p1.id=r.requested_by
 LEFT JOIN public.profiles p2 ON p2.id=r.target_id WHERE r.status='pending' ORDER BY r.created_at LIMIT 100;
END $$;
CREATE FUNCTION public.staff_decide_request(p_request_id uuid,p_approve boolean,p_note text) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request community_private.staff_requests%ROWTYPE; v_role text; v_actor uuid:=auth.uid();
BEGIN
 IF community_private.staff_role(v_actor) IS DISTINCT FROM 'creator' THEN
  RAISE EXCEPTION 'Creator permission required' USING errcode='42501'; END IF;
 IF p_approve IS NULL OR char_length(btrim(coalesce(p_note,''))) NOT BETWEEN 5 AND 500 THEN
  RAISE EXCEPTION 'Decision reason must be 5-500 characters' USING errcode='22023'; END IF;
 SELECT * INTO v_request FROM community_private.staff_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_request.status<>'pending' THEN
  RAISE EXCEPTION 'Request not pending' USING errcode='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cyber-us-staff-'||v_request.target_id::text,0));
 SELECT role INTO v_role FROM community_private.staff WHERE user_id=v_request.target_id FOR UPDATE;
 IF p_approve THEN
  IF (v_request.kind='grant_normal' AND v_role IS NOT NULL) OR
   (v_request.kind<>'grant_normal' AND v_role IS DISTINCT FROM 'moderator') THEN
   RAISE EXCEPTION 'Target role changed; request no longer valid' USING errcode='42501'; END IF;
  IF v_request.kind='grant_normal' THEN
   PERFORM public.staff_assign(v_request.target_id,'moderator',v_request.reason);
  ELSIF v_request.kind='remove_normal' THEN
   PERFORM public.staff_assign(v_request.target_id,'remove',v_request.reason);
  ELSE
   PERFORM community_private.ban_member(v_request.target_id,v_request.reason,NULL);
  END IF;
 END IF;
 UPDATE community_private.staff_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 decided_by=v_actor,decided_at=now(),decision_note=btrim(p_note) WHERE id=p_request_id;
 RETURN true;
END $$;

-- Sensitive RPCs are granted narrowly; underlying tables remain entirely private.
REVOKE ALL ON FUNCTION public.staff_roster() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.staff_assign(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.staff_request(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.staff_pending_requests() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.staff_decide_request(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.staff_roster(),public.staff_assign(uuid,text,text),
 public.staff_request(uuid,text,text),public.staff_pending_requests(),
 public.staff_decide_request(uuid,boolean,text) TO authenticated;
