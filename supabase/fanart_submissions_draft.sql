-- PREPARAÇÃO: não executar no projeto de produção até aprovação e testes.
-- Uploads ficam PRIVADOS; nenhuma política de leitura de storage é concedida.
-- Exige public.is_banned() existente na comunidade.

create table if not exists public.fanart_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artist_name text not null check (char_length(btrim(artist_name)) between 1 and 60),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  region text check (region is null or char_length(region) <= 80),
  show_region boolean not null default false,
  artist_link text check (artist_link is null or (char_length(artist_link) <= 500 and artist_link ~ '^https://[^[:space:]]+$')),
  accent text not null default 'random' check (accent in ('random','red','green','blue')),
  extension text not null check (extension in ('jpg','png','webp')),
  image_path text not null unique,
  rights_confirmed boolean not null check (rights_confirmed),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  constraint region_requires_consent check (not show_region or (region is not null and length(btrim(region)) > 0)),
  constraint image_path_matches_owner check (image_path = user_id::text || '/' || id::text || '.' || extension)
);

create index if not exists fanart_submissions_owner_created on public.fanart_submissions(user_id, created_at desc);
create index if not exists fanart_submissions_pending on public.fanart_submissions(created_at) where status = 'pending';
alter table public.fanart_submissions enable row level security;
revoke all on public.fanart_submissions from anon, authenticated;
grant select, insert, delete on public.fanart_submissions to authenticated;

-- Proprietário consulta somente seus registros. Nenhum visitante obtém envios pendentes.
create policy "fanart_owner_read" on public.fanart_submissions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "fanart_owner_submit" on public.fanart_submissions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and rights_confirmed and not public.is_banned());
create policy "fanart_owner_cancel" on public.fanart_submissions for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');

-- Limite no banco (não apenas no browser). A proteção do armazenamento depende de registro reservado.
create schema if not exists community_private;
create or replace function community_private.check_fanart_submission_limit()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if new.user_id is distinct from auth.uid() or public.is_banned() then
    raise exception 'fanart submission not authorized';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 9237));
  if (select count(*) from public.fanart_submissions
      where user_id = new.user_id and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'fanart daily limit reached';
  end if;
  return new;
end;
$$;
revoke all on function community_private.check_fanart_submission_limit() from public, anon, authenticated;
create trigger fanart_submission_limit before insert on public.fanart_submissions
for each row execute function community_private.check_fanart_submission_limit();

-- Nome do bucket separado evita qualquer exposição acidental via public URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('fanart-pending','fanart-pending',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create policy "fanart_private_upload_reserved" on storage.objects for insert to authenticated
with check (
  bucket_id = 'fanart-pending'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and not public.is_banned()
  and exists (select 1 from public.fanart_submissions f
    where f.image_path = name and f.user_id = (select auth.uid()) and f.status = 'pending')
);
-- Intencionalmente nenhuma policy SELECT/UPDATE/DELETE em storage.objects para esse bucket.
-- Moderadores devem inspecionar via painel administrativo autorizado; não criar signed URLs
-- ou liberar originais não revisados ao público.
