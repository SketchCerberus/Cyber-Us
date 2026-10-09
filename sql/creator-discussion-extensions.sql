-- Proposed creator discussion extensions. REVIEW before applying in production.
-- The existing public.comments table remains authoritative.
create table if not exists public.creator_pinned_comments (
 episode_slug text primary key references public.episodes(slug),
 comment_id uuid not null references public.comments(id) on delete cascade,
 pinned_by uuid not null references auth.users(id),
 pinned_at timestamptz not null default now()
);
alter table public.creator_pinned_comments enable row level security;
grant select on public.creator_pinned_comments to anon,authenticated;
grant insert,update,delete on public.creator_pinned_comments to authenticated;
create policy "Read pinned comments" on public.creator_pinned_comments for select to anon,authenticated using(true);
create policy "Creator pins comments" on public.creator_pinned_comments for insert to authenticated
with check(public.cyberus_is_creator() and pinned_by=(select auth.uid()) and exists
(select 1 from public.comments c where c.id=comment_id and c.episode_slug=episode_slug and c.status='visible' and not coalesce(c.deleted_by_author,false)));
create policy "Creator updates pins" on public.creator_pinned_comments for update to authenticated
using(public.cyberus_is_creator()) with check(public.cyberus_is_creator() and pinned_by=(select auth.uid()) and exists
(select 1 from public.comments c where c.id=comment_id and c.episode_slug=episode_slug and c.status='visible' and not coalesce(c.deleted_by_author,false)));
create policy "Creator removes pins" on public.creator_pinned_comments for delete to authenticated using(public.cyberus_is_creator());
-- Reply notifications are private to the recipient, and are populated by an
-- audited server-side trigger in a later migration (not by browser clients).
create table if not exists public.creator_reply_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id),
 comment_id uuid not null unique references public.comments(id) on delete cascade,
 created_at timestamptz not null default now(),
 read_at timestamptz
);
alter table public.creator_reply_notifications enable row level security;
grant select,update on public.creator_reply_notifications to authenticated;
create policy "Read own reply notifications" on public.creator_reply_notifications for select to authenticated using(recipient_id=(select auth.uid()));
create policy "Mark own notifications read" on public.creator_reply_notifications for update to authenticated
using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
-- Prevent browser clients from modifying the recipient or linked comment.
revoke update on public.creator_reply_notifications from authenticated;
grant update(read_at) on public.creator_reply_notifications to authenticated;
