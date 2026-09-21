-- Apply to the existing Cyber-Us Supabase project BEFORE publishing the matching frontend.
-- A comment's language is the reader interface language at submission, not automatic language detection.
-- Historical rows retain NULL; do not guess the language of existing readers' texts.
alter table public.comments add column language_code text;
alter table public.comments add constraint comments_language_code_check
  check (language_code is null or language_code in ('pt', 'en'));

grant select (language_code) on public.comments to anon, authenticated;
grant insert (language_code) on public.comments to authenticated;

-- Keep all replies in their parent thread's language, including historical unlabeled threads.
-- The existing reply validator still checks parent existence and access.
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
