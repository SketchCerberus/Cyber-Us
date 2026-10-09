-- Discussion extensions: integrate with EXISTING community notifications.
-- Apply after creator-publishing.sql; no duplicate notification inbox.
create table if not exists public.creator_pinned_comments (
 episode_slug text primary key references public.episodes(slug),
 comment_id uuid not null references public.comments(id) on delete cascade,
 pinned_by uuid not null references auth.users(id),
 pinned_at timestamptz not null default now()
);
alter table public.creator_pinned_comments enable row level security;
grant select on public.creator_pinned_comments to anon,authenticated;
grant insert,update,delete on public.creator_pinned_comments to authenticated;
create policy "Everyone reads pins" on public.creator_pinned_comments for select to anon,authenticated using(true);
create policy "Creator inserts pins" on public.creator_pinned_comments for insert to authenticated with check(
 public.cyberus_is_creator() and pinned_by=auth.uid() and exists(
 select 1 from public.comments c where c.id=creator_pinned_comments.comment_id and c.episode_slug=creator_pinned_comments.episode_slug and c.parent_id is null and c.status='visible' and not coalesce(c.deleted_by_author,false)));
create policy "Creator updates pins" on public.creator_pinned_comments for update to authenticated using(public.cyberus_is_creator())
with check(public.cyberus_is_creator() and pinned_by=auth.uid() and exists(
 select 1 from public.comments c where c.id=creator_pinned_comments.comment_id and c.episode_slug=creator_pinned_comments.episode_slug and c.parent_id is null and c.status='visible' and not coalesce(c.deleted_by_author,false)));
create policy "Creator deletes pins" on public.creator_pinned_comments for delete to authenticated using(public.cyberus_is_creator());
-- This function exposes the existing creator profile's public user id for badges.
create or replace function public.cyberus_creator_public_id() returns uuid
language sql stable security definer set search_path='' as $$
 select s.user_id from community_private.staff s where s.role='creator'
 order by s.added_at limit 1;
$$;
revoke all on function public.cyberus_creator_public_id() from public;
grant execute on function public.cyberus_creator_public_id() to anon,authenticated;
-- Existing community_notifications and community_notification_preferences already
-- handle replies. Do not create a second notification table or trigger.
