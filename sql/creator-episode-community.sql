-- Register creator publications in the EXISTING episode discussion system.
-- Run after creator-publishing.sql; this does not replace existing episodes.
create or replace function public.cyberus_sync_comic_episode() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_slug text; v_pt text; v_en text; v_ready boolean;
begin
 v_slug := 'cp-' || new.chapter_number || '-ep-' || new.episode_number;
 select coalesce(max(title) filter(where language_code='pt'), 'Cyber-Us'),
        coalesce(max(title) filter(where language_code='en'), 'Cyber-Us'),
        bool_or((status='published' or (status='scheduled' and publish_at is not null))
                and cardinality(page_paths)>0)
 into v_pt,v_en,v_ready
 from public.comic_publications
 where chapter_number=new.chapter_number and episode_number=new.episode_number;
 insert into public.episodes(slug,title_pt,title_en,sort_order,community_enabled)
 values(v_slug,v_pt,v_en,100000+new.chapter_number*1000+new.episode_number,coalesce(v_ready,false))
 on conflict(slug) do update set title_pt=excluded.title_pt,title_en=excluded.title_en,
 community_enabled=excluded.community_enabled;
 return new;
end;
$$;
revoke all on function public.cyberus_sync_comic_episode() from public;
drop trigger if exists cyberus_sync_comic_episode on public.comic_publications;
create trigger cyberus_sync_comic_episode after insert or update of title,status,publish_at,page_paths
on public.comic_publications for each row execute function public.cyberus_sync_comic_episode();
-- Protect the existing comments/reactions via the episodes SELECT policy.
-- Existing comments and reactions INSERT policies require an enabled episode,
-- and RLS on episodes also controls whether that episode is visible.
create or replace function public.cyberus_episode_is_released(p_slug text)
returns boolean language sql stable security definer set search_path='' as $
 select not exists (
   select 1 from public.comic_publications p
   where ('cp-' || p.chapter_number || '-ep-' || p.episode_number) = p_slug
 ) or exists (
   select 1 from public.comic_publications p
   where ('cp-' || p.chapter_number || '-ep-' || p.episode_number) = p_slug
     and (p.status='published' or (p.status='scheduled' and p.publish_at<=now()))
     and cardinality(p.page_paths)>0
 );
$;
revoke all on function public.cyberus_episode_is_released(text) from public;
grant execute on function public.cyberus_episode_is_released(text) to anon,authenticated;
alter policy episodes_read_enabled on public.episodes
 using (community_enabled and public.cyberus_episode_is_released(slug));
-- Do not expose unreleased episode titles through the episode registry.
-- This guard applies to all consumers of episodes, including comment and vote RLS.

