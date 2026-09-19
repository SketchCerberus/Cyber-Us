-- Profile avatars: one small public JPEG per account; writes remain owner-only.
alter table public.profiles add column avatar text;
alter table public.profiles add constraint profiles_avatar_choice check (
  avatar is null or avatar in ('robot','fox','cat','rocket','star','moon') or
  avatar ~ '^upload:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
grant select (avatar) on public.profiles to anon, authenticated;
grant update (avatar) on public.profiles to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('community-avatars','community-avatars',true,262144,array['image/jpeg']);

create policy avatar_owner_read on storage.objects for select to authenticated
using (bucket_id='community-avatars' and name=(select auth.uid())::text || '/avatar.jpg');
create policy avatar_owner_insert on storage.objects for insert to authenticated
with check (bucket_id='community-avatars' and name=(select auth.uid())::text || '/avatar.jpg'
  and not (select community_private.is_banned()));
create policy avatar_owner_update on storage.objects for update to authenticated
using (bucket_id='community-avatars' and name=(select auth.uid())::text || '/avatar.jpg'
  and not (select community_private.is_banned()))
with check (bucket_id='community-avatars' and name=(select auth.uid())::text || '/avatar.jpg'
  and not (select community_private.is_banned()));
create policy avatar_owner_delete on storage.objects for delete to authenticated
using (bucket_id='community-avatars' and name=(select auth.uid())::text || '/avatar.jpg'
  and not (select community_private.is_banned()));
