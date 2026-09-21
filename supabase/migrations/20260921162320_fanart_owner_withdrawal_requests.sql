-- Applied 2026-09-21. Artists can request withdrawal, moderator removes all copies.
alter table public.fanart_submissions drop constraint fanart_submissions_status_check;
alter table public.fanart_submissions add constraint fanart_submissions_status_check
check (status in ('pending','approved','rejected','withdrawal_requested'));
grant update(status) on public.fanart_submissions to authenticated;
create policy "fanart_owner_request_withdrawal" on public.fanart_submissions
  for update to authenticated
  using (user_id = (select auth.uid()) and status in ('pending','approved'))
  with check (user_id = (select auth.uid()) and status = 'withdrawal_requested');
