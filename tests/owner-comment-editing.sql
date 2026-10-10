-- Fixtures and every side effect are rolled back, including private history.
BEGIN;
DO $$
DECLARE owner_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid(); work_id uuid:=gen_random_uuid(); episode_id uuid:=gen_random_uuid(); fan_id bigint; version timestamptz; stamp timestamptz;
BEGIN
 INSERT INTO auth.users(id,aud,role,email,email_confirmed_at,is_anonymous,raw_user_meta_data)
 VALUES(owner_id,'authenticated','authenticated',owner_id||'@example.invalid',now(),false,'{"display_name":"Test author"}'),
 (other_id,'authenticated','authenticated',other_id||'@example.invalid',now(),false,'{"display_name":"Test other"}');
 UPDATE public.profiles SET display_name='Test author' WHERE id=owner_id;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 INSERT INTO public.comments(id,episode_slug,author_id,body,created_at) VALUES(episode_id,'episodio-01',owner_id,'original',now()-interval '1 day');
 INSERT INTO public.fanart_submissions(id,user_id,artist_name,title,extension,image_path,rights_confirmed,status)
 VALUES(work_id,owner_id,'Test author','Temporary fixture','png',owner_id||'/'||work_id||'.png',true,'approved');
 INSERT INTO public.fanart_gallery(submission_id,title,artist_name,accent,image_path)
 VALUES(work_id,'Temporary fixture','Test author','blue',owner_id||'/'||work_id||'.png');
 INSERT INTO public.fanart_comments(submission_id,author_id,body) VALUES(work_id,owner_id,'original') RETURNING id INTO fan_id;
 FOREACH version IN ARRAY ARRAY[(SELECT updated_at FROM public.comments WHERE id=episode_id)] LOOP
 stamp:=public.edit_own_comment('episode',episode_id::text,'changed',version);
 IF NOT EXISTS(SELECT 1 FROM public.comments WHERE id=episode_id AND body='changed' AND edited_at IS NOT NULL AND author_id=owner_id AND episode_slug='episodio-01') THEN RAISE EXCEPTION 'edit failed'; END IF;
 END LOOP;
 SELECT coalesce(updated_at,created_at) INTO version FROM public.fanart_comments WHERE id=fan_id;
 stamp:=public.edit_own_comment('fanart',fan_id::text,'changed',version);
 IF NOT EXISTS(SELECT 1 FROM public.own_fanart_comment_ids(work_id) WHERE id=fan_id) THEN RAISE EXCEPTION 'ownership lookup failed'; END IF;
 IF (SELECT count(*) FROM community_private.comment_edit_history WHERE editor_id=owner_id)<>2 THEN RAISE EXCEPTION 'audit failed'; END IF;
 BEGIN PERFORM public.edit_own_comment('fanart',fan_id::text,'stale',version-interval '1 second');RAISE EXCEPTION 'stale accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
 BEGIN PERFORM public.edit_own_comment('episode',episode_id::text,' ',stamp);RAISE EXCEPTION 'blank accepted';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',other_id::text,true);
 IF EXISTS(SELECT 1 FROM public.own_fanart_comment_ids(work_id)) THEN RAISE EXCEPTION 'ownership leak'; END IF;
 BEGIN PERFORM public.edit_own_comment('episode',episode_id::text,'intrusion',stamp);RAISE EXCEPTION 'other accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 INSERT INTO community_private.bans(user_id,reason) VALUES(owner_id,'Temporary test');
 BEGIN PERFORM public.edit_own_comment('fanart',fan_id::text,'banned',stamp);RAISE EXCEPTION 'banned accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM public.edit_own_comment('episode',episode_id::text,'guest',stamp);RAISE EXCEPTION 'guest accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF has_function_privilege('anon','public.edit_own_comment(text,text,text,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'anonymous grant';END IF;
END $$;
ROLLBACK;
SELECT 'owner, fanart, history, conflict, blank, other, banned, guest and grants passed; fixtures rolled back' result;
