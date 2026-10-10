import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../comment-editor.js',import.meta.url),'utf8');
function setup({eligible=true,error=null,kind='episode',body='original'}={}){
 const nodes=[],calls=[];let saved=0;
 const make=tag=>{const e={tag,dataset:{},children:[],events:{},value:'',append(...n){this.children.push(...n);},setAttribute(){},addEventListener(k,f){this.events[k]=f;},focus(){this.focused=true;}};nodes.push(e);return e;};
 const context={window:{},document:{documentElement:{lang:'en'},createElement:make},MutationObserver:class{observe(){}}};vm.runInNewContext(source,context);
 const comment={id:'17',body,updated_at:'version-1'};const container=make('div');
 context.window.CyberUsCommentEditor.mount({container,comment,kind,eligible:()=>eligible,db:{rpc:async(name,args)=>{calls.push({name,args});return error?{error}:{data:'version-2'};}},onSaved:async()=>{saved++;}});
 return {nodes,calls,get saved(){return saved;},find:text=>nodes.find(e=>e.textContent===text),async fire(e,type='click'){await e.events[type]({preventDefault(){}});}};
}
test('only eligible authors receive edit controls',()=>{const s=setup({eligible:false});assert.equal(s.find('Edit my comment'),undefined);});
test('editing preserves spoiler marker, version and public id; blank edits never submit',async()=>{const s=setup({body:'[CYBER-US-SPOILER]\nsecret'});await s.fire(s.find('Edit my comment'));const input=s.nodes.find(e=>e.tag==='textarea'),form=s.nodes.find(e=>e.tag==='form');assert.equal(input.value,'secret');input.value=' ';await s.fire(form,'submit');assert.equal(s.calls.length,0);input.value='updated';await s.fire(form,'submit');assert.deepEqual(JSON.parse(JSON.stringify(s.calls[0])),{name:'edit_own_comment',args:{p_kind:'episode',p_id:'17',p_body:'[CYBER-US-SPOILER]\nupdated',p_expected:'version-1'}});assert.equal(s.saved,1);});
test('conflict and network failure retain draft, unlock controls and do not reload',async()=>{for(const error of [{code:'40001'},{code:'offline'}]){const s=setup({error,kind:'fanart'});await s.fire(s.find('Edit my comment'));const input=s.nodes.find(e=>e.tag==='textarea');input.value='draft';await s.fire(s.nodes.find(e=>e.tag==='form'),'submit');assert.equal(input.value,'draft');assert.equal(s.saved,0);assert.equal(s.find('Save').disabled,false);assert.ok(s.nodes.find(e=>e.tag==='p').textContent);}});
test('cancel preserves published text and performs no write',async()=>{const s=setup();await s.fire(s.find('Edit my comment'));await s.fire(s.find('Cancel'));assert.equal(s.calls.length,0);assert.equal(s.nodes.find(e=>e.tag==='form').hidden,true);});
