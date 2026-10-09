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
        bool_or((status='published' or (status='scheduled' and publish_at<=now()))
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
-- The discussion registry is enabled for scheduled episodes at scheduling time.
-- Their existence/slugs may be discoverable early, but comic metadata and
-- image access remain gated by publication/Storage RLS until publish_at.
-- Do not place spoilers or unreleased images in the episode registry.
