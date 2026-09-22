import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../fanarts-showcase.js', import.meta.url), 'utf8');
const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const third = '33333333-3333-4333-8333-333333333333';
const works = [
  {submission_id:first,title:'Segredo',artist_name:'A',image_path:first+'.webp',accent:'blue',tags:['Spoiler']},
  {submission_id:second,title:'Arte pública',artist_name:'B',image_path:second+'.webp',accent:'red',tags:[]},
  {submission_id:third,title:'Terceira arte',artist_name:'C',image_path:third+'.webp',accent:'green',tags:[]}
];

async function setup(data=works, reduced=false) {
  const observers=[],scheduled=new Map(),queryLog=[];
  let nextTimer=0;
  class Element {
    constructor(tag){
      this.tag=tag;this.dataset={};this.hidden=false;this.children=[];this.className='';
      this.textContent='';this.alt='';this.events={};this.attributes=new Map();
      const classes=new Set();
      this.classList={add:key=>classes.add(key),remove:key=>classes.delete(key),contains:key=>classes.has(key)};
    }
    append(...nodes){this.children.push(...nodes);}
    appendChild(node){this.append(node);}
    after(...nodes){this.afterNodes=nodes;}
    setAttribute(key,value){this.attributes.set(key,String(value));}
    getAttribute(key){return this.attributes.get(key)??null;}
    removeAttribute(key){this.attributes.delete(key);}
    set src(url){this.attributes.set('src',url);}
    get src(){return this.getAttribute('src');}
    addEventListener(name,listener){this.events[name]=listener;}
    click(){this.events.click?.({});}
    focus(){this.focused=true;}
    contains(node){return this===node||this.children.includes(node);}
    querySelector(selector){return this.children.find(node=>'.'+node.className===selector)||null;}
  }
  const signal=new Element('div');
  signal.setAttribute('aria-hidden','true');
  const orbit=new Element('div'),bottom=new Element('div');
  signal.querySelector=selector=>selector==='.fanarts-signal-orbit'?orbit:selector==='.fanarts-signal-bottom'?bottom:null;
  const doc={documentElement:{lang:'pt-BR'},baseURI:'https://example.test/Cyber-Us/fanarts.html',
    currentScript:{src:'https://example.test/Cyber-Us/fanarts-showcase.js'},hidden:false,
    head:{append(){}},querySelector:selector=>selector==='.fanarts-signal'?signal:null,
    createElement:tag=>new Element(tag),addEventListener(){}};
  class MutationObserver{
    constructor(callback){this.callback=callback;observers.push(this);}
    observe(){}
  }
  const db={
    from(table){
      queryLog.push(table);
      return {select(columns){queryLog.push(columns);return this;},order(){return this;},
        limit(){return Promise.resolve({data,error:null});}};
    },
    storage:{from(bucket){assert.equal(bucket,'fanart-public');return {
      getPublicUrl:path=>({data:{publicUrl:'https://cdn.example.test/'+path}})
    };}}
  };
  const win={supabase:{createClient:()=>db},matchMedia:()=>({matches:reduced,addEventListener(){}}),
    setTimeout(callback){const id=++nextTimer;scheduled.set(id,callback);return id;},
    clearTimeout(id){scheduled.delete(id);}};
  const stableMath=Object.create(Math);
  stableMath.random=()=>0.9999; // Shuffle keeps fixture order.
  vm.runInNewContext(source,{document:doc,window:win,MutationObserver,URL,Math:stableMath,Set},{timeout:1000});
  await new Promise(resolve=>setImmediate(resolve));
  const [stage,controls]=orbit.afterNodes||[];
  return {signal,orbit,bottom,stage,controls,observers,scheduled,queryLog,doc};
}

test('the carousel uses approved public rows, starts covered and navigates both ways',async()=>{
  const ui=await setup();
  const {signal,orbit,bottom,stage,controls,queryLog}=ui;
  assert.deepEqual(queryLog.map(String),['fanart_gallery','submission_id,title,artist_name,image_path,accent,tags']);
  assert.equal(signal.getAttribute('aria-hidden'),null);
  assert.equal(orbit.hidden,true);
  assert.equal(bottom.hidden,true);
  assert.equal(stage.children.length,3);
  const current=stage.children[1]; // The actual center card, between previous and next.
  const [image,reveal,caption]=current.children;
  const [title]=caption.children;
  const [prev,progress,next,pause]=controls.children;
  assert.equal(image.hidden,true);
  assert.equal(image.getAttribute('src'),null,'spoiler must not even load the image before reveal');
  assert.equal(title.textContent,'');
  assert.equal(caption.hidden,true);
  assert.equal(reveal.hidden,false);
  assert.equal(reveal.textContent,'Spoiler · Revelar imagem');
  assert.equal(progress.textContent,'1 / 3');
  reveal.click();
  assert.equal(image.hidden,false);
  assert.equal(image.src,'https://cdn.example.test/'+first+'.webp');
  assert.equal(title.textContent,'Segredo');
  assert.equal(caption.hidden,false);
  next.click();
  assert.equal(title.textContent,'Arte pública');
  assert.equal(progress.textContent,'2 / 3');
  prev.click();
  assert.equal(title.textContent,'Segredo');
  pause.click();
  assert.equal(pause.getAttribute('aria-pressed'),'true');
  assert.equal(ui.scheduled.size,0);
  next.click(); // Manual navigation must work even while paused.
  assert.equal(title.textContent,'Arte pública');
});

test('language switching and reduced motion preserve manual controls and spoiler masking',async()=>{
  const ui=await setup(works,true);
  assert.equal(ui.orbit.afterNodes.length,2); // Exactly one carousel stage and one control row.
  const [stage,controls]=ui.orbit.afterNodes;
  assert.equal(ui.scheduled.size,0,'reduced-motion users should not get autoplay');
  const current=stage.children[1];
  ui.doc.documentElement.lang='en';
  ui.observers[0].callback();
  assert.equal(current.children[1].textContent,'Spoiler · Reveal artwork');
  assert.equal(controls.children[2].textContent,'Next →');
  controls.children[2].click();
  assert.equal(current.children[2].children[0].textContent,'Arte pública');
  assert.equal(ui.scheduled.size,0);
  assert.match(readFileSync(new URL('../fanarts-carousel.css', import.meta.url),'utf8'),/img\[hidden\].*|figcaption\[hidden\]/);
});

test('empty public gallery retains the placeholder instead of a broken carousel',async()=>{
  const {signal,orbit,bottom,stage,controls}=await setup([]);
  assert.equal(stage,undefined);
  assert.equal(controls,undefined);
  assert.equal(orbit.hidden,false);
  assert.equal(bottom.hidden,false);
  assert.equal(signal.getAttribute('aria-hidden'),'true');
});
