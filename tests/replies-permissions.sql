-- Integration test: all fixtures and changes are rolled back, including on failure.
begin;
do $$
declare
  actor uuid; other_actor uuid; root_id uuid := gen_random_uuid();
  other_root uuid := gen_random_uuid(); hidden_root uuid := gen_random_uuid();
  reply_id uuid := gen_random_uuid(); candidate uuid; n integer;
begin
  select id into actor from auth.users u where not exists
    (select 1 from public.comments c where c.author_id=u.id and c.created_at>now()-interval '1 hour') limit 1;
  select id into other_actor from auth.users u where id<>actor and not exists
    (select 1 from public.comments c where c.author_id=u.id and c.created_at>now()-interval '1 hour') limit 1;
  if actor is null or other_actor is null then raise exception 'Need two quiet test accounts'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.comments(id,episode_slug,author_id,body,created_at)
    values(root_id,'episodio-01',actor,'rollback root','2000-01-01');
  perform set_config('request.jwt.claim.sub',other_actor::text,true);
  insert into public.comments(id,episode_slug,author_id,body,created_at)
    values(other_root,'episodio-02',other_actor,'rollback other','2000-01-01');
  insert into public.comments(id,episode_slug,author_id,body,status,created_at)
    values(hidden_root,'episodio-01',other_actor,'rollback hidden','hidden','2000-01-01');
  insert into public.comments(id,episode_slug,author_id,body,parent_id,created_at)
    values(reply_id,'episodio-01',other_actor,'rollback reply',root_id,'2000-01-01');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  set local role authenticated;
  if public.remove_own_comment(other_root) then raise exception 'Removed another account comment'; end if;
  foreach candidate in array array[other_root,hidden_root,reply_id,gen_random_uuid()] loop
    begin
      insert into public.comments(episode_slug,author_id,body,parent_id)
        values('episodio-01',actor,'invalid reply',candidate);
      raise exception 'Invalid parent accepted';
    exception when sqlstate '22023' then null;
    end;
  end loop;
  insert into public.comments(episode_slug,author_id,body,parent_id)
    values('episodio-01',actor,'valid reply',root_id);
  begin
    insert into public.comments(episode_slug,author_id,body,parent_id)
      values('episodio-01',actor,'rate limit',root_id);
    raise exception 'Rate limit missing' using errcode='22000';
  exception when sqlstate 'P0001' then null;
  end;
  if not public.remove_own_comment(root_id) then raise exception 'Owner removal failed'; end if;
  if exists(select 1 from public.comments where id=root_id and (body<>'[removed by author]' or not deleted_by_author)) then raise exception 'Body retained'; end if;
  select count(*) into n from public.comments where parent_id=root_id;
  if n<>2 then raise exception 'Replies were lost'; end if;
  begin
    update public.comments set body='unauthorized' where id=other_root;
    raise exception 'General update granted' using errcode='22000';
  exception when insufficient_privilege then null;
  end;
  reset role;
  insert into community_private.bans(user_id,reason) values(actor,'rollback ban test');
  set local role authenticated;
  begin
    insert into public.comments(episode_slug,author_id,body,parent_id)
      values('episodio-01',actor,'banned reply',root_id);
    raise exception 'Banned reply accepted' using errcode='22000';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role anon;
  begin
    perform public.remove_own_comment(root_id);
    raise exception 'Anonymous removal allowed' using errcode='22000';
  exception when insufficient_privilege then null;
  end;
  reset role;
end; $$;
rollback;
select 'All reply ownership, parent, rate limit, ban and anonymous checks passed; fixtures rolled back' as result;
