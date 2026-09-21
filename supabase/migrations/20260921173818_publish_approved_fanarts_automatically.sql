-- Publish approved fanarts from the private moderation queue without exposing
-- account identifiers or non-consented region data to the public gallery.

create table public.fanart_gallery (
  submission_id uuid primary key references public.fanart_submissions(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  artist_name text not null check (char_length(btrim(artist_name)) between 1 and 60),
  artist_link text check (artist_link is null or (char_length(artist_link) <= 500 and artist_link ~ '^https://[^[:space:]]+$')),
  region text check (region is null or char_length(region) <= 80),
  accent text not null check (accent in ('random','red','green','blue')),
  image_path text not null unique,
  published_at timestamptz not null default now()
);
alter table public.fanart_gallery enable row level security;
revoke all on public.fanart_gallery from public,anon,authenticated;
grant select on public.fanart_gallery to anon,authenticated;
create policy "fanart_gallery_public_read" on public.fanart_gallery
  for select to anon,authenticated using (true);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('fanart-public','fanart-public',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy "fanart_public_moderator_read" on storage.objects
  for select to authenticated
  using (bucket_id='fanart-public' and (select public.is_moderator()));
create policy "fanart_public_moderator_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id='fanart-public' and (select public.is_moderator()));
create policy "fanart_public_moderator_update" on storage.objects
  for update to authenticated
  using (bucket_id='fanart-public' and (select public.is_moderator()))
  with check (bucket_id='fanart-public' and (select public.is_moderator()));
create policy "fanart_public_moderator_delete" on storage.objects
  for delete to authenticated
  using (bucket_id='fanart-public' and (select public.is_moderator()));

create function public.publish_fanart_submission(
  p_submission_id uuid,
  p_public_path text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_work public.fanart_submissions%rowtype;
  v_expected_path text;
begin
  if v_actor is null or not community_private.is_moderator() then
    raise exception 'Moderator access required' using errcode='42501';
  end if;

  select * into v_work
  from public.fanart_submissions
  where id=p_submission_id
  for update;
  if not found then
    raise exception 'Fanart submission not found' using errcode='22023';
  end if;
  if v_work.status <> 'pending' then
    raise exception 'Fanart submission is not pending' using errcode='22023';
  end if;

  v_expected_path := v_work.id::text || '.' || v_work.extension;
  if p_public_path is distinct from v_expected_path then
    raise exception 'Invalid public fanart path' using errcode='22023';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id='fanart-public' and o.name=p_public_path
  ) then
    raise exception 'Published fanart file not found' using errcode='22023';
  end if;

  update public.fanart_submissions set status='approved' where id=v_work.id;
  insert into public.fanart_gallery(
    submission_id,title,artist_name,artist_link,region,accent,image_path
  ) values (
    v_work.id,v_work.title,v_work.artist_name,v_work.artist_link,
    case when v_work.show_region then nullif(btrim(v_work.region),'') else null end,
    v_work.accent,p_public_path
  );
  insert into community_private.fanart_moderation_log(
    submission_id,submitter_id,moderator_id,previous_status,decision,reason
  ) values (v_work.id,v_work.user_id,v_actor,v_work.status,'approved',null);
  return true;
end;
$fn$;
revoke all on function public.publish_fanart_submission(uuid,text) from public,anon;
grant execute on function public.publish_fanart_submission(uuid,text) to authenticated;

-- Rejection remains a separate action. An approval must pass through the
-- publication function above so status and public metadata cannot diverge.
create or replace function public.moderate_fanart_submission(
  p_submission_id uuid,
  p_decision text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_submitter uuid;
  v_previous text;
  v_reason text := nullif(btrim(p_reason),'');
begin
  if v_actor is null or not community_private.is_moderator() then
    raise exception 'Moderator access required' using errcode='42501';
  end if;
  if p_decision <> 'rejected' then
    raise exception 'Approvals must publish the fanart' using errcode='22023';
  end if;
  if v_reason is null or char_length(v_reason) not between 3 and 500 then
    raise exception 'Rejection reason required' using errcode='22023';
  end if;

  select f.user_id,f.status into v_submitter,v_previous
  from public.fanart_submissions f
  where f.id=p_submission_id
  for update;
  if not found then
    raise exception 'Fanart submission not found' using errcode='22023';
  end if;
  if v_previous not in ('pending','withdrawal_requested') then
    raise exception 'Fanart submission already decided' using errcode='22023';
  end if;

  delete from public.fanart_gallery where submission_id=p_submission_id;
  update public.fanart_submissions set status='rejected' where id=p_submission_id;
  insert into community_private.fanart_moderation_log(
    submission_id,submitter_id,moderator_id,previous_status,decision,reason
  ) values (p_submission_id,v_submitter,v_actor,v_previous,'rejected',v_reason);
  return true;
end;
$fn$;
revoke all on function public.moderate_fanart_submission(uuid,text,text) from public,anon;
grant execute on function public.moderate_fanart_submission(uuid,text,text) to authenticated;
