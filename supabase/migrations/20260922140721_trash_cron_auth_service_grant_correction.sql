-- Service-role secret keys use EXECUTE privileges, not necessarily JWT claim GUCs.
CREATE OR REPLACE FUNCTION public.trash_authorize_cron(p_token text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='cyberus_trash_cron_token' AND decrypted_secret=p_token);
$$;
REVOKE ALL ON FUNCTION public.trash_authorize_cron(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trash_authorize_cron(text) TO service_role;
