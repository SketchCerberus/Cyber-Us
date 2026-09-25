import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
test.after(()=>browser.close());
const uuid='11111111-1111-4111-8111-111111111111';
async function pageFor({staff=false,user=true,width=375}={}){
 const page=await browser.newPage({viewport:{width,height:850}});
 await page.setContent(`<html lang="pt-BR"><body>${staff?'<div id="moderationWorkspace"></div>':`<ul><li class="comment-item" data-report-id="${uuid}"><p>Episode comment</p><ul><li class="comment-item" data-report-id="22222222-2222-4222-8222-222222222222">Reply</li></ul></li></ul><article class="fanarts-comment" data-comment-id="17">Fanart comment</article><figure class="fanarts-gallery-work" data-submission-id="${uuid}"><figcaption>Artwork</figcaption></figure><section class="fanarts-detail" data-submission-id="${uuid}"></section>`}</body></html>`);
 await page.addStyleTag({content:read('community-reports.css')});
 await page.evaluate(({user,uuid})=>{
  window.calls=[];window.rpcError=null;window.copyError=false;window.signedOut=null;
  window.rows=[{id:1,kind:'episode_comment',target_id:uuid,reason:'spam: fixture',evidence:'<script>unsafe</script>',context:'episodio-01',status:'open',created_at:'2026-09-24T00:00:00Z'},
    {id:2,kind:'fanart',target_id:uuid,reason:'copyright',evidence:'Artwork',context:uuid+'.png',status:'open',created_at:'2026-09-24T00:00:00Z'}];
  window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:user?{email_confirmed_at:'yes'}:null}}),onAuthStateChange(fn){window.signedOut=fn;}},
   rpc:async(name,args)=>{window.calls.push({name,args});if(window.rpcError)return {error:window.rpcError};return {data:name==='list_content_reports'?window.rows:true};},
   from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{image_path:uuid+'.png'}})})})}),
   storage:{from:bucket=>({getPublicUrl:path=>({data:{publicUrl:'https://example.invalid/'+path}}),
    copy:async()=>{window.calls.push({name:'copy',bucket});return window.copyError?{error:{message:'failed'}}:{};},
    download:async()=>({error:{message:'not found'}}),createSignedUrl:async()=>({error:{message:'not found'}}),
    remove:async()=>{window.calls.push({name:'cleanup',bucket});return {};}})}
  })};
 },{user,uuid});
 await page.route('https://example.invalid/**',route=>route.abort());
 await page.addScriptTag({content:read(staff?'moderation-fanart-reports.js':'fanarts-reports.js')});
 return page;
}
test('all target types mount once; PT/EN, focus, escape, visitor, and 320/375/1280 layouts',async()=>{
 for(const width of [320,375,1280]){
  const p=await pageFor({width,user:false});
  assert.equal(await p.locator('.content-report').count(),5);
  await p.evaluate(()=>document.body.append(document.createElement('span')));
  assert.equal(await p.locator('.content-report').count(),5);
  const box=p.locator('.fanarts-comment > .content-report');
  await box.getByRole('button',{name:'Denunciar comentário'}).click();
  assert.equal(await box.locator('select').evaluate(n=>n===document.activeElement),true);
  await box.locator('select').selectOption('spam');
  await box.getByRole('button',{name:'Enviar denúncia'}).click();
  assert.match(await box.getByRole('status').textContent(),/conta verificada/);
  assert.equal((await p.evaluate(()=>window.calls)).length,0);
  await box.locator('textarea').press('Escape');
  assert.equal(await box.locator('form').isVisible(),false);
  assert.equal(await box.locator('button').first().evaluate(n=>n===document.activeElement),true);
  await p.evaluate(()=>document.documentElement.lang='en');
  await box.getByRole('button',{name:'Report comment',exact:true}).click();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await box.locator('textarea').getAttribute('maxlength'),'300');
  await p.close();
 }
});
test('verified submission preserves target, duplicates and network failures keep useful feedback',async()=>{
 const p=await pageFor();const box=p.locator('.fanarts-comment > .content-report');
 await box.getByRole('button',{name:'Denunciar comentário'}).click();
 await box.locator('select').selectOption('harassment');await box.locator('textarea').fill('  detalhes  ');
 await box.getByRole('button',{name:'Enviar denúncia'}).click();
 assert.deepEqual((await p.evaluate(()=>window.calls))[0],{name:'submit_content_report',args:{p_kind:'fanart_comment',p_target_id:'17',p_reason:'harassment',p_details:'detalhes'}});
 assert.match(await box.getByRole('status').textContent(),/enviada em privado/);
 await p.evaluate(()=>window.rpcError={code:'23505'});
 await box.getByRole('button',{name:'Denunciar comentário'}).click();await box.locator('select').selectOption('spam');
 await box.getByRole('button',{name:'Enviar denúncia'}).click();assert.match(await box.getByRole('status').textContent(),/já denunciou/);
 await p.evaluate(()=>window.rpcError={code:'P0001'});await box.getByRole('button',{name:'Enviar denúncia'}).click();assert.match(await box.getByRole('status').textContent(),/20 denúncias/);
 assert.equal(await box.getByRole('button',{name:'Enviar denúncia'}).isEnabled(),true);
 await p.close();
});
test('switching artwork replaces the form and cannot report a stale target',async()=>{
 const p=await pageFor();const next='33333333-3333-4333-8333-333333333333';
 await p.evaluate(next=>document.querySelector('.fanarts-detail').dataset.submissionId=next,next);
 const box=p.locator('.fanarts-detail > .content-report');await box.getByRole('button',{name:'Denunciar obra'}).click();
 await box.locator('select').selectOption('copyright');await box.getByRole('button',{name:'Enviar denúncia'}).click();
 assert.equal((await p.evaluate(()=>window.calls))[0].args.p_target_id,next);assert.equal(await box.count(),1);await p.close();
});
test('staff queue escapes evidence, audits decisions, copies artwork before removal and clears on logout',async()=>{
 const p=await pageFor({staff:true});await p.locator('summary').click();
 await p.waitForFunction(()=>document.querySelectorAll('.content-report-queue li').length===2);
 assert.equal(await p.locator('blockquote').first().textContent(),'<script>unsafe</script>');
 const row=p.locator('li').first();await row.locator('textarea').fill('Sem infração');
 await row.getByRole('button',{name:'Confirmar decisão'}).click();
 assert.ok((await p.evaluate(()=>window.calls)).some(c=>c.name==='resolve_content_report'&&c.args.p_action==='dismiss'&&c.args.p_reason==='Sem infração'));
 const art=p.locator('li').nth(1);await art.locator('textarea').fill('Violação confirmada');await art.locator('select').selectOption('remove');
 await art.getByRole('button',{name:'Confirmar decisão'}).click();
 const calls=await p.evaluate(()=>window.calls);const copy=calls.findIndex(c=>c.name==='copy');const resolve=calls.findIndex(c=>c.name==='resolve_content_report'&&c.args.p_id===2);
 assert.ok(copy>=0&&resolve>copy);assert.ok(calls.findIndex(c=>c.name==='cleanup')>resolve);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.evaluate(()=>window.signedOut());assert.equal(await p.locator('li').count(),0);assert.equal(await p.locator('details').getAttribute('open'),null);await p.close();
});
test('failed private backup does not moderate artwork; unauthorized queue shows no report',async()=>{
 const p=await pageFor({staff:true});await p.locator('summary').click();await p.waitForFunction(()=>document.querySelectorAll('li').length===2);
 await p.evaluate(()=>window.copyError=true);const art=p.locator('li').nth(1);
 await art.locator('textarea').fill('Violation');await art.locator('select').selectOption('remove');await art.getByRole('button',{name:'Confirmar decisão'}).click();
 assert.equal((await p.evaluate(()=>window.calls)).filter(c=>c.name==='resolve_content_report').length,0);
 await p.evaluate(()=>window.rpcError={code:'42501'});await p.getByRole('button',{name:'Atualizar denúncias'}).click();assert.equal(await p.locator('li').count(),0);await p.close();
});
