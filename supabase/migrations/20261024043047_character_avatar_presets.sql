begin;
alter table public.profiles drop constraint profiles_avatar_choice;
alter table public.profiles add constraint profiles_avatar_choice check (
  avatar is null or avatar in ('robot','fox','cat','rocket','star','moon','kaubi','auara','oete') or
  avatar ~ '^upload:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
commit;
