import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../fanarts-showcase.js',import.meta.url),'utf8');
function setup(){
  const elements=[];let observer;
  const make=tag=>{const e={tag,children:[],events:{},attributes:{},value:'',append(...nodes){this.children.push(...nodes);},appendChild(n){this.children.push(n);},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,f){this.events[k]=f;},focus(){}};elements.push(e);return e;};
  const document={documentElement:{lang:'pt-BR'},createElement:make};
  const ctx={document,MutationObserver:class{constructor(fn){observer=fn;}observe(){}}};
  vm.runInNewContext(source.slice(source.indexOf('  function tagKey'),source.indexOf('  const approvedFanarts')),ctx);
  return {ctx,elements,make,document,language(){observer();}};
}
test('Tags normalize accents and duplicates, bound length/count and reject malformed data',()=>{const {ctx}=setup();assert.deepEqual(Array.from(ctx.cleanTags([' #Ação ','ação','NEON',null,'x'.repeat(33)])),['Ação','NEON']);assert.equal(ctx.cleanTags('neon').length,0);assert.equal(ctx.cleanTags(Array.from({length:12},(_,i)=>'tag'+i)).length,8);});
test('Search combines artist words and hashtags with all selected tags; untagged works remain searchable',()=>{const {ctx}=setup(),work={artist:'João Silva',tags:['Ação','Neon']};assert.equal(ctx.matchesFanart(work,'joao #acao',new Set(['neon'])),true);assert.equal(ctx.matchesFanart(work,'',new Set(['neon','aquarela'])),false);assert.equal(ctx.matchesFanart({artist:'Ana',tags:[]},'ana',new Set()),true);});
test('Filter controls hide and restore cards, translate, clear and handle empty galleries',()=>{const s=setup(),works=[{artist:'Ana',tags:['Neon']},{artist:'João',tags:['Aquarela']}];const api=s.ctx.installTagSearch(s.make('section'),works);const a=s.make('figure'),b=s.make('figure');api.add(works[0],a,s.make('figcaption'));api.add(works[1],b,s.make('figcaption'));const tag=s.elements.find(e=>e.textContent==='#Neon');tag.events.click();assert.equal(a.hidden,false);assert.equal(b.hidden,true);assert.equal(tag.attributes['aria-pressed'],'true');const input=s.elements.find(e=>e.type==='search');input.value='missing';input.events.input();assert.equal(a.hidden,true);const clear=s.elements.find(e=>e.textContent==='Limpar filtros');clear.events.click();assert.equal(a.hidden,false);assert.equal(b.hidden,false);s.document.documentElement.lang='en';s.language();assert.equal(clear.textContent,'Clear filters');api.remove(a);assert.equal(s.elements.find(e=>e.className==='fanarts-search-status').textContent,'1 of 1 works');const empty=setup();empty.ctx.installTagSearch(empty.make('section'),[]);assert.equal(empty.elements.find(e=>e.type==='search').disabled,true);});
