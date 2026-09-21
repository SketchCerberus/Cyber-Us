-- Apply before the corresponding frontend is deployed. Existing comments are PT at the author's request.
-- A comment's language records the reader interface at submission, not automated text detection.
-- The PT default preserves compatibility with older clients during deployment.
alter table public.comments
  add column language_code text not null default 'pt'
  constraint comments_language_code_check check (language_code in ('pt', 'en'));

grant select (language_code) on public.comments to anon, authenticated;
grant insert (language_code) on public.comments to authenticated;

-- A reply always inherits the parent's recorded locale, even if the reader changes UI language.
-- Existing reply-validation and write/RLS safeguards remain unchanged.
create function community_private.inherit_comment_language()
returns trigger language plpgsql set search_path = '' as $function$
begin
  if new.parent_id is not null then
    select parent.language_code into new.language_code
      from public.comments parent where parent.id = new.parent_id;
  end if;
  return new;
end;
$function$;

create trigger comments_inherit_language
before insert on public.comments
for each row execute function community_private.inherit_comment_language();

create index comments_moderation_locale_idx
on public.comments (episode_slug, language_code, created_at desc, id desc);
