-- Apply AFTER sql/creator-publishing.sql. Private Storage; access is gated by RLS.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('comic-pages','comic-pages',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- Path format: publication UUID / 001.webp; publication UUID is the first folder.
create policy "Creator uploads comic pages" on storage.objects for insert to authenticated
with check(bucket_id='comic-pages' and public.cyberus_is_creator()
and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$');
create policy "Creator removes comic pages" on storage.objects for delete to authenticated
using(bucket_id='comic-pages' and public.cyberus_is_creator());
create policy "Creator reads drafts and released pages" on storage.objects for select to authenticated
using(bucket_id='comic-pages' and (public.cyberus_is_creator() or exists (
select 1 from public.comic_publications p where p.id::text=(storage.foldername(name))[1]
and name=any(p.page_paths) and
(p.status='published' or (p.status='scheduled' and p.publish_at<=now()))
)));
create policy "Public reads released comic pages" on storage.objects for select to anon
using(bucket_id='comic-pages' and exists (
select 1 from public.comic_publications p where p.id::text=(storage.foldername(name))[1]
and name=any(p.page_paths) and
(p.status='published' or (p.status='scheduled' and p.publish_at<=now()))
));
-- Do not enable storage UPDATE: replacing pages requires deleting then uploading.
-- Public SELECT is restricted to released publication paths. Signed URLs are short-lived.
