import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('global navigation highlights the Fanarts section on both subpages',()=>{
  const nav=read('header-scroll.js');
  assert.match(nav,/fanarts-galeria\.html/);
  assert.match(nav,/fanarts-publicar\.html/);
  assert.match(nav,/activeFile = 'fanarts\.html'/);
});

test('moderation page loads fanart comment review after existing fanart moderator',()=>{
  const page=read('moderacao.html');
  const original=page.indexOf('src="moderation-fanarts.js"');
  const extended=page.indexOf('src="moderation-fanart-comments.js"');
  assert.ok(original>=0 && extended>original);
  const code=read('moderation-fanart-comments.js');
  assert.match(code,/rpc\('is_moderator'\)/);
  assert.match(code,/rpc\('moderate_fanart_comment'/);
  assert.match(code,/if\(!allowed\|\|view\.hidden\)return/);
  assert.doesNotMatch(code,/\.innerHTML\s*=/);
  assert.doesNotMatch(code,/select\([^)]*author_id/);
});

test('fanart comment removal requires staff, a reason and private audit logging',()=>{
  const sql=read('supabase/migrations/20260921194500_fanart_comment_moderation.sql');
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON community_private\.fanart_comment_moderation_log FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/community_private\.is_moderator\(\)/);
  assert.match(sql,/char_length\(v_reason\) NOT BETWEEN 3 AND 500/);
  assert.match(sql,/INSERT INTO community_private\.fanart_comment_moderation_log/);
  assert.match(sql,/DELETE FROM public\.fanart_comments/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.moderate_fanart_comment\(bigint,text\) FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.moderate_fanart_comment\(bigint,text\) TO authenticated/);
});

test('new interactions restrict exposed identities and attach only to approved artworks',()=>{
  const sql=read('supabase/migrations/20260921193000_fanart_reactions_comments.sql');
  assert.match(sql,/REFERENCES public\.fanart_gallery\(submission_id\) ON DELETE CASCADE/g);
  assert.match(sql,/security_invoker=true/);
  assert.match(sql,/GRANT SELECT\(submission_id,value\)/);
  assert.match(sql,/GRANT SELECT\(id,submission_id,display_name,body,created_at\)/);
  assert.doesNotMatch(sql,/GRANT SELECT\([^;]*user_id/);
  assert.doesNotMatch(sql,/GRANT SELECT\([^;]*author_id/);
});
