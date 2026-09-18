-- Applied in Supabase as fix_moderation_ban_list_wrapper_privileges.
-- The trusted wrapper needs its owner's permissions to call the private helper.
-- The private helper itself verifies auth.uid() and staff membership before returning rows.
create or replace function public.moderation_active_bans()
returns table (user_id uuid, display_name text, reason text, issued_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $function$ select * from community_private.moderation_active_bans(); $function$;

revoke all on function public.moderation_active_bans() from public, anon;
grant execute on function public.moderation_active_bans() to authenticated;
