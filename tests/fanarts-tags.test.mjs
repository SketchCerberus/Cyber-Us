import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../fanarts-gallery.js',import.meta.url),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const artwork=(i,tags=[])=>{
  const id=String(i).padStart(8,'0')+'-1111-4111-8111-111111111111';
  return {submission_id:id,title:'Obra '+i,artist_name:i===1?'João Silva':'Ana',image_path:id+'.webp',accent:'blue',tags};
};
async function setup(rows, failure=false) {
  const elements=[],observers=[],ranges=[];
  class Element {
    constructor(tag){this.tag=tag;this.dataset={};this.children=[];this.events={};this.attributes={};this.value='';this.hidden=false;this.textContent='';this.className='';
      const classes=new Set();this.classList={add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)};elements.push(this);}
    append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
    appendChild(node){this.append(node);} replaceChildren(...nodes){this.children=[];this.append(...nodes);}
    before(...nodes){const list=this.parent.children;const pos=list.indexOf(this);for(const node of nodes)node.parent=this.parent;list.splice(pos,0,...nodes);}
    remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
    setAttribute(k,v){this.attributes[k]=String(v);} addEventListener(k,fn){this.events[k]=fn;}
    get firstChild(){return this.children[0];}
    querySelectorAll(selector){const matches=node=>selector==='[data-tag]'?node.dataset.tag!==undefined:selector.startsWith('.')?node.className.split(' ').includes(selector.slice(1)):false;
      return this.children.flatMap(node=>[...(matches(node)?[node]:[]),...node.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  }
  const gallery=new Element('section'),empty=new Element('div'),title=new Element('h1'),intro=new Element('p');
  gallery.append(empty);empty.className='fanarts-empty';
  const query=gallery.querySelector.bind(gallery);
  gallery.querySelector=s=>s==='.fanarts-empty'?empty:s==='#gallery-title'?title:s==='.fanarts-section-heading > p'?intro:query(s);
  let fail=failure;
  const db={from(){return {select(){return this;},order(){return this;},async range(a,b){ranges.push([a,b]);return fail?{error:{message:'offline'}}:{data:rows.slice(a,b+1)};}};},storage:{from(){return {getPublicUrl:path=>({data:{publicUrl:'https://example.test/'+path}})};}}};
  const document={documentElement:{lang:'pt-BR'},querySelector:s=>s==='.fanarts-gallery'?gallery:null,querySelectorAll:()=>[],createElement:t=>new Element(t),createTextNode:text=>{const node=new Element('#text');node.textContent=text;return node;}};
  vm.runInNewContext(source,{document,window:{supabase:{createClient:()=>db}},MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}}});
  await settle();
  return {elements,gallery,empty,document,ranges,observers,online(){fail=false;},cards:()=>gallery.querySelectorAll('.fanarts-gallery-work'),input:()=>elements.find(e=>e.type==='search'),filter:tag=>elements.find(e=>e.tag==='button'&&e.dataset.tag===tag),more:()=>elements.find(e=>e.className==='fanarts-view-work')};
}
test('gallery searches accented artist names and canonical Oeté while retaining the stored tag key',async()=>{
  const ui=await setup([artwork(1,['Óete','Grupo']),artwork(2,['Fofo'])]);
  assert.equal(ui.filter('Óete').textContent,'Oeté');
  const input=ui.input();input.value='joao';input.events.input();assert.equal(ui.cards()[0].hidden,false);assert.equal(ui.cards()[1].hidden,true);
  input.value='oete';input.events.input();assert.equal(ui.cards()[0].hidden,false);
  ui.document.documentElement.lang='en';ui.observers[0]();assert.equal(ui.filter('Grupo').textContent,'Group');assert.equal(ui.filter('Fofo').textContent,'Cute');
});
test('combined filters persist when loading more than 100 approved works',async()=>{
  const rows=Array.from({length:101},(_,i)=>artwork(i+1,i===0||i===100?['Óete','Grupo']:['Fofo']));
  const ui=await setup(rows);ui.filter('Óete').events.click();ui.filter('Grupo').events.click();
  assert.equal(ui.cards().filter(e=>!e.hidden).length,1);assert.equal(ui.more().hidden,false);
  ui.more().events.click();await settle();assert.equal(ui.cards().length,101);assert.equal(ui.cards().filter(e=>!e.hidden).length,2);
  assert.equal(ui.filter('Óete').attributes['aria-pressed'],'true');assert.equal(ui.more().hidden,true);
  assert.deepEqual(ui.ranges,[[0,99],[100,199]]);
});
test('empty galleries disable search; transient failures can be retried',async()=>{
  const empty=await setup([]);assert.equal(empty.input().disabled,true);assert.equal(empty.empty.hidden,false);
  const ui=await setup([artwork(1)],true);assert.equal(ui.more().hidden,false);ui.online();ui.more().events.click();await settle();assert.equal(ui.cards().length,1);assert.equal(ui.more().hidden,true);
});
