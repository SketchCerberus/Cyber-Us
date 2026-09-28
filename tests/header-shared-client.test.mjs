import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const accountSource=readFileSync(new URL('../header-account.js',import.meta.url),'utf8');
const notificationSource=readFileSync(new URL('../header-notifications.js',import.meta.url),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(loaded) {
  class Element {
    constructor(){this.dataset={};this.events={};this.children=[];this.hidden=false;this.classList={add(){},remove(){}};}
    setAttribute(){} getAttribute(){return null;} removeAttribute(){}
    append(...nodes){this.children.push(...nodes);} appendChild(node){this.append(node);}
    after(){} replaceChildren(){} addEventListener(name,fn){this.events[name]=fn;}
  }
  const link=new Element(), head=new Element(); let sdkTag=null, creations=0, checks=0;
  const db={auth:{async getUser(){checks++;return {data:{user:null}};},onAuthStateChange(){}}};
  const sdk={createClient(){creations++;return db;}};
  const window={addEventListener(){}}; if(loaded)window.supabase=sdk;
  const document={documentElement:{lang:'pt-BR'},baseURI:'https://example.test/extras.html',head,
    querySelector(s){return s.includes('.account-access')?link:s.includes('@supabase')?sdkTag:null;},
    getElementById(){return null;},createElement(){return new Element();},addEventListener(){}};
  head.appendChild=node=>{head.append(node);if(node.src?.includes('@supabase'))sdkTag=node;};
  const context={window,document,URL,MutationObserver:class{observe(){}},setTimeout,clearTimeout};
  vm.runInNewContext(accountSource,context);vm.runInNewContext(notificationSource,context);
  return {window,db,get creations(){return creations;},get checks(){return checks;},
    load(){window.supabase=sdk;sdkTag.events.load();},fail(){sdkTag.events.error();}};
}
for(const loaded of [true,false])test('Header shares one client with SDK '+(loaded?'ready':'loading'),async()=>{
  const s=setup(loaded);if(!loaded){assert.equal(s.creations,0);s.load();}
  await settle();assert.equal(s.creations,1);assert.equal(s.checks,2);
  assert.equal(await s.window.CyberUsHeaderClient,s.db);
});
test('SDK failure resolves safely without creating a notification client',async()=>{
  const s=setup(false);s.fail();await settle();
  assert.equal(await s.window.CyberUsHeaderClient,null);assert.equal(s.creations,0);
});
