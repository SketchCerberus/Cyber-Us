import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const accountId = '11111111-2222-4333-8444-555555555555';

function setup({staff=true}={}) {
  class Element {
    constructor(tag) {
      this.tag=tag;this.children=[];this.attributes={};this.handlers={};
      this.hidden=false;this.textContent='';this.value='';this.disabled=false;
      this.classList={toggle:()=>{}};
    }
    append(...children) {this.children.push(...children);for(const item of children)item.parent=this;}
    insertBefore(item,before) {const i=this.children.indexOf(before);this.children.splice(i<0?this.children.length:i,0,item);item.parent=this;}
    replaceChildren(...items) {this.children=[];this.append(...items);}
    setAttribute(name,value) {this.attributes[name]=value;}
    addEventListener(name,fn) {(this.handlers[name]??=[]).push(fn);}
    async fire(name) {
      for(const fn of this.handlers[name]||[])await fn({preventDefault(){},currentTarget:this});
    }
    find(id) {
      if(this.id===id)return this;
      for(const child of this.children){const found=child.find?.(id);if(found)return found;}
      return null;
    }
  }
  const make=(tag,id)=>{const item=new Element(tag);item.id=id;return item;};
  const workspace=make('div','moderationWorkspace');
  const tabs=make('div','tabs');
  tabs.className='moderation-tabs';
  const commentsTab=make('button','moderationCommentsTab');
  const bansTab=make('button','moderationBansTab');
  const appealsTab=make('button','moderationAppealsTab');
  tabs.append(commentsTab,bansTab,appealsTab);
  const commentsView=make('section','moderationCommentsView');
  const bansView=make('section','moderationBansView');
  const appealsView=make('section','moderationAppealsView');
  workspace.append(tabs,commentsView,bansView,appealsView);
  const log={rpc:[],lookup:[],confirm:[]};
  const db={
    auth:{getUser:async()=>({data:{user:{id:accountId}},error:null}),onAuthStateChange:()=>{}},
    rpc:async(name,args)=>{
      log.rpc.push({name,args});
      if(name==='is_moderator')return {data:staff,error:null};
      if(name==='moderation_active_bans_with_history'||name==='moderation_active_ban_categories')return {data:[],error:null};
      if(name==='ban_member_categorized')return {data:'ban-id',error:null};
      return {data:null,error:{message:'unknown RPC'}};
    },
    from:name=>({
      select:columns=>({
        eq:(key,value)=>({maybeSingle:async()=>{
          log.lookup.push({name,columns,key,value});
          return {data:{id:accountId,username:'reader1',display_name:'Reader'},error:null};
        }})
      })
    })
  };
  const document={
    documentElement:{lang:'pt-BR'},
    querySelector:selector=>selector==='.moderation-tabs'?tabs:null,
    getElementById:id=>workspace.find(id),
    createElement:tag=>new Element(tag)
  };
  class MutationObserver {observe(){}}
  vm.runInNewContext(read('moderation-fanarts.js'),{
    document,window:{supabase:{createClient:()=>db},confirm:text=>{log.confirm.push(text);return true;}},
    MutationObserver,setTimeout:()=>{},Date,Intl,Set,Promise
  });
  return {workspace,tabs,commentsTab,bansTab,appealsTab,document,log};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('fanarts tab is hidden until moderator identity is verified',async()=>{
  const {document}=setup({staff:false});
  await tick();
  assert.equal(document.getElementById('moderationFanartsTab').hidden,true);
  assert.equal(document.getElementById('moderationFanartsView').hidden,true);
  const form=document.getElementById('moderationFanartsView').children[2];
  await form.fire('submit');
});

test('moderator can select Fanarts and return to other moderation tabs',async()=>{
  const {document,bansTab}=setup();
  await tick();
  const tab=document.getElementById('moderationFanartsTab');
  const view=document.getElementById('moderationFanartsView');
  assert.equal(tab.hidden,false);
  await tab.fire('click');
  assert.equal(view.hidden,false);
  assert.equal(document.getElementById('moderationCommentsView').hidden,true);
  assert.equal(document.getElementById('moderationBansView').hidden,true);
  assert.equal(tab.attributes['aria-pressed'],'true');
  await bansTab.fire('click');
  assert.equal(view.hidden,true);
  assert.equal(tab.attributes['aria-pressed'],'false');
});

test('a confirmed account is banned using the fanart category through the existing RPC',async()=>{
  const {document,log}=setup();
  await tick();
  const tab=document.getElementById('moderationFanartsTab');
  await tab.fire('click');
  const view=document.getElementById('moderationFanartsView');
  const form=view.children[2];
  const input=document.getElementById('moderationFanartAccount');
  input.value='@reader1';
  await form.fire('submit');
  const banForm=view.children[4];
  assert.equal(banForm.hidden,false);
  assert.deepEqual(log.lookup[0],{name:'profiles',columns:'id,username,display_name',key:'username',value:'reader1'});
  const reason=document.getElementById('moderationFanartReason');
  const duration=document.getElementById('moderationFanartDuration');
  reason.value='Art copied without permission';duration.value='7';
  await banForm.fire('submit');
  const result=log.rpc.find(call=>call.name==='ban_member_categorized');
  assert.ok(result);
  assert.equal(result.args.p_category,'fanart_violation');
  assert.equal(result.args.p_user_id,accountId);
  assert.equal(result.args.p_reason,'Art copied without permission');
  assert.ok(result.args.p_expires_at);
  assert.equal(log.confirm.length,1);
});

test('category exists in both interfaces and SQL protects the server-side ban path',()=>{
  const migration=read('supabase/migrations/20260921_fanarts_ban_category.sql');
  const moderator=read('moderation-ban-appeals.js');
  const selfService=read('ban-self-service.js');
  const page=read('moderacao.html');
  const css=read('moderation-fanarts.css');
  assert.match(migration,/fanart_violation/);
  assert.match(migration,/community_private\.is_moderator\(\)/);
  assert.match(migration,/community_private\.ban_member\(p_user_id,p_reason,p_expires_at\)/);
  assert.match(migration,/ban_category_changes/);
  assert.match(migration,/FROM PUBLIC,anon/);
  assert.match(moderator,/fanart_violation.*Violação das regras de fanarts/);
  assert.match(selfService,/fanart_violation.*Violação das regras de fanarts/);
  assert.match(page,/src="moderation-fanarts\.js"/);
  assert.match(css,/#moderationFanartsTab\[hidden\].*display:none!important/);
});
