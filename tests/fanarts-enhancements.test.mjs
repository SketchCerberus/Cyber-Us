import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all five requested tags work across upload, gallery and server constraints',()=>{
  const files=['fanarts-submit.js','fanarts-gallery.js',
    'supabase/migrations/20260921224000_fanart_spoilers_and_comment_reports.sql'].map(read);
  for(const tag of ['AU','Humor','Colaboração','WIP','Spoiler'])
    for(const file of files)assert.ok(file.includes(`'${tag}'`),`${tag} missing`);
  assert.match(files[0],/\['AU','Universo alternativo \(AU\)','Alternate universe \(AU\)'\]/);
  assert.match(files[0],/\['WIP','Em progresso \(WIP\)','Work in progress \(WIP\)'\]/);
  assert.match(files[0],/\['Spoiler','Spoiler','Spoiler'\]/);
  assert.match(files[0],/tagInputs\.filter\(input=>input\.checked\)\.length>8/);
  assert.equal((files[2].match(/cardinality\(tags\) <= 8/g)||[]).length,2);
  assert.match(read('supabase/migrations/20260921192000_fanart_tags.sql'),/s\.status = 'approved'/);
});

test('preview is local, bilingual, revokes object URLs and does not bypass reviewed upload',()=>{
  const upload=read('fanarts-submit.js');
  const page=read('fanarts-publicar.html');
  assert.match(page,/fanarts-enhancements\.css/);
  assert.match(upload,/URL\.createObjectURL\(file\)/);
  assert.match(upload,/URL\.revokeObjectURL\(previewUrl\)/);
  assert.match(upload,/previewImage\.src=previewUrl/);
  assert.match(upload,/previewTitle\.textContent=workTitle/);
  assert.match(upload,/previewArtist\.textContent=/);
  assert.match(upload,/previewTags\.replaceChildren\(\)/);
  assert.match(upload,/window\.addEventListener\('cyberus:fanart-uploaded',clearPreview\)/);
  assert.match(upload,/window\.addEventListener\('pagehide',clearPreview/);
  assert.match(upload,/Prévia somente neste dispositivo/);
  assert.match(upload,/Preview only on this device/);
  assert.ok(upload.indexOf('URL.createObjectURL(file)')<upload.indexOf("db.from('fanart_submissions').insert"));
  assert.match(upload,/db\.storage\.from\('fanart-pending'\)\.upload/);
  assert.doesNotMatch(upload,/innerHTML\s*=/);
});

test('preview frame follows blue, red and green selection using published gallery palette',()=>{
  const page=read('fanarts-publicar.html');
  const frame=read('fanarts-preview-frame.css');
  const upload=read('fanarts-submit.js');
  const gallery=read('fanarts-showcase.css');
  assert.match(page,/href="fanarts-preview-frame\.css\?v=20260922-frame"/);
  assert.match(upload,/previewCard\.dataset\.accent=accent\.value/);
  assert.match(upload,/field\.addEventListener\('change',renderPreview\)/);
  for(const [name,hex] of [['blue','#72e5ff'],['red','#ff647d'],['green','#79f7ab']]){
    assert.match(frame,new RegExp(`\\.fanarts-upload-preview\\[data-accent="${name}"\\]\\{--preview-neon:${hex}\\}`));
    assert.ok(gallery.includes(`--showcase-neon:${hex}`),`${name} must match the real gallery`);
  }
  assert.match(frame,/\.fanarts-upload-preview-image\{/);
  assert.match(frame,/\.fanarts-upload-preview figcaption\{/);
  assert.match(frame,/\.fanarts-upload-preview\[data-accent="random"\]\{/);
  assert.match(frame,/linear-gradient\(125deg,#72e5ff,#ff647d,#79f7ab\) border-box/);
  assert.match(upload,/previewCard\.hidden=true/);
  assert.match(upload,/form\.reset\(\)/);
});

test('spoiler protection covers overview, gallery and expanded details until explicit reveal',()=>{
  const overview=read('fanarts.html'),galleryPage=read('fanarts-galeria.html');
  const gallery=read('fanarts-gallery.js'),spoiler=read('fanarts-spoilers.js'),css=read('fanarts-enhancements.css');
  for(const html of [overview,galleryPage]){
    assert.match(html,/src="fanarts-spoilers\.js"/);
    assert.match(html,/href="fanarts-enhancements\.css"/);
  }
  assert.match(gallery,/figure\.dataset\.spoiler=String\(work\.tags\.includes\('Spoiler'\)\)/);
  assert.match(spoiler,/card\.classList\.add\('fanarts-spoiler-locked'\)/);
  assert.match(spoiler,/fanarts-detail-spoiler-locked/);
  assert.match(spoiler,/reveal\.addEventListener\('click'/);
  assert.match(spoiler,/detailReveal\.addEventListener\('click'/);
  assert.match(spoiler,/Fanart com spoiler oculto/);
  assert.match(css,/fanarts-spoiler-locked figcaption\{visibility:hidden\}/);
  assert.match(css,/fanarts-detail-spoiler-locked \.fanarts-interactions\{display:none\}/);
  assert.doesNotMatch(spoiler,/innerHTML\s*=/);
});

test('comment reports expose public comment IDs only, require login and remain private in SQL',()=>{
  const page=read('fanarts-galeria.html'),detail=read('fanarts-detail.js');
  const client=read('fanarts-reports.js');
  const sql=read('supabase/migrations/20260921224000_fanart_spoilers_and_comment_reports.sql');
  assert.match(page,/src="fanarts-reports\.js"/);
  assert.match(detail,/article\.dataset\.commentId=String\(item\.id\)/);
  assert.doesNotMatch(detail,/article\.dataset\.authorId/);
  assert.match(client,/db\.auth\.getUser\(\)/);
  assert.match(client,/db\.rpc\('submit_content_report'/);
  assert.match(client,/p_kind:kind,p_target_id:id,p_reason:selected/);
  assert.doesNotMatch(client,/author_id|reporter_id|innerHTML\s*=/);
  assert.match(sql,/ALTER TABLE public\.fanart_comment_reports ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON public\.fanart_comment_reports FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/fanart_report_staff_read/);
  assert.match(sql,/reporter_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql,/email_confirmed_at IS NOT NULL/);
  assert.match(sql,/UNIQUE\(comment_id,reporter_id\)/);
  assert.match(sql,/Report daily limit reached/);
  assert.doesNotMatch(sql,/GRANT SELECT\([^)]*reporter_id/);
});

test('staff can triage reports only in the existing moderated workspace',()=>{
  const html=read('moderacao.html');
  const server=read('moderation-fanart-reports.js');
  const log=read('supabase/migrations/20260921194500_fanart_comment_moderation.sql');
  assert.match(html,/src="moderation-fanart-reports\.js"/);
  assert.match(server,/moderationWorkspace/);
  assert.match(server,/db\.rpc\('list_content_reports'/);
  assert.match(server,/p_status:filter.value/);
  assert.match(server,/'dismiss','Dispensar denúncia'/);
  assert.match(server,/db\.rpc\('resolve_content_report'/);
  assert.match(log,/fanart_comment_moderation_log/);
  assert.doesNotMatch(server,/innerHTML\s*=/);
});
