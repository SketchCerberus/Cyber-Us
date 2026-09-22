import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('fanart comment form never requests a free-form name',()=>{
  const client=read('fanarts-detail.js');
  assert.doesNotMatch(client,/fanart-comment-name|Nome público|Public display name|name\.value/);
  assert.match(client,/identityHint\.dataset\.pt=/);
  assert.match(client,/identityHint\.dataset\.en=/);
  assert.match(client,/form\.append\(identityHint,bodyLabel,body,consent,submit,commentNote\)/);
  assert.match(client,/\.insert\(\{submission_id:id,author_id:user\.id,body:message\}\)/);
  assert.doesNotMatch(client,/\.insert\(\{[^\n]*display_name/);
  assert.match(client,/author\.textContent=item\.display_name/);
  assert.doesNotMatch(client,/article\.dataset\.authorId/);
});

test('database overrides forged display names, migrates old comments and follows profile changes',()=>{
  const sql=read('supabase/migrations/20260922142647_fanart_comments_use_profile_username.sql');
  assert.match(sql,/ALTER TABLE public\.fanart_comments ALTER COLUMN display_name SET DEFAULT 'Leitor'/);
  assert.match(sql,/NEW\.author_id IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(sql,/FROM public\.profiles AS p/);
  assert.match(sql,/NEW\.display_name:=v_profile_name/);
  assert.match(sql,/UPDATE public\.fanart_comments AS c/);
  assert.match(sql,/CREATE TRIGGER fanart_comments_sync_profile_name/);
  assert.match(sql,/AFTER UPDATE OF username,display_name ON public\.profiles/);
  assert.match(sql,/WHERE c\.author_id=NEW\.id/);
  assert.doesNotMatch(sql,/GRANT SELECT\s*\([^)]*author_id/);
});
