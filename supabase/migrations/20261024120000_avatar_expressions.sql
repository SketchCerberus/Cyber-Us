begin;

alter table public.profiles drop constraint profiles_avatar_choice;
alter table public.profiles add constraint profiles_avatar_choice check (
  avatar is null or avatar in (
    'robot','fox','cat','rocket','star','moon',
    'kaubi','auara','oete',
    'kaubi-2','kaubi-3','auara-2','auara-3','oete-2','oete-3'
  ) or avatar ~ '^upload:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

commit;
