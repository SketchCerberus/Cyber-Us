import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/20260922003000_community_notifications_history_featured.sql');
const audit=read('supabase/migrations/20260922003100_moderation_recent_edits.sql');

test('notification preferences are off by default, user-owned and configurable',()=>{
  assert.match(sql,/replies boolean NOT NULL DEFAULT false/);
  assert.match(sql,/mentions boolean NOT NULL DEFAULT false/);
  assert.match(sql,/ALTER TABLE public\.community_notification_preferences ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/user_id=\(SELECT auth\.uid\(\)\)/);
  assert.match(sql,/notification_preferences_update/);
  const client=read('community-notifications.js');
  assert.match(client,/community_notification_preferences/);
  assert.match(client,/reply\.checked/);
  assert.match(client,/mention\.checked/);
  assert.match(client,/settings\.addEventListener\('submit'/);
  assert.match(client,/no emails are sent/i);
  assert.doesNotMatch(client,/community-notification-list|\.select\('id,kind,episode_slug/);
});

test('notifications have owner-only access, no direct insertion and server-checked opt-in',()=>{
  assert.match(sql,/CREATE TABLE public\.community_notifications/);
  assert.match(sql,/ALTER TABLE public\.community_notifications ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/notification_owner_read/);
  assert.match(sql,/recipient_id=\(SELECT auth\.uid\(\)\)/);
  assert.doesNotMatch(sql,/GRANT INSERT\([^)]*\) ON public\.community_notifications/);
  assert.match(sql,/REVOKE ALL ON FUNCTION community_private\.enqueue_community_notice/);
  assert.match(sql,/pref\.replies/);
  assert.match(sql,/pref\.mentions/);
  assert.match(sql,/ON CONFLICT DO NOTHING/);
  const client=read('header-notifications.js');
  assert.match(client,/\.select\('id,kind,episode_slug,fanart_submission_id,created_at,read_at'\)/);
  assert.doesNotMatch(client,/select\('[^']*recipient_id/);
  assert.match(client,/\.update\(\{read_at: new Date\(\)\.toISOString\(\)\}\)/);
  assert.match(client,/\.select\('id', \{count: 'exact', head: true\}\)\.is\('read_at', null\)/);
  assert.match(client,/shell\.hidden = true/);
  assert.match(client,/db\.auth\.getUser\(\)/);
  assert.match(client,/user\?\.id !== owner/);
  assert.doesNotMatch(client,/service_role|sb_secret_|innerHTML/);
});

test('one accessible bell follows the account on every header and works on mobile',()=>{
  const badge=read('header-account.js');
  const bell=read('header-notifications.js');
  const styles=read('header-notifications.css');
  const navigation=read('header-scroll.js');
  assert.match(navigation,/nav\.replaceChildren\(\.\.\.links,account/);
  assert.match(navigation,/header-account\.js/);
  assert.match(badge,/new URL\('header-notifications\.js', scriptBase\)/);
  assert.match(bell,/account\.after\(shell\)/);
  assert.match(bell,/document\.getElementById\('headerNotifications'\)/);
  assert.match(bell,/aria-expanded/);
  assert.match(bell,/aria-controls/);
  assert.match(bell,/Escape/);
  assert.match(bell,/header-notifications\.css/);
  assert.match(bell,/episodios\/\$\{item\.episode_slug\}\.html#communityHeading/);
  assert.match(bell,/fanarts-galeria\.html\?art=/);
  assert.match(bell,/window\.addEventListener\('focus'/);
  assert.match(styles,/\.header-notifications-panel\[hidden\]/);
  assert.match(styles,/@media\(max-width:1100px\)/);
  assert.match(styles,/position:static/);
  assert.match(styles,/focus-visible|header-notifications-bell/);
});

test('reply notifications and server-resolved mentions cover episodes and fanarts without mass-mention guesses',()=>{
  assert.match(sql,/NEW\.parent_id IS NOT NULL/);
  assert.match(sql,/NEW\.status <> 'visible'/);
  assert.match(sql,/regexp_split_to_table\(lower\(NEW\.body\)/g);
  assert.match(sql,/token ~ '\^@\[a-z0-9_\]\{3,24\}\$'/g);
  assert.match(sql,/FROM public\.profiles WHERE username=v_username/g);
  assert.match(sql,/EXCEPT/g);
  assert.match(sql,/LIMIT 5/g);
  assert.match(sql,/episode_notify_comment_edit AFTER UPDATE OF body/);
  assert.match(sql,/fanart_notify_comment_edit AFTER UPDATE OF body/);
  const mentions=read('community-mentions.js');
  assert.match(mentions,/\.like\('username',term\.toLowerCase\(\)\+'%'\)/);
  assert.match(mentions,/input\.setRangeText\(mention/);
  assert.match(mentions,/reply-form textarea/);
  assert.match(mentions,/#fanart-comment-body/);
  assert.doesNotMatch(mentions,/innerHTML|service_role|sb_secret_/);
});

test('mention finder searches public names and unique handles without exposing private identities',()=>{
  const finder=read('community-mentions.js');
  const css=read('community-mention-finder.css');
  assert.match(finder,/\.select\('username,display_name'\)/);
  assert.match(finder,/\.ilike\('display_name','%'\+nameTerm\+'%'\)/);
  assert.match(finder,/people\.set\(person\.username,person\)/);
  assert.match(finder,/@'\+person\.username/);
  assert.match(finder,/const eligible='#commentBody, \.reply-form textarea, #fanart-comment-body'/);
  assert.match(finder,/toggle\.dataset\.pt='Encontrar alguém para mencionar'/);
  assert.match(finder,/toggle\.setAttribute\('aria-expanded'/);
  assert.match(finder,/finder\.addEventListener\('keydown'/);
  assert.match(finder,/event\.key==='Escape'/);
  assert.match(finder,/input\.maxLength>0/);
  assert.match(finder,/new URL\('community-mention-finder\.css',scriptBase\)/);
  assert.doesNotMatch(finder,/\.select\('[^']*(?:author_id|email)/);
  assert.doesNotMatch(finder,/innerHTML\s*=|service_role|sb_secret_/);
  assert.match(css,/\.community-mention-finder\[hidden\]/);
  assert.match(css,/@media\(max-width:520px\)/);
});

test('editing either comment type archives previous body privately for moderators',()=>{
  assert.match(sql,/CREATE TABLE community_private\.comment_edit_history/);
  assert.match(sql,/ALTER TABLE community_private\.comment_edit_history ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON community_private\.comment_edit_history FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/BEFORE UPDATE OF body ON public\.comments/);
  assert.match(sql,/BEFORE UPDATE OF body ON public\.fanart_comments/);
  assert.match(sql,/NEW\.body IS DISTINCT FROM OLD\.body/g);
  assert.match(sql,/moderation_comment_edit_history\(p_kind text,p_id text\)/);
  assert.match(sql,/NOT community_private\.is_moderator\(\)/);
  assert.match(audit,/moderation_recent_comment_edits/);
  assert.match(audit,/NOT community_private\.is_moderator\(\)/);
  const mod=read('moderation-edit-history.js');
  assert.match(mod,/rpc\('moderation_recent_comment_edits'/);
  assert.match(mod,/rpc\('moderation_comment_edit_history'/);
  assert.match(mod,/content\.textContent=item\.prior_text/);
  assert.doesNotMatch(mod,/innerHTML/);
});

test('featured works are manually set by moderators, auditable and capped at six',()=>{
  assert.match(sql,/ADD COLUMN featured boolean NOT NULL DEFAULT false/);
  assert.match(sql,/fanart_feature_moderator_update/);
  assert.match(sql,/SELECT public\.is_moderator\(\)/);
  assert.match(sql,/fanart_feature_history/);
  assert.match(sql,/>=6/);
  const mod=read('moderation-featured-fanarts.js');
  assert.match(mod,/\.update\(\{featured:!art\.featured\}\)/);
  assert.match(mod,/rpc\('is_moderator'\)/);
  assert.doesNotMatch(mod,/fanart_votes|fanart_vote_totals/);
  const showcase=read('fanarts-featured.js');
  assert.match(showcase,/\.eq\('featured',true\)/);
  assert.match(showcase,/\.limit\(6\)/);
  assert.match(showcase,/art\.tags\.includes\('Spoiler'\)/);
  assert.match(showcase,/fanarts-featured-hidden/);
  assert.doesNotMatch(showcase,/fanart_votes|fanart_vote_totals|innerHTML/);
});

test('scripts are loaded only on relevant pages after deferred Supabase loads',()=>{
  const reader=read('reader.js');
  const panel=read('community-panel.js');
  for(const name of ['fanarts-featured.js','community-notifications.js','moderation-edit-history.js',
    'moderation-featured-fanarts.js','community-mentions.js']){
    assert.ok(reader.includes(name)||panel.includes(name),`missing module ${name}`);
  }
  assert.match(reader,/DOMContentLoaded/);
  assert.match(panel,/DOMContentLoaded/);
  assert.match(reader,/community-social\.css/);
  assert.match(panel,/community-social\.css/);
});
