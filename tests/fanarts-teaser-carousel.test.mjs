import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../fanarts-teaser-carousel.js',import.meta.url),'utf8');
const uuid=index=>`${String(index).repeat(8)}-${String(index).repeat(4)}-4${String(index).repeat(3)}-8${String(index).repeat(3)}-${String(index).repeat(12)}`;
const artwork=(number,tags=[],featured=true)=>({image_path:`${uuid(number)}.webp`,tags,featured});

async function setup(data,{reduced=false,broken=false,error=null}={}){
  const timers=new Map(),query=[],paths=[],events={};
  let timerId=0;
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.className='';this.style={};this.attributes={};this.events={};this.textContent='';
      const classes=new Set();
      this.classList={add:cls=>classes.add(cls),remove:cls=>classes.delete(cls),contains:cls=>classes.has(cls)};
    }
    append(...nodes){this.children.push(...nodes);}
    insertBefore(element,anchor){const index=this.children.indexOf(anchor);if(index<0)throw Error('missing anchor');this.children.splice(index,0,element);}
    setAttribute(name,value){this.attributes[name]=value;}
    querySelector(selector){if(selector==='strong')return this.children.find(element=>element.tag==='strong');return null;}
  }
  const panel=new Element('div');
  panel.append(new Element('span'),new Element('strong'),new Element('span'));
  const doc={documentElement:{lang:'pt-BR'},hidden:false,baseURI:'https://example.test/Cyber-Us/index.html',
    currentScript:{src:'https://example.test/Cyber-Us/fanarts-teaser-carousel.js'},
    querySelector:selector=>selector==='.fanarts-teaser-art'?panel:null,
    createElement:tag=>new Element(tag),head:{append(element){this.stylesheet=element;}},
    addEventListener(name,callback){events[name]=callback;}};
  const motion={matches:reduced,addEventListener(name,callback){events.motion=callback;}};
  const db={from(table){query.push(['from',table]);return {
    select(value){query.push(['select',value]);return this;},
    eq(column,value){query.push(['eq',column,value]);return this;},
    order(column,value){query.push(['order',column,value]);return this;},
    limit(value){query.push(['limit',value]);return Promise.resolve({data,error});}
  };},storage:{from(bucket){assert.equal(bucket,'fanart-public');return {
    getPublicUrl(path){paths.push(path);return {data:{publicUrl:`https://znenamrszhjsiztllcit.supabase.co/storage/v1/object/public/fanart-public/${path}`}};}
  };}}};
  const window={supabase:{createClient:()=>db},matchMedia:()=>motion,
    setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},
    clearTimeout(id){timers.delete(id);},addEventListener(name,callback){events[name]=callback;}};
  class Image{set src(value){queueMicrotask(()=>{if(broken)this.onerror();else this.onload();});}}
  vm.runInNewContext(source,{document:doc,window,Image,URL,Promise,Set},{timeout:1000});
  await new Promise(resolve=>setImmediate(resolve));
  return {panel,doc,motion,timers,query,paths,events};
}

test('homepage slideshow only uses featured works without spoiler tags, with fixed lettering and no controls',async()=>{
  const works=[artwork(1),artwork(2,['Spoiler']),artwork(3,[],false),artwork(4,[' Humor ']),
    artwork(5,['sPoIlEr']),{image_path:'../invalid.png',tags:[],featured:true}];
  const ui=await setup(works);
  // The mock records options created in a VM, so compare normalized JSON instead of cross-realm prototypes.
  assert.equal(JSON.stringify(ui.query),JSON.stringify([
    ['from','fanart_gallery'],['select','image_path,tags,featured'],['eq','featured',true],
    ['order','featured_at',{ascending:false}],['limit',6]
  ]));
  assert.equal(ui.paths.length,2,'spoiler and non-featured images must not even be requested');
  assert.equal(ui.panel.children.length,4);
  assert.equal(ui.panel.children[0].tag,'span','keep the first label in place for translations');
  assert.equal(ui.panel.children[2].tag,'strong','keep the large headline above the background');
  assert.equal(ui.panel.children[3].tag,'span','keep the final label in place for translations');
  const backdrop=ui.panel.children[1];
  assert.equal(backdrop.attributes['aria-hidden'],'true');
  assert.equal(backdrop.children.length,2);
  assert.ok(ui.panel.classList.contains('has-featured-backdrop'));
  assert.equal(backdrop.children[0].classList.contains('is-active'),true);
  assert.equal(backdrop.children[1].classList.contains('is-active'),false);
  assert.equal(ui.timers.size,1);
  const [timer]=[...ui.timers.values()];
  assert.equal(timer.delay,8000);
  timer.fn();
  assert.equal(backdrop.children[0].classList.contains('is-active'),false);
  assert.equal(backdrop.children[1].classList.contains('is-active'),true);
  assert.equal(ui.timers.size,1);
  assert.equal(ui.panel.children.some(child=>child.tag==='button'),false);
  const css=readFileSync(new URL('../fanarts-teaser-carousel.css',import.meta.url),'utf8');
  assert.match(css,/pointer-events:none/);
  assert.match(css,/z-index:2/);
  assert.match(css,/@media\(max-width:800px\)/);
});

test('one eligible artwork stays static and reduced-motion viewers do not autoplay',async()=>{
  const single=await setup([artwork(1)]);
  assert.equal(single.panel.children[1].children.length,1);
  assert.equal(single.timers.size,0);
  const reduced=await setup([artwork(1),artwork(2)],{reduced:true});
  assert.equal(reduced.panel.children[1].children.length,2);
  assert.equal(reduced.timers.size,0);
  reduced.motion.matches=false;
  reduced.events.motion();
  assert.equal([...reduced.timers.values()][0].delay,8000);
  reduced.doc.hidden=true;
  reduced.events.visibilitychange();
  assert.equal(reduced.timers.size,0);
});

test('unavailable, spoiler-only and failed images leave the original illustrated teaser untouched',async()=>{
  for(const [data,options] of [
    [[],{}],[[artwork(1,['Spoiler'])],{}],[[artwork(1)],{broken:true}],[[artwork(1)],{error:{message:'offline'}}]
  ]){
    const ui=await setup(data,options);
    assert.equal(ui.panel.children.length,3);
    assert.equal(ui.doc.head.stylesheet,undefined);
    assert.equal(ui.timers.size,0);
  }
});

test('homepage loads gallery client on demand and keeps the existing translation selectors',()=>{
  const homepage=readFileSync(new URL('../script.js',import.meta.url),'utf8');
  assert.match(homepage,/document\.querySelector\('\.fanarts-teaser-art'\)/);
  assert.match(homepage,/sdk\.onload = startFeaturedBackdrop/);
  assert.match(homepage,/script\.src = 'fanarts-teaser-carousel\.js'/);
  assert.match(homepage,/querySelector\('span:first-child'\)/);
  assert.match(homepage,/querySelector\('span:last-child'\)/);
});
