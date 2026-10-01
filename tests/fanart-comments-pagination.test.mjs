import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../fanarts-detail.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('  async function loadComments('),source.indexOf('  async function vote('));
function setup() {
  const ranges=[],results=[];
  const element=()=>({dataset:{},children:[],append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];}});
  const comments=element(),moreComments={},form={},votes={};
  const db={from(){return {select(){return this;},eq(key,id){this.id=id;return this;},order(){return this;},async range(a,b){ranges.push([this.id,a,b]);return results.shift()||{data:[]};}};}};
  const context=vm.createContext({db,comments,moreComments,form,votes,document:{createElement:element},Intl,Date,
    pt:()=>true,t:(pt)=>pt,setStatus:()=>{},loadVotes:async()=>{},interactionStatus:{classList:{contains:()=>false}},
    selected:{dataset:{submissionId:'first'}},request:0,commentOffset:0});
  vm.runInContext(functions,context);
  return {context,ranges,results,comments,moreComments};
}
const rows=(start,count)=>Array.from({length:count},(_,i)=>({id:start+i,display_name:'Artista',body:'Comentário',created_at:'2026-09-30T12:00:00Z'}));
test('comment pagination appends older comments, deduplicates and hides exhausted control',async()=>{
  const s=setup();s.results.push({data:rows(1,30)},{data:rows(30,2)});
  await s.context.loadInteractions();assert.equal(s.comments.children.length,30);assert.equal(s.moreComments.hidden,false);
  await s.context.loadComments('first',s.context.request,true);
  assert.equal(s.comments.children.length,31);assert.equal(s.moreComments.hidden,true);
  assert.deepEqual(s.ranges,[['first',0,29],['first',30,59]]);
});
test('switching artwork resets pagination and retry starts at zero after failure',async()=>{
  const s=setup();s.results.push({data:rows(1,30)},{error:{message:'offline'}},{data:rows(90,1)});
  await s.context.loadInteractions();s.context.selected={dataset:{submissionId:'second'}};
  await s.context.loadInteractions();assert.equal(s.comments.children.length,0);assert.equal(s.moreComments.disabled,false);
  await s.context.loadComments('second',s.context.request,true);
  assert.deepEqual(s.ranges,[['first',0,29],['second',0,29],['second',0,29]]);
  assert.equal(s.comments.children[0].dataset.commentId,'90');
});
