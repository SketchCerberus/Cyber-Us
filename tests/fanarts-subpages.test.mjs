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
  assert.match(submit,/data-pt="Nome do autor" data-en="Author name"/);
});

test('Fanarts overview does not duplicate the upload form and links to the submission page',()=>{
  const overview=read('fanarts.html');
  const submit=read('fanarts-publicar.html');
  const gallery=read('fanarts-gallery.js');
  assert.match(overview,/src="fanarts-gallery\.js"/);
  assert.match(overview,/class="fanarts-subnav"/);
  assert.match(overview,/href="fanarts-galeria\.html"/);
  assert.match(overview,/href="fanarts-publicar\.html"/);
  assert.match(overview,/data-pt="Ir para Publicar/);
  assert.match(overview,/data-en="Go to Submit/);
  assert.doesNotMatch(overview,/class="fanarts-form-preview"|class="fanarts-submission"|id="fanarts-image"/);
  assert.doesNotMatch(overview,/src="fanarts-submit\.js"|src="fanarts-my-submissions\.js"/);
  assert.match(submit,/class="fanarts-form-preview"/);
  assert.match(submit,/src="fanarts-submit\.js"/);
  assert.match(submit,/src="fanarts-my-submissions\.js"/);
  assert.doesNotMatch(gallery,/gallery\.closest\('main'\)\?\.prepend\(nav\)/);
});

test('only the live gallery search is injected on both gallery pages, not the legacy second search',()=>{
  const gallery=read('fanarts-gallery.js');
  const reader=read('reader.js');
  const overview=read('fanarts.html');
  const full=read('fanarts-galeria.html');
  assert.match(gallery,/status\.before\(search\)/);
  assert.doesNotMatch(gallery,/if \(!overview\) status\.before\(search\)/);
  assert.match(gallery,/searchInput\.addEventListener\('input',applyFilters\)/);
  assert.match(reader,/!document\.querySelector\('script\[src="fanarts-gallery\.js"\]'\)/);
  assert.match(reader,/showcase\.src = 'fanarts-showcase\.js'/);
  assert.match(overview,/src="fanarts-gallery\.js"/);
  assert.match(full,/src="fanarts-gallery\.js"/);
  assert.doesNotMatch(overview,/src="fanarts-showcase\.js"|id="fanarts-search-input"/);
});

test('submitted and published tags match the expanded database vocabulary',()=>{
  const upload=read('fanarts-submit.js');
  const gallery=read('fanarts-gallery.js');
  const migration=read('supabase/migrations/20260921210500_correct_fanart_malware_tag.sql');
  const tags=['Malware','Swap','E se...','Fofo','Sério','Chibi'];
  for(const tag of tags) {
    for(const file of [upload,gallery,migration]) {
      assert.ok(file.includes(`'${tag}'`),`tag ${tag} missing from file`);
    }
  }
  assert.doesNotMatch(upload,/Malwer/);
  assert.doesNotMatch(gallery,/Malwer/);
  assert.match(migration,/array_replace\(tags, 'Malwer', 'Malware'\)/);
  assert.match(upload,/\['E se\.\.\.','E se\.\.\.','What if\.\.\.'\]/);
  assert.match(upload,/\['Fofo','Fofo','Cute'\]/);
  assert.match(upload,/\['Sério','Sério','Serious'\]/);
  assert.match(upload,/tagInputs\.filter\(input=>input\.checked\)\.length>8/);
  assert.match(migration,/cardinality\(tags\) <= 8/g);
});

test('tags are public only after manual approval and are validated in database',()=>{
  const migration=read('supabase/migrations/20260921192000_fanart_tags.sql');
  const correction=read('supabase/migrations/20260921210500_correct_fanart_malware_tag.sql');
  const upload=read('fanarts-submit.js');
  const gallery=read('fanarts-gallery.js');
  assert.match(migration,/fanart_gallery_copy_tags/);
  assert.match(migration,/s\.status = 'approved'/);
  assert.match(migration,/GRANT INSERT\(tags\)/);
  assert.match(correction,/fanart_public_tags_allowed CHECK/);
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
