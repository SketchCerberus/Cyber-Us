import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const accountId = '11111111-2222-4333-8444-555555555555';
const submissionId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const imagePath = `${accountId}/${submissionId}.png`;

function setup({staff=true,submissions}={}) {
  class Element {
    constructor(tag) {
      this.tag=tag;this.children=[];this.attributes={};this.handlers={};this.dataset={};
      this.hidden=false;this.textContent='';this.value='';this.disabled=false;
      this.classList={toggle:()=>{}};
    }
    append(...children) {this.children.push(...children);for(const item of children)if(item&&typeof item==='object')item.parent=this;}
    appendChild(child) {this.append(child);return child;}
    insertBefore(item,before) {const i=this.children.indexOf(before);this.children.splice(i<0?this.children.length:i,0,item);item.parent=this;}
    replaceChildren(...items) {this.children=[];this.append(...items);}
    setAttribute(name,value) {this.attributes[name]=value;}
    addEventListener(name,fn) {(this.handlers[name]??=[]).push(fn);}
    async fire(name) {for(const fn of this.handlers[name]||[])await fn({preventDefault(){},currentTarget:this});}
    find(id) {
      if(this.id===id)return this;
      for(const child of this.children){const found=child.find?.(id);if(found)return found;}
      return null;
    }
  }
  const make=(tag,id)=>{const item=new Element(tag);item.id=id;return item;};
  const workspace=make('div','moderationWorkspace');
  const tabs=make('div','tabs');tabs.className='moderation-tabs';
  const commentsTab=make('button','moderationCommentsTab');
  const bansTab=make('button','moderationBansTab');
  const appealsTab=make('button','moderationAppealsTab');
  tabs.append(commentsTab,bansTab,appealsTab);
  workspace.append(tabs,make('section','moderationCommentsView'),make('section','moderationBansView'),make('section','moderationAppealsView'));
  const works=submissions??[{
    id:submissionId,user_id:accountId,artist_name:'Reader',title:'Blue Fire',region:'BR',show_region:true,
    artist_link:'https://example.com',accent:'blue',extension:'png',image_path:imagePath,status:'pending',
    created_at:'2026-09-21T17:03:52Z'
  }];
  const log={rpc:[],lookup:[],confirm:[],prompt:[],removed:[],signed:[],downloads:[],uploads:[],publicUrls:[]};
  const db={
    auth:{getUser:async()=>({data:{user:{id:accountId}},error:null}),onAuthStateChange:()=>{}},
    rpc:async(name,args)=>{
      log.rpc.push({name,args});
      if(name==='is_moderator')return {data:staff,error:null};
      if(name==='moderation_active_bans_with_history'||name==='moderation_active_ban_categories')return {data:[],error:null};
      if(name==='moderate_fanart_submission'||name==='publish_fanart_submission'||name==='ban_member_categorized')return {data:true,error:null};
      return {data:null,error:{message:'unknown RPC'}};
    },
    from:name=>{
      if(name==='fanart_submissions')return {select:()=>({
        in:()=>({order(){return this;},limit:async()=>({data:works,error:null})})
      })};
      return {select:columns=>({eq:(key,value)=>({maybeSingle:async()=>{
        log.lookup.push({name,columns,key,value});
        return {data:{id:accountId,username:'reader1',display_name:'Reader'},error:null};
      }})})};
    },
    storage:{from:bucket=>({
      createSignedUrl:async(path,seconds)=>{log.signed.push({bucket,path,seconds});return {data:{signedUrl:'https://signed.example/preview'},error:null};},
      download:async path=>{log.downloads.push({bucket,path});return {data:{kind:'image-blob'},error:null};},
      upload:async(path,data,options)=>{log.uploads.push({bucket,path,data,options});return {data:{path},error:null};},
      getPublicUrl:path=>{log.publicUrls.push({bucket,path});return {data:{publicUrl:`https://public.example/${path}`}};},
      remove:async paths=>{log.removed.push({bucket,paths});return {data:paths,error:null};}
    })}
  };
  const document={
    documentElement:{lang:'pt-BR'},
    querySelector:selector=>selector==='.moderation-tabs'?tabs:null,
    getElementById:id=>workspace.find(id),
    createElement:tag=>new Element(tag)
  };
  class MutationObserver {observe(){}}
  vm.runInNewContext(read('moderation-fanarts.js'),{
    document,
    window:{
      supabase:{createClient:()=>db},
      confirm:text=>{log.confirm.push(text);return true;},
      prompt:text=>{log.prompt.push(text);return 'Not suitable';}
    },
    MutationObserver,setTimeout:fn=>fn(),Date,Intl,Set,Promise
  });
  return {workspace,tabs,commentsTab,bansTab,appealsTab,document,log};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('fanarts tab and queue stay hidden from non-moderators',async()=>{
  const {document,log}=setup({staff:false});
  await tick();
  assert.equal(document.getElementById('moderationFanartsTab').hidden,true);
  assert.equal(document.getElementById('moderationFanartsView').hidden,true);
  assert.equal(log.signed.length,0);
});

test('moderator opens the private queue and receives a signed preview',async()=>{
  const {document}=setup();
  await tick();
  const tab=document.getElementById('moderationFanartsTab');
  assert.equal(tab.hidden,false);
  await tab.fire('click');
  await tick();
  assert.equal(document.getElementById('moderationFanartsView').hidden,false);
  assert.ok(document.getElementById(`fanartApprove-${submissionId}`));
  assert.ok(document.getElementById(`fanartReject-${submissionId}`));
  const idBadge=document.getElementById(`fanartApprove-${submissionId}`).parent.parent.children
    .find(item=>item.className==='moderation-fanart-user-id');
  assert.equal(idBadge.textContent,`(ID: ${accountId})`);
});

test('approval copies the image, publishes metadata and cleans the private file',async()=>{
  const {document,log}=setup();
  await tick();
  await document.getElementById('moderationFanartsTab').fire('click');
  await tick();
  await document.getElementById(`fanartApprove-${submissionId}`).fire('click');
  const decision=log.rpc.find(call=>call.name==='publish_fanart_submission');
  assert.equal(decision.args.p_submission_id,submissionId);
  assert.equal(decision.args.p_public_path,`${submissionId}.png`);
  assert.deepEqual(log.downloads,[{bucket:'fanart-pending',path:imagePath}]);
  assert.equal(log.uploads[0].bucket,'fanart-public');
  assert.equal(log.uploads[0].path,`${submissionId}.png`);
  assert.equal(log.uploads[0].options.contentType,'image/png');
  assert.equal(log.uploads[0].options.upsert,true);
  assert.equal(log.removed.length,1);
  assert.equal(log.removed[0].bucket,'fanart-pending');
  assert.equal(log.removed[0].paths[0],imagePath);
});

test('rejection records a reason and deletes through the Storage API',async()=>{
  const {document,log}=setup();
  await tick();
  await document.getElementById('moderationFanartsTab').fire('click');
  await tick();
  await document.getElementById(`fanartReject-${submissionId}`).fire('click');
  const decision=log.rpc.find(call=>call.name==='moderate_fanart_submission');
  assert.equal(decision.args.p_submission_id,submissionId);
  assert.equal(decision.args.p_decision,'rejected');
  assert.equal(decision.args.p_reason,'Not suitable');
  assert.equal(log.removed[0].bucket,'fanart-pending');
  assert.equal(log.removed[0].paths[0],imagePath);
});

test('migration protects queue reads, previews and decisions on the server',()=>{
  const migration=read('supabase/migrations/20260921171522_fanart_moderation_review_queue.sql');
  const page=read('moderacao.html');
  const css=read('moderation-fanarts.css');
  assert.match(migration,/fanart_moderator_read/);
  assert.match(migration,/fanart_moderator_preview/);
  assert.match(migration,/fanart_moderator_remove/);
  assert.match(migration,/community_private\.is_moderator\(\)/);
  assert.match(migration,/security definer/i);
  assert.match(migration,/from public,anon/i);
  assert.match(migration,/fanart_moderation_log/);
  assert.match(page,/src="moderation-fanarts\.js"/);
  assert.match(css,/moderation-fanart-card/);
  assert.match(css,/moderation-fanart-user-id/);
});

test('publication migration exposes only sanitized gallery data',()=>{
  const migration=read('supabase/migrations/20260921173818_publish_approved_fanarts_automatically.sql');
  const gallery=read('fanarts-gallery.js');
  const page=read('fanarts.html');
  assert.match(migration,/create table public\.fanart_gallery/);
  assert.match(migration,/alter table public\.fanart_gallery enable row level security/);
  assert.match(migration,/grant select on public\.fanart_gallery to anon,authenticated/);
  assert.match(migration,/community_private\.is_moderator\(\)/);
  assert.match(migration,/case when v_work\.show_region/);
  assert.match(migration,/bucket_id='fanart-public'/);
  assert.match(migration,/Approvals must publish the fanart/);
  assert.match(gallery,/from\('fanart_gallery'\)/);
  assert.match(gallery,/storage\.from\('fanart-public'\)/);
  assert.doesNotMatch(gallery,/user_id/);
  assert.match(page,/src="fanarts-gallery\.js"/);
});
