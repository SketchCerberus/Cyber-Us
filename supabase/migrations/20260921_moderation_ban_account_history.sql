-- Deploy this moderator-only RPC before the corresponding frontend.
-- Count every recorded ban, including revoked/expired bans. Sum time actually served;
-- an active/permanent ban accrues only until the instant of the request.
-- Auth account creation timestamps are not exposed through public profile reads.
create function public.moderation_active_bans_with_history()
returns table (
  user_id uuid,
  display_name text,
  reason text,
  issued_at timestamptz,
  expires_at timestamptz,
  account_created_at timestamptz,
  ban_count bigint,
  days_banned numeric
)
language plpgsql stable security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not (select community_private.is_moderator()) then
    raise exception 'Moderator access required' using errcode = '42501';
  end if;

  return query
    with active as (
      select b.id, b.user_id, b.reason, b.issued_at, b.expires_at
      from community_private.bans b
      where b.revoked_at is null and (b.expires_at is null or b.expires_at > now())
      order by b.issued_at desc, b.id desc
      limit 100
    ), history as (
      select b.user_id,
             count(*)::bigint as ban_count,
             round(sum(greatest(0::numeric,
               extract(epoch from (
                 least(coalesce(b.revoked_at, now()), coalesce(b.expires_at, now()), now()) - b.issued_at
               ))::numeric
             )) / 86400, 2) as days_banned
      from community_private.bans b
      where b.user_id in (select a.user_id from active a)
      group by b.user_id
    )
    select a.user_id, p.display_name, a.reason, a.issued_at, a.expires_at,
           u.created_at, h.ban_count, h.days_banned
    from active a
    join auth.users u on u.id = a.user_id
    join history h on h.user_id = a.user_id
    left join public.profiles p on p.id = a.user_id
    order by a.issued_at desc, a.id desc;
end;
$function$;

-- SECURITY DEFINER alone is insufficient: only authenticated staff may invoke it.
revoke all on function public.moderation_active_bans_with_history() from public, anon;
grant execute on function public.moderation_active_bans_with_history() to authenticated;
