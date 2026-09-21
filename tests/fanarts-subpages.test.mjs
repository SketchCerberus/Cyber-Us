import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('gallery and publication routes have bilingual navigation and shared header',()=>{
  const gallery=read('fanarts-galeria.html');
  const submit=read('fanarts-publicar.html');
  for(const page of [gallery,submit]) {
    assert.match(page,/src="reader\.js"/);
    assert.match(page,/src="header-scroll\.js"/);
    assert.match(page,/fanarts-subnav/);
    assert.match(page,/data-pt=/);
    assert.match(page,/data-en=/);
    assert.match(page,/fanarts-galeria\.html/);
    assert.match(page,/fanarts-publicar\.html/);
  }
  assert.match(gallery,/src="fanarts-gallery\.js"/);
  assert.match(gallery,/src="fanarts-detail\.js"/);
  assert.match(submit,/src="fanarts-submit\.js"/);
  assert.match(submit,/src="fanarts-my-submissions\.js"/);
});

test('original fanarts page links to subpages without removing its existing workflows',()=>{
  const landing=read('fanarts.html');
  const gallery=read('fanarts-gallery.js');
  assert.match(landing,/src="fanarts-submit\.js"/);
  assert.match(landing,/src="fanarts-gallery\.js"/);
  assert.match(gallery,/fanarts-galeria\.html/);
  assert.match(gallery,/fanarts-publicar\.html/);
});

test('tags are public only after manual approval and are validated in database',()=>{
  const migration=read('supabase/migrations/20260921192000_fanart_tags.sql');
  const upload=read('fanarts-submit.js');
  const gallery=read('fanarts-gallery.js');
  assert.match(migration,/fanart_gallery_copy_tags/);
  assert.match(migration,/s\.status = 'approved'/);
  assert.match(migration,/GRANT INSERT\(tags\)/);
  assert.match(migration,/cardinality\(tags\) <= 8/g);
  assert.match(upload,/tagInputs\.filter/);
  assert.match(upload,/tags,extension/);
  assert.match(gallery,/from\('fanart_gallery'\)/);
  assert.doesNotMatch(gallery,/user_id/);
});

test('votes and comments restrict account identity and require membership checks',()=>{
  const sql=read('supabase/migrations/20260921193000_fanart_reactions_comments.sql');
  const viewer=read('fanarts-detail.js');
  assert.match(sql,/ALTER TABLE public\.fanart_votes ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/ALTER TABLE public\.fanart_comments ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/PRIMARY KEY\(submission_id,user_id\)/);
  assert.match(sql,/user_id=\(SELECT auth\.uid\(\)\)/);
  assert.match(sql,/author_id=\(SELECT auth\.uid\(\)\)/);
  assert.match(sql,/email_confirmed_at IS NOT NULL/g);
  assert.match(sql,/ON DELETE CASCADE/g);
  assert.doesNotMatch(sql,/GRANT SELECT\(.*author_id/);
  assert.match(viewer,/from\('fanart_vote_totals'\)/);
  assert.match(viewer,/from\('fanart_comments'\)/);
  assert.match(viewer,/textContent=item\.body/);
  assert.doesNotMatch(viewer,/\.innerHTML\s*=/);
  assert.doesNotMatch(viewer,/from\('fanart_submissions'\)/);
});

test('the thank-you screen is only shown after the upload success event',()=>{
  const submit=read('fanarts-submit.js');
  const list=read('fanarts-my-submissions.js');
  assert.match(submit,/window\.dispatchEvent\(new Event\('cyberus:fanart-uploaded'\)\)/);
  assert.match(list,/window\.addEventListener\('cyberus:fanart-uploaded'/);
  assert.match(list,/thankYou\.hidden=false/);
  assert.match(list,/Thank you for sharing your artwork/);
});
