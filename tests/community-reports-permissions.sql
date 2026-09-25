-- Run against the configured Supabase database. Everything, including users, is rolled back.
BEGIN;
DO $$
DECLARE reporter uuid:=gen_random_uuid(); author uuid:=gen_random_uuid(); staff_member uuid:=gen_random_uuid();
 creator uuid; root uuid:=gen_random_uuid(); reply uuid:=gen_random_uuid(); hidden uuid:=gen_random_uuid(); staff_comment uuid:=gen_random_uuid();
 art uuid:=gen_random_uuid(); pending_art uuid:=gen_random_uuid(); fc bigint; removed_fc bigint; rid bigint; art_report bigint; legacy bigint; n integer;
BEGIN
 SELECT user_id INTO creator FROM community_private.staff WHERE role='creator' LIMIT 1;
 IF creator IS NULL THEN RAISE EXCEPTION 'Creator role required for hierarchy test'; END IF;
 INSERT INTO auth.users(id,email,email_confirmed_at,is_anonymous) VALUES
 (reporter,reporter::text||'@example.invalid',now(),false),(author,author::text||'@example.invalid',now(),false),(staff_member,staff_member::text||'@example.invalid',now(),false);
 INSERT INTO community_private.staff(user_id,role) VALUES(staff_member,'moderator');
 PERFORM set_config('request.jwt.claim.sub',author::text,true);
 INSERT INTO public.comments(id,episode_slug,author_id,body,created_at) VALUES(root,'episodio-01',author,'Report fixture root','2000-01-01');
 INSERT INTO public.comments(id,episode_slug,author_id,body,parent_id,created_at) VALUES(reply,'episodio-01',author,'Report fixture reply',root,'2000-01-01');
 INSERT INTO public.comments(id,episode_slug,author_id,body,status,created_at) VALUES(hidden,'episodio-01',author,'Report fixture hidden','hidden','2000-01-01');
 INSERT INTO public.fanart_submissions(id,user_id,artist_name,title,extension,image_path,rights_confirmed,status) VALUES
 (art,author,'Fixture artist','Fixture artwork','png',author::text||'/'||art::text||'.png',true,'approved'),
 (pending_art,author,'Private artist','Private artwork','png',author::text||'/'||pending_art::text||'.png',true,'pending');
 INSERT INTO public.fanart_gallery(submission_id,title,artist_name,accent,image_path) VALUES(art,'Fixture artwork','Fixture artist','blue',art::text||'.png');
 INSERT INTO public.fanart_comments(submission_id,author_id,display_name,body) VALUES(art,author,'Fixture artist','Fanart report fixture') RETURNING id INTO fc;
 INSERT INTO public.fanart_comments(submission_id,author_id,display_name,body,deleted_at) VALUES(art,author,'Fixture artist','Deleted fixture',now()) RETURNING id INTO removed_fc;
 PERFORM set_config('request.jwt.claim.sub',staff_member::text,true);
 INSERT INTO public.comments(id,episode_slug,author_id,body,created_at) VALUES(staff_comment,'episodio-01',staff_member,'Staff fixture','2000-01-01');
 -- Guests cannot reach the mutation or private queue.
 SET LOCAL ROLE anon;
 BEGIN PERFORM public.submit_content_report('episode_comment',root::text,'spam',''); RAISE EXCEPTION 'Guest submitted' USING errcode='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.list_content_reports(); RAISE EXCEPTION 'Guest read queue' USING errcode='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 -- Authors cannot report their own content in any surface.
 PERFORM set_config('request.jwt.claim.sub',author::text,true);
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.submit_content_report('episode_comment',root::text,'spam',''); RAISE EXCEPTION 'Self report' USING errcode='XX000'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.submit_content_report('fanart_comment',fc::text,'spam',''); RAISE EXCEPTION 'Self fanart comment report' USING errcode='XX000'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.submit_content_report('fanart',art::text,'spam',''); RAISE EXCEPTION 'Self artwork report' USING errcode='XX000'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',reporter::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM public.submit_content_report('episode_comment',root::text,'harassment','fixture');
 PERFORM public.submit_content_report('episode_comment',reply::text,'spam','reply');
 PERFORM public.submit_content_report('fanart_comment',fc::text,'spoiler','unmarked');
 PERFORM public.submit_content_report('fanart',art::text,'copyright','details');
 PERFORM public.submit_content_report('episode_comment',staff_comment::text,'other','staff');
 BEGIN PERFORM public.submit_content_report('episode_comment',root::text,'spam','again'); RAISE EXCEPTION 'Duplicate episode' USING errcode='XX000'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN INSERT INTO public.fanart_comment_reports(comment_id,reason) VALUES(fc,'spam'); RAISE EXCEPTION 'Duplicate legacy' USING errcode='XX000'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN PERFORM public.submit_content_report('fanart',art::text,'spam','again'); RAISE EXCEPTION 'Duplicate art' USING errcode='XX000'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN PERFORM public.submit_content_report('fanart',pending_art::text,'spam',''); RAISE EXCEPTION 'Private artwork accepted' USING errcode='XX000'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.submit_content_report('episode_comment',hidden::text,'spam',''); RAISE EXCEPTION 'Hidden comment accepted' USING errcode='XX000'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.submit_content_report('fanart_comment',removed_fc::text,'spam',''); RAISE EXCEPTION 'Deleted comment accepted' USING errcode='XX000'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.submit_content_report('episode_comment',gen_random_uuid()::text,'spam',''); RAISE EXCEPTION 'Missing target accepted' USING errcode='XX000'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.submit_content_report('episode_comment',root::text,'invalid',''); RAISE EXCEPTION 'Invalid reason accepted' USING errcode='XX000'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.submit_content_report('episode_comment',root::text,'other',repeat('a',301)); RAISE EXCEPTION 'Long details accepted' USING errcode='XX000'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM * FROM public.list_content_reports(); RAISE EXCEPTION 'Member saw queue' USING errcode='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM community_private.content_reports; RAISE EXCEPTION 'Member saw private ledger' USING errcode='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM reporter_id FROM public.fanart_comment_reports; RAISE EXCEPTION 'Reporter leaked' USING errcode='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 SELECT id INTO rid FROM community_private.content_reports WHERE target_id=root::text AND reporter_id=reporter;
 SELECT id INTO art_report FROM community_private.content_reports WHERE target_id=art::text AND reporter_id=reporter;
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.resolve_content_report(rid,'dismiss','unauthorized'); RAISE EXCEPTION 'Member moderated' USING errcode='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 -- Unverified, anonymous and banned accounts are rejected by the server itself.
 UPDATE auth.users SET email_confirmed_at=NULL WHERE id=reporter;
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.submit_content_report('episode_comment',reply::text,'spam',''); RAISE EXCEPTION 'Unverified accepted' USING errcode='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 UPDATE auth.users SET email_confirmed_at=now(),is_anonymous=true WHERE id=reporter;
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.submit_content_report('episode_comment',reply::text,'spam',''); RAISE EXCEPTION 'Anonymous account accepted' USING errcode='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 UPDATE auth.users SET is_anonymous=false WHERE id=reporter;
 INSERT INTO community_private.bans(user_id,reason) VALUES(reporter,'Fixture ban');
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.submit_content_report('episode_comment',reply::text,'spam',''); RAISE EXCEPTION 'Banned accepted' USING errcode='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 DELETE FROM community_private.bans WHERE user_id=reporter;
 -- Fill quota without touching real accounts. Both old and new endpoints must share it.
 INSERT INTO community_private.content_reports(kind,target_id,reporter_id,target_author,reason,evidence,context)
 SELECT 'episode_comment',gen_random_uuid()::text,reporter,author,'spam','quota fixture','episodio-01' FROM generate_series(1,15);
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.submit_content_report('episode_comment',reply::text,'spam',''); RAISE EXCEPTION 'Quota bypass' USING errcode='XX000'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'Report daily limit reached' THEN RAISE; END IF; END;
 BEGIN INSERT INTO public.fanart_comment_reports(comment_id,reason) VALUES(fc,'spam'); RAISE EXCEPTION 'Legacy quota bypass' USING errcode='XX000'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'Report daily limit reached' THEN RAISE; END IF; END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',staff_member::text,true);
 SET LOCAL ROLE authenticated;
 IF EXISTS(SELECT 1 FROM public.list_content_reports() WHERE target_id=staff_comment::text) THEN RAISE EXCEPTION 'Staff report visible to moderator'; END IF;
 BEGIN PERFORM public.resolve_content_report(rid,'dismiss','x'); RAISE EXCEPTION 'No reason validation' USING errcode='XX000'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF NOT public.resolve_content_report(rid,'dismiss','No violation found') THEN RAISE EXCEPTION 'Dismiss failed'; END IF;
 IF public.resolve_content_report(rid,'remove','Second decision') THEN RAISE EXCEPTION 'Decision overwritten'; END IF;
 RESET ROLE;
 SELECT id INTO rid FROM community_private.content_reports WHERE target_id=staff_comment::text AND reporter_id=reporter;
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.resolve_content_report(rid,'dismiss','Cannot handle staff'); RAISE EXCEPTION 'Hierarchy bypass' USING errcode='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',creator::text,true);
 SET LOCAL ROLE authenticated;
 IF NOT public.resolve_content_report(rid,'dismiss','Creator review') THEN RAISE EXCEPTION 'Creator denied'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',staff_member::text,true);
 SELECT id,legacy_id INTO rid,legacy FROM community_private.content_reports WHERE target_id=fc::text AND kind='fanart_comment' AND reporter_id=reporter;
 SET LOCAL ROLE authenticated;
 IF NOT public.resolve_content_report(rid,'remove','Verified violation') THEN RAISE EXCEPTION 'Comment moderation failed'; END IF;
 RESET ROLE;
 IF NOT EXISTS(SELECT 1 FROM public.fanart_comments WHERE id=fc AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Comment remained public'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fanart_comment_reports WHERE id=legacy AND status='dismissed') THEN RAISE EXCEPTION 'Legacy not synchronized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM community_private.content_reports WHERE id=rid AND status='resolved' AND handled_by=staff_member AND resolution_reason='Verified violation') THEN RAISE EXCEPTION 'Audit missing'; END IF;
 SELECT id INTO rid FROM community_private.content_reports WHERE target_id=reply::text AND reporter_id=reporter;
 SET LOCAL ROLE authenticated;
 PERFORM public.resolve_content_report(rid,'remove','Reply violation');
 -- Artwork cannot be unpublished without a private backup.
 BEGIN PERFORM public.resolve_content_report(art_report,'remove','Artwork violation'); RAISE EXCEPTION 'Backup requirement bypass' USING errcode='XX000'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 RESET ROLE;
 -- Synthetic storage metadata only, no actual object or upload; transaction is rolled back.
 INSERT INTO storage.objects(bucket_id,name) VALUES('fanart-trash',art::text||'.png');
 SET LOCAL ROLE authenticated;
 IF NOT public.resolve_content_report(art_report,'remove','Artwork violation') THEN RAISE EXCEPTION 'Artwork moderation failed'; END IF;
 RESET ROLE;
 IF EXISTS(SELECT 1 FROM public.fanart_gallery WHERE submission_id=art) THEN RAISE EXCEPTION 'Artwork remained in gallery'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fanart_submissions WHERE id=art AND status='rejected' AND trash_bucket='fanart-trash' AND purge_after>now()) THEN RAISE EXCEPTION 'Private retention lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fanart_submissions WHERE id=pending_art AND status='pending') THEN RAISE EXCEPTION 'Private submission changed'; END IF;
 -- Evidence survives deletion (no content FK cascade).
 DELETE FROM public.comments WHERE id=reply;
 IF NOT EXISTS(SELECT 1 FROM community_private.content_reports WHERE target_id=reply::text AND evidence='Report fixture reply') THEN RAISE EXCEPTION 'Evidence lost'; END IF;
 -- Expired trash must stay while any new-style report remains open.
 UPDATE public.comments SET status='removed' WHERE id=root;
 UPDATE public.comments SET purge_after=now()-interval '1 day' WHERE id=root;
 UPDATE public.fanart_comments SET purge_after=now()-interval '1 day' WHERE id=fc;
 UPDATE public.fanart_submissions SET purge_after=now()-interval '1 day' WHERE id=art;
 INSERT INTO community_private.content_reports(kind,target_id,reporter_id,target_author,reason,evidence,context) VALUES
 ('episode_comment',root::text,staff_member,author,'spam','retention root','episodio-01'),
 ('fanart_comment',fc::text,staff_member,author,'spam','retention comment',art::text),
 ('fanart',art::text,staff_member,author,'spam','retention artwork',art::text||'.png');
 PERFORM * FROM community_private.purge_expired_comments();
 IF NOT EXISTS(SELECT 1 FROM public.comments WHERE id=root) OR NOT EXISTS(SELECT 1 FROM public.fanart_comments WHERE id=fc) THEN RAISE EXCEPTION 'Open report evidence purged'; END IF;
 SET LOCAL ROLE service_role;
 IF EXISTS(SELECT 1 FROM public.trash_due_fanarts() WHERE id=art) THEN RAISE EXCEPTION 'Unresolved artwork scheduled for purge'; END IF;
 IF public.trash_finalize_fanart(art) THEN RAISE EXCEPTION 'Unresolved artwork purged'; END IF;
 RESET ROLE;
 UPDATE community_private.content_reports SET status='dismissed',handled_at=now(),handled_by=creator,resolution_reason='Retention test complete' WHERE reporter_id=staff_member;
 SET LOCAL ROLE service_role;
 IF NOT EXISTS(SELECT 1 FROM public.trash_due_fanarts() WHERE id=art) THEN RAISE EXCEPTION 'Resolved artwork not eligible'; END IF;
 RESET ROLE;
 PERFORM * FROM community_private.purge_expired_comments();
 IF EXISTS(SELECT 1 FROM public.comments WHERE id=root) OR EXISTS(SELECT 1 FROM public.fanart_comments WHERE id=fc) THEN RAISE EXCEPTION 'Resolved expired comments not purged'; END IF;
 IF NOT EXISTS(SELECT 1 FROM community_private.content_reports WHERE reporter_id=staff_member AND target_id=fc::text AND evidence='retention comment') THEN RAISE EXCEPTION 'Audit lost after purge'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: reporting roles, privacy, duplicates, legacy compatibility, global quota, hierarchy, decisions, retention and rollback' AS result;
