-- Cyber-Us creator publishing: review and apply in Supabase before enabling UI.
-- Creator role is granted manually to a verified account in community_private.staff.
create table if not exists public.comic_publications (
 id uuid primary key default gen_random_uuid(),
 chapter_number integer not null check (chapter_number >= 0),
 episode_number integer not null check (episode_number >= 0),
 language_code text not null check (language_code in ('pt','en')),
 title text not null check (char_length(title) between 1 and 160),
 author_note text not null default '' check (char_length(author_note) <= 5000),
 status text not null default 'draft' check (status in ('draft','scheduled','published')),
 publish_at timestamptz,
 page_paths text[] not null default '{}',
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(chapter_number,episode_number,language_code),
 check(status <> 'scheduled' or publish_at is not null),
 check(status = 'draft' or cardinality(page_paths) > 0)
);
create index if not exists comic_publications_release_idx on public.comic_publications(status,publish_at);
alter table public.comic_publications enable row level security;
create or replace function public.cyberus_is_creator() returns boolean
language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from community_private.staff s
 where s.user_id = (select auth.uid()) and s.role in ('creator','admin'));
$$;
revoke all on function public.cyberus_is_creator() from public;
grant execute on function public.cyberus_is_creator() to authenticated;
grant select,insert,update,delete on public.comic_publications to authenticated;
grant select on public.comic_publications to anon;
create policy "Read released comics or creator drafts" on public.comic_publications
for select to anon,authenticated
using ((status = 'published' or (status = 'scheduled' and publish_at <= now())) or
 (auth.uid() is not null and public.cyberus_is_creator()));
create policy "Creator inserts comic" on public.comic_publications
for insert to authenticated with check(public.cyberus_is_creator() and created_by = (select auth.uid()));
create policy "Creator edits comic" on public.comic_publications
for update to authenticated using(public.cyberus_is_creator())
with check(public.cyberus_is_creator());
create policy "Creator deletes comic" on public.comic_publications
for delete to authenticated using(public.cyberus_is_creator());
-- Keep images private until their scheduled release. Do not use a public bucket
-- for drafts: public URLs bypass release checks. Use a signed-URL Edge Function
-- that verifies the publication release date and creator status before signing.
-- Author discussion comments: existing public.comments table remains the source
-- of truth; badges/pinning/notifications require a separate reviewed migration.
