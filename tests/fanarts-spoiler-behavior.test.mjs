import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../fanarts-spoilers.js',import.meta.url),'utf8');

test('spoiler cards start covered, reveal on click and do not cause an observer mutation loop',()=>{
  const observers=[];
  let textWrites=0,reveal=null,focused=false;
  const classes=new Set();
  const image={alt:'Fanart de teste',dataset:{}};
  const caption={querySelector(selector){
    return selector==='.fanarts-view-work'?{focus(){focused=true;}}:null;
  }};
  const card={dataset:{spoiler:'true'},
    classList:{add(name){classes.add(name);},remove(name){classes.delete(name);},contains(name){return classes.has(name);}},
    querySelector(selector){
      if(selector==='img')return image;
      if(selector==='figcaption')return caption;
      if(selector==='.fanarts-spoiler-reveal')return reveal;
      return null;
    },
    insertBefore(element){reveal=element;}
  };
  const gallery={querySelectorAll(selector){return selector==='.fanarts-gallery-work'?[card]:[];}};
  const html={lang:'pt-BR'};
  const document={documentElement:html,
    querySelector(selector){if(selector==='.fanarts-gallery')return gallery;return null;},
    createElement(tag){
      assert.equal(tag,'button');
      const handlers={};let value='';
      return {dataset:{},className:'',type:'',
        get textContent(){return value;},
        set textContent(next){value=next;textWrites++;},
        addEventListener(type,fn){handlers[type]=fn;},
        click(){handlers.click?.({stopPropagation(){}});},
        remove(){reveal=null;}
      };
    }
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;observers.push(this);}
    observe(target,options){this.target=target;this.options=options;}
  }
  vm.runInNewContext(source,{document,MutationObserver},{timeout:1000});
  assert.ok(classes.has('fanarts-spoiler-locked'));
  assert.equal(image.alt,'Fanart com spoiler oculto');
  assert.equal(reveal.textContent,'Spoiler · Revelar imagem');
  const galleryObserver=observers.find(observer=>observer.target===gallery);
  assert.ok(galleryObserver);
  const writesAfterSetup=textWrites;
  for(let i=0;i<5;i++)galleryObserver.callback();
  assert.equal(textWrites,writesAfterSetup,'repeated observer calls must not change DOM text');
  reveal.click();
  assert.ok(!classes.has('fanarts-spoiler-locked'));
  assert.ok(classes.has('fanarts-spoiler-revealed'));
  assert.equal(image.alt,'Fanart de teste');
  assert.equal(reveal,null);
  assert.equal(focused,true);
  galleryObserver.callback();
  assert.ok(!classes.has('fanarts-spoiler-locked'),'revealed artwork must remain visible');
});
