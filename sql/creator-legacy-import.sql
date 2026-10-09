-- Import the existing six bilingual episodes without changing their discussion slugs.
alter table public.comic_publications add column if not exists legacy_slug text;
alter table public.comic_publications add column if not exists legacy_page_urls text[] not null default '{}';
create unique index if not exists comic_publications_legacy_language_uidx on public.comic_publications(legacy_slug,language_code) where legacy_slug is not null;
alter table public.comic_publications drop constraint if exists comic_publications_check1;
alter table public.comic_publications add constraint comic_publications_pages_check check (
 status='draft' or cardinality(page_paths)>0 or (legacy_slug is not null and cardinality(legacy_page_urls)>0)
);
create or replace function public.cyberus_sync_comic_episode() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_slug text; v_pt text; v_en text; v_ready boolean;
begin
 if new.legacy_slug is not null then return new; end if;
 v_slug := 'cp-' || new.chapter_number || '-ep-' || new.episode_number;
 select coalesce(max(title) filter(where language_code='pt'), 'Cyber-Us'),
        coalesce(max(title) filter(where language_code='en'), 'Cyber-Us'),
        bool_or((status='published' or (status='scheduled' and publish_at is not null)) and cardinality(page_paths)>0)
 into v_pt,v_en,v_ready from public.comic_publications
 where chapter_number=new.chapter_number and episode_number=new.episode_number and legacy_slug is null;
 insert into public.episodes(slug,title_pt,title_en,sort_order,community_enabled)
 values(v_slug,v_pt,v_en,100000+new.chapter_number*1000+new.episode_number,coalesce(v_ready,false))
 on conflict(slug) do update set title_pt=excluded.title_pt,title_en=excluded.title_en,community_enabled=excluded.community_enabled;
 return new;
end;$$;
revoke all on function public.cyberus_sync_comic_episode() from public;
do $$
declare creator uuid;
begin
 select user_id into creator from community_private.staff where role='creator' order by added_at limit 1;
 if creator is null then raise exception 'No creator account configured'; end if;
 insert into public.comic_publications(chapter_number,episode_number,language_code,title,status,publish_at,page_paths,legacy_slug,legacy_page_urls,created_by)
 select v.chapter,v.episode,l.lang,
 case when l.lang='pt' then v.title_pt else v.title_en end,
 'published',now(),array[]::text[],v.slug,array['assets/episodes/'||v.folder||'/'||l.lang||'/001.'||v.ext],creator
 from (values
 (1,1,'episodio-01','ep01','jpg','Inicializando','Initializing'),
 (1,2,'episodio-02','ep02','jpg','Processando','Processing'),
 (1,3,'episodio-03','ep03','jpg','Procurando','Searching'),
 (1,4,'episodio-04','ep04','jpg','Prosseguindo','Proceeding'),
 (1,5,'episodio-05','ep05','jpg','Reiniciando','Rebooting'),
 (0,0,'marco-zero','marco-zero','webp','Memória — Marco Zero','Memory — Ground Zero')
 ) as v(chapter,episode,slug,folder,ext,title_pt,title_en)
 cross join (values ('pt'),('en')) as l(lang)
 on conflict(chapter_number,episode_number,language_code) do nothing;
end;$$;
