import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../comment-spoilers.js',import.meta.url),'utf8');
const PREFIX='[CYBER-US-SPOILER]\n';

function fixture() {
  const listeners=new Map(),observers=[],forms=[],bodies=[];
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
  vm.runInNewContext(source,{document,MutationObserver,URL,WeakMap,queueMicrotask},{timeout:1000});
  function submit(form) {
    const event={target:form,prevented:false,stopped:false,
      preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    // Browser event flow: ancestor capture always precedes existing target listeners.
    for(const listener of panel.handlers.submit||[])listener.handler(event);
    if(!event.stopped)for(const listener of form.handlers.submit||[])listener.handler(event);
    return event;
  }
  return {main,makeForm,submit,observers,bodies,document};
}

test('late spoiler script encodes before an older submit listener and restores the editor',async()=>{
  // Registering a legacy handler first is the exact ordering that broke the checkbox.
  const {main,submit}=fixture();
  let posted='';
  main.addEventListener('submit',()=>{posted=main.textarea.value;});
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

test('dynamically inserted replies use the same early capture and respect the length limit',async()=>{
  const {makeForm,submit,observers}=fixture();
  const reply=makeForm();
  let posted=null;
  reply.addEventListener('submit',()=>{posted=reply.textarea.value;});
  observers[0].callback(); // Simulates community.js adding a reply form later.
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
  assert.equal(posted,null,'invalid spoiler must never reach the old submit handler');
  assert.equal(reply.help.hidden,false);
  assert.equal(reply.textarea.value.length,2000);
});

test('a spoiler comment remains hidden until reveal, and can be hidden again',()=>{
  const {bodies,observers,document}=fixture();
  const body=document.createElement('p');body.textContent=PREFIX+'Secret information';
  bodies.push(body);observers[0].callback();
  const [button,content]=body.children;
  assert.equal(body.textContent,PREFIX+'Secret information'); // Raw user text never becomes markup.
  assert.equal(content.textContent,'Secret information');
  assert.equal(content.hidden,true);
  assert.equal(button.textContent,'Comentário com spoiler — revelar');
  button.click();
  assert.equal(content.hidden,false);
  assert.equal(button.textContent,'Ocultar comentário com spoiler');
  button.click();
  assert.equal(content.hidden,true);
});
