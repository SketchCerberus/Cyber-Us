-- Applied via the Supabase migration tool as community_comment_replies.
alter table public.comments add column parent_id uuid references public.comments(id) on delete set null;
alter table public.comments add column deleted_by_author boolean not null default false;
create index comments_parent_created_idx on public.comments(parent_id, created_at, id);
grant select(parent_id, deleted_by_author) on public.comments to anon, authenticated;
grant insert(parent_id) on public.comments to authenticated;

create function community_private.validate_comment_reply() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.parent_id is not null then
    perform 1 from public.comments p where p.id = new.parent_id
      and p.episode_slug = new.episode_slug and p.parent_id is null
      and p.status = 'visible' and not p.deleted_by_author;
    if not found then raise exception 'This conversation is no longer available' using errcode='22023'; end if;
  end if;
  return new;
end; $$;
revoke all on function community_private.validate_comment_reply() from public, anon, authenticated;
create trigger validate_comment_reply before insert on public.comments
for each row execute function community_private.validate_comment_reply();

-- A narrow owner-only operation: no general UPDATE grant or moderation privilege.
-- Keep the row to preserve replies and the existing comment rate limit history.
create function community_private.remove_own_comment(p_comment_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  update public.comments set body = '[removed by author]', deleted_by_author = true
    where id = p_comment_id and author_id = auth.uid() and not deleted_by_author;
  return found;
end; $$;
revoke all on function community_private.remove_own_comment(uuid) from public, anon;
grant execute on function community_private.remove_own_comment(uuid) to authenticated;
create function public.remove_own_comment(p_comment_id uuid) returns boolean
language sql security invoker set search_path = '' as $$
  select community_private.remove_own_comment(p_comment_id);
$$;
revoke all on function public.remove_own_comment(uuid) from public, anon;
grant execute on function public.remove_own_comment(uuid) to authenticated;
