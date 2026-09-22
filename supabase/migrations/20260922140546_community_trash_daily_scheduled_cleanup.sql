-- UTC daily schedules. The random cron token remains in Vault and is never embedded in client code.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT vault.create_secret(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),'cyberus_trash_cron_token','Authenticates the Cyber-Us daily content trash cleanup');
SELECT cron.schedule('cyberus-trashed-comments-daily','0 3 * * *',$job$SELECT * FROM community_private.purge_expired_comments();$job$);
SELECT cron.schedule('cyberus-trashed-fanarts-daily','10 3 * * *',$job$
SELECT net.http_post(
 url:='https://znenamrszhjsiztllcit.supabase.co/functions/v1/retention-trash',
 headers:=jsonb_build_object('Content-Type','application/json','x-trash-token',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cyberus_trash_cron_token')),
 body:='{}'::jsonb,
 timeout_milliseconds:=60000
);
$job$);
