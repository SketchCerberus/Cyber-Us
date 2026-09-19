import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../community-avatar.js',import.meta.url),'utf8');
const user='11111111-1111-4111-8111-111111111111',version='22222222-2222-4222-8222-222222222222';
function setup(){
 const elements=[];
 const make=tag=>{const el={tag,children:[],attributes:{},events:{},value:'',files:[],classList:{toggle(){}},setAttribute(k,v){this.attributes[k]=v;},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},insertBefore(el){this.children.push(el);},remove(){},querySelectorAll(){return elements.filter(x=>['input','button'].includes(x.tag));},addEventListener(e,fn){this.events[e]=fn;},getContext(){return{fillRect(){},drawImage(){}};},toBlob(fn){fn({size:12000,type:'image/jpeg'});}};elements.push(el);return el;};
 const host=make('section');host.id='memberAccount';const profile=make('form');profile.id='profileForm';
 const state={user:{id:user},banned:false},calls=[];let rejectUpload=false,rejectUpdate=false;
 const bucket={async upload(path,blob,options){calls.push({op:'upload',path,blob,options});return{error:rejectUpload?new Error('upload failed'):null};},async remove(paths){calls.push({op:'remove',paths});return{error:null};}};
 const db={storage:{from(name){assert.equal(name,'community-avatars');return bucket;}},from(table){assert.equal(table,'profiles');return{update(values){return{eq(key,id){assert.equal(id,user);return{select(){return{async single(){calls.push({op:'update',values});return{data:values,error:rejectUpdate?new Error('update failed'):null};}};}};}};}};}};
 const context={window:{},document:{createElement:make,getElementById:id=>elements.find(e=>e.id===id)||null},URL:{createObjectURL:()=> 'blob:preview',revokeObjectURL(){}},crypto:{randomUUID:()=>version},createImageBitmap:async()=>({width:1000,height:600,close(){}})};
 vm.runInNewContext(source,context);
 const api=context.window.CyberUsAvatars,editor=api.create({db,projectUrl:'https://example.supabase.co',state,t:a=>a});
 const click=async el=>{el.events.click();await settle();};
 const submit=async()=>{elements.find(e=>e.className==='avatar-editor').events.submit({preventDefault(){}});await settle();};
 return{api,editor,state,calls,elements,click,submit,failUpload(){rejectUpload=true;},failUpdate(){rejectUpdate=true;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('Avatar URLs accept only owned fixed paths and reject arbitrary URLs',()=>{
 const {api}=setup();
 assert.equal(api.photoURL('https://example.supabase.co',{id:user,avatar:'upload:'+version}),`https://example.supabase.co/storage/v1/object/public/community-avatars/${user}/avatar.jpg?v=${version}`);
 for(const avatar of ['https://tracker.test/photo','javascript:alert(1)','upload:../../other','robot',null])assert.equal(api.photoURL('https://example.supabase.co',{id:user,avatar}),null);
});
test('Preset selection saves only the own avatar field and removes obsolete uploads',async()=>{
 const s=setup();await s.click(s.elements.find(e=>e.attributes['aria-label']==='fox'));await s.submit();
 assert.equal(s.calls[0].op,'update');assert.equal(s.calls[0].values.avatar,'fox');assert.equal(Object.keys(s.calls[0].values).length,1);
 assert.equal(s.calls[1].op,'remove');assert.equal(s.calls[1].paths[0],user+'/avatar.jpg');
});
test('Photos are converted to small JPEGs before upload, then saved to profile',async()=>{
 const s=setup();s.elements.find(e=>e.id==='avatarFile').files=[{type:'image/png',size:1000}];await s.submit();
 assert.equal(s.calls[0].op,'upload');assert.equal(s.calls[0].path,user+'/avatar.jpg');assert.equal(s.calls[0].blob.type,'image/jpeg');assert.equal(s.calls[0].options.upsert,true);
 assert.equal(s.calls[1].values.avatar,'upload:'+version);
});
test('Invalid/oversized photos and banned accounts never write',async()=>{
 for(const file of [{type:'image/svg+xml',size:20},{type:'image/jpeg',size:6000000}]){const s=setup();s.elements.find(e=>e.id==='avatarFile').files=[file];await s.submit();assert.equal(s.calls.length,0);}
 const s=setup();s.state.banned=true;await s.submit();assert.equal(s.calls.length,0);
});
test('Failed upload never updates the profile; failed profile update never deletes the photo',async()=>{
 const s=setup();s.failUpload();s.elements.find(e=>e.id==='avatarFile').files=[{type:'image/jpeg',size:1000}];await s.submit();assert.equal(s.calls.length,1);assert.equal(s.calls[0].op,'upload');
 const other=setup();other.failUpdate();await other.submit();assert.equal(other.calls.length,1);assert.equal(other.calls[0].op,'update');
});
test('Remove clears the avatar then deletes only the own fixed object',async()=>{
 const s=setup();s.editor.render({avatar:'upload:'+version});await s.click(s.elements.find(e=>e.textContent==='Remover imagem'));
 assert.equal(s.calls[0].values.avatar,null);assert.equal(s.calls[1].paths[0],user+'/avatar.jpg');
});
