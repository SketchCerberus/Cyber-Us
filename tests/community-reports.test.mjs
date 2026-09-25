import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('all episode roots and replies share the reporting entrypoint, with no duplicate fanart controls',()=>{
 for(const name of ['episodio-01','episodio-02','episodio-03','episodio-04','episodio-05','marco-zero']){
  const html=read(`episodios/${name}.html`);
  assert.equal((html.match(/src="..\/fanarts-reports.js"/g)||[]).length,1);
  assert.match(html,/community-reports.css/);
 }
 const source=read('community.js');const renderer=source.slice(source.indexOf('async function appendComments'),source.indexOf('async function loadComments'));
 assert.match(renderer,/if \(!comment.deleted_by_author\) item.dataset.reportId = comment.id/);
 assert.match(renderer,/appendComments\(result.data/);
 assert.equal((read('fanarts-galeria.html').match(/src="fanarts-reports.js"/g)||[]).length,1);
 assert.match(read('fanarts-detail.js'),/detail.dataset.submissionId=id/);
});
test('public RPC wrappers are invokers; private ledger and helper functions have explicit grants',()=>{
 const sql=read('supabase/migrations/20260925012948_community_reports.sql');
 assert.match(sql,/ALTER TABLE community_private.content_reports ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON community_private.content_reports FROM PUBLIC,anon,authenticated/);
 for(const name of ['submit_content_report','list_content_reports','resolve_content_report']){
  const wrapper=sql.slice(sql.indexOf(`CREATE FUNCTION public.${name}`));
  assert.match(wrapper.slice(0,wrapper.indexOf('REVOKE')),/SECURITY INVOKER/);
 }
 const shape=sql.slice(sql.indexOf('CREATE FUNCTION public.list_content_reports'),sql.indexOf('REVOKE ALL ON FUNCTION community_private.list_content_reports'));
 assert.doesNotMatch(shape,/reporter_id|target_author|handled_by/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/UNIQUE\(kind,target_id,reporter_id\)/);
 assert.match(sql,/mirror_community_report AFTER INSERT OR UPDATE/);
});
