BEGIN;
DO $$
DECLARE owner_id uuid:=gen_random_uuid(); work_id uuid:=gen_random_uuid(); comment_id uuid:=gen_random_uuid();
BEGIN
 INSERT INTO auth.users(id,aud,role,email,email_confirmed_at,is_anonymous,raw_user_meta_data) VALUES(owner_id,'authenticated','authenticated',owner_id||'@example.invalid',now(),false,'{"display_name":"Closure fixture"}');
 UPDATE public.profiles SET display_name='Closure fixture',avatar='fox' WHERE id=owner_id;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 INSERT INTO public.comments(id,episode_slug,author_id,body) VALUES(comment_id,'episodio-01',owner_id,'Preserved discussion');
 INSERT INTO public.fanart_submissions(id,user_id,artist_name,artist_link,title,extension,image_path,rights_confirmed,status) VALUES(work_id,owner_id,'Closure fixture','https://example.invalid','Temporary fixture','png',owner_id||'/'||work_id||'.png',true,'approved');
 INSERT INTO public.fanart_gallery(submission_id,title,artist_name,artist_link,accent,image_path) VALUES(work_id,'Temporary fixture','Closure fixture','https://example.invalid','blue',owner_id||'/'||work_id||'.png');
 INSERT INTO public.fanart_comments(submission_id,author_id,body) VALUES(work_id,owner_id,'Preserved fanart discussion');
 UPDATE auth.users SET deleted_at=now() WHERE id=owner_id;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=owner_id AND username IS NULL AND avatar IS NULL AND display_name='Conta excluída / Deleted account') THEN RAISE EXCEPTION 'Profile not anonymized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.comments WHERE id=comment_id AND body='Preserved discussion') THEN RAISE EXCEPTION 'Discussion lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fanart_gallery WHERE submission_id=work_id AND artist_name='Conta excluída / Deleted account' AND artist_link IS NULL AND region IS NULL) THEN RAISE EXCEPTION 'Fanart identity retained'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fanart_comments WHERE submission_id=work_id AND body='Preserved fanart discussion' AND display_name='Conta excluída / Deleted account') THEN RAISE EXCEPTION 'Fanart comment not anonymized'; END IF;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 IF NOT community_private.is_banned() THEN RAISE EXCEPTION 'Old JWT not blocked'; END IF;
 BEGIN PERFORM public.edit_own_comment('episode',comment_id::text,'Unwanted edit',now()); RAISE EXCEPTION 'Closed account edit allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'Account closure preserves content, anonymizes profile and fanart credits, blocks old JWT writes; fixtures rolled back' result;
