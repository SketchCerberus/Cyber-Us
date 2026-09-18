-- Applied to the Cyber-Us Community Supabase project through its migration tool.
-- Existing base schema (profiles, episodes, comments, reactions, private staff/bans/log)
-- was created in two earlier migrations in Supabase and is not recreated here.
-- This file records the additional change accompanying the frontend PR.
insert into public.episodes(slug,title_pt,title_en,sort_order,community_enabled)
values ('episodio-01','Inicializando','Initializing',1,true)
on conflict (slug) do update set
  title_pt=excluded.title_pt,
  title_en=excluded.title_en,
  community_enabled=true;

create or replace function community_private.moderation_active_bans()
returns table (user_id uuid, display_name text, reason text, issued_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not (select community_private.is_moderator()) then
    raise exception 'Moderator access required' using errcode='42501';
  end if;
  return query
    select b.user_id, p.display_name, b.reason, b.issued_at, b.expires_at
    from community_private.bans b
    left join public.profiles p on p.id=b.user_id
    where b.revoked_at is null and (b.expires_at is null or b.expires_at > now())
    order by b.issued_at desc limit 100;
end;
$function$;

create or replace function public.moderation_active_bans()
returns table (user_id uuid, display_name text, reason text, issued_at timestamptz, expires_at timestamptz)
language sql stable set search_path = ''
as $function$ select * from community_private.moderation_active_bans(); $function$;

revoke all on function community_private.moderation_active_bans() from public, anon, authenticated;
revoke all on function public.moderation_active_bans() from public, anon;
grant execute on function public.moderation_active_bans() to authenticated;
