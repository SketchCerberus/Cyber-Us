import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../comment-spoilers.js',import.meta.url),'utf8');
const PREFIX='[CYBER-US-SPOILER]\n';

function fixture(beforeLoad=()=>{}) {
  const observers=[],forms=[],bodies=[];
  class Element {
    constructor(tag){this.tag=tag;this.dataset={};this.children=[];this.hidden=false;this.textContent='';this.value='';this.maxLength=2000;this.handlers={};this.focused=false;}
    append(...children){this.children.push(...children);}
    addEventListener(type,handler,capture=false){(this.handlers[type]??=[]).push({handler,capture});}
    insertAdjacentElement(_position,element){this.inserted=element;}
    setAttribute(key,value){this[key]=value;}
    replaceChildren(...children){this.children=children;}
    focus(){this.focused=true;}
    click(){for(const listener of this.handlers.click||[])listener.handler();}
  }
  const panel=new Element('section');
  panel.querySelectorAll=selector=>{
    if(selector==='#commentForm, .reply-form')return forms;
    if(selector==='.comment-list .comment-body')return bodies;
    if(selector==='.spoiler-reveal')return bodies.flatMap(body=>body.children.filter(el=>el.className==='spoiler-reveal'));
    return [];
  };
  const document={
    querySelector:()=>panel,
    currentScript:{src:'https://example.test/comment-spoilers.js'},
    documentElement:{lang:'pt-BR'},
    head:{append(){}},
    createElement:tag=>new Element(tag)
  };
  class MutationObserver {constructor(callback){this.callback=callback;observers.push(this);}observe(){} }
  function makeForm() {
    const form=new Element('form'),textarea=new Element('textarea'),submit=new Element('button');
    submit.insertAdjacentElement=(_position,option)=>{
      form.option=option;
      option.insertAdjacentElement=(_after,help)=>{form.help=help;};
    };
    form.querySelector=selector=>selector==='textarea'?textarea:selector==='button[type="submit"]'?submit:null;
    form.textarea=textarea;
    forms.push(form);
    return form;
  }
  const main=makeForm();
  beforeLoad({main,panel,makeForm,bodies,document});
  vm.runInNewContext(source,{document,MutationObserver,URL,WeakMap,queueMicrotask},{timeout:1000});
  function submit(form) {
    const event={target:form,prevented:false,stopped:false,
      preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    // Real browser propagation: ancestor capture precedes target listeners even if added later.
    for(const listener of panel.handlers.submit||[])listener.handler(event);
    if(!event.stopped)for(const listener of form.handlers.submit||[])listener.handler(event);
    return event;
  }
  return {main,makeForm,submit,observers,bodies,document,panel};
}

test('spoiler script loaded AFTER older submit listener still encodes before the post and restores editor',async()=>{
  let posted='';
  const {main,submit}=fixture(({main})=>{
    main.addEventListener('submit',()=>{posted=main.textarea.value;});
  });
  main.textarea.value='  A big reveal!  ';
  main.option.children[0].checked=true;
  const event=submit(main);
  assert.equal(event.prevented,false);
  assert.equal(posted,PREFIX+'A big reveal!');
  await Promise.resolve();
  assert.equal(main.textarea.value,'  A big reveal!  ');
  main.option.children[0].checked=false;
  submit(main);
  assert.equal(posted,'  A big reveal!  ');
});

test('dynamically inserted replies use early capture and respect length limit',async()=>{
  const {makeForm,submit,observers}=fixture();
  const reply=makeForm();
  let posted=null;
  reply.addEventListener('submit',()=>{posted=reply.textarea.value;});
  observers[0].callback(); // Simulates community.js adding a reply form after startup.
  reply.option.children[0].checked=true;
  reply.textarea.value='Reply spoiler';
  submit(reply);
  assert.equal(posted,PREFIX+'Reply spoiler');
  await Promise.resolve();
  assert.equal(reply.textarea.value,'Reply spoiler');
  posted=null;
  reply.textarea.value='x'.repeat(2000);
  const event=submit(reply);
  assert.equal(event.prevented,true);
  assert.equal(event.stopped,true);
  assert.equal(posted,null,'invalid spoiler must never reach existing submit handler');
  assert.equal(reply.help.hidden,false);
  assert.equal(reply.textarea.value.length,2000);
});

test('spoiler stays hidden until reveal, can be hidden again and translates with language',()=>{
  const {bodies,observers,document}=fixture();
  const body=document.createElement('p');body.textContent=PREFIX+'Secret information';
  bodies.push(body);observers[0].callback();
  const [button,content]=body.children;
  assert.equal(content.textContent,'Secret information');
  assert.equal(content.hidden,true);
  assert.equal(button.textContent,'Comentário com spoiler — revelar');
  button.click();
  assert.equal(content.hidden,false);
  assert.equal(button.textContent,'Ocultar comentário com spoiler');
  document.documentElement.lang='en';
  observers[1].callback();
  assert.equal(button.textContent,'Hide spoiler comment');
  button.click();
  assert.equal(content.hidden,true);
  assert.equal(button.textContent,'Spoiler comment — reveal');
});
