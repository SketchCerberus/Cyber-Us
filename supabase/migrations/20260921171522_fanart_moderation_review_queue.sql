-- Secure moderator review for private fanart submissions.
-- Approval changes status only; public gallery publication remains an editorial step.

create table community_private.fanart_moderation_log (
  id bigint generated always as identity primary key,
  submission_id uuid references public.fanart_submissions(id) on delete set null,
  submitter_id uuid not null,
  moderator_id uuid not null,
  previous_status text not null,
  decision text not null check (decision in ('approved','rejected')),
  reason text check (reason is null or char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);
alter table community_private.fanart_moderation_log enable row level security;
revoke all on community_private.fanart_moderation_log from public, anon, authenticated;
create index fanart_moderation_log_submission_created
  on community_private.fanart_moderation_log(submission_id,created_at desc);

create policy "fanart_moderator_read" on public.fanart_submissions
  for select to authenticated
  using ((select public.is_moderator()));

create policy "fanart_moderator_preview" on storage.objects
  for select to authenticated
  using (bucket_id = 'fanart-pending' and (select public.is_moderator()));

create policy "fanart_moderator_remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fanart-pending' and (select public.is_moderator()));

create function public.moderate_fanart_submission(
  p_submission_id uuid,
  p_decision text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_submitter uuid;
  v_previous text;
  v_reason text := nullif(btrim(p_reason),'');
begin
  if v_actor is null or not community_private.is_moderator() then
    raise exception 'Moderator access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'Invalid fanart decision' using errcode = '22023';
  end if;
  if v_reason is not null and char_length(v_reason) not between 3 and 500 then
    raise exception 'Invalid moderation reason' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and v_reason is null then
    raise exception 'Rejection reason required' using errcode = '22023';
  end if;

  select f.user_id,f.status into v_submitter,v_previous
  from public.fanart_submissions f
  where f.id = p_submission_id
  for update;
  if not found then
    raise exception 'Fanart submission not found' using errcode = '22023';
  end if;
  if v_previous not in ('pending','withdrawal_requested') then
    raise exception 'Fanart submission already decided' using errcode = '22023';
  end if;
  if v_previous = 'withdrawal_requested' and p_decision <> 'rejected' then
    raise exception 'Withdrawal requests cannot be approved' using errcode = '22023';
  end if;

  update public.fanart_submissions
  set status = p_decision
  where id = p_submission_id;

  insert into community_private.fanart_moderation_log(
    submission_id,submitter_id,moderator_id,previous_status,decision,reason
  ) values (
    p_submission_id,v_submitter,v_actor,v_previous,p_decision,v_reason
  );
  return true;
end;
$fn$;

revoke all on function public.moderate_fanart_submission(uuid,text,text)
  from public,anon;
grant execute on function public.moderate_fanart_submission(uuid,text,text)
  to authenticated;
