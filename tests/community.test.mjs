import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../community.js', import.meta.url), 'utf8');
const captcha = readFileSync(new URL('../community-captcha.js', import.meta.url), 'utf8');

test('Auth redirects stay on the script origin and base path, ignoring callback query/hash', () => {
  const declaration = source.match(/const ACCOUNT_URL = .*;/)[0];
  for (const [script, expected] of [
    ['http://localhost:4173/Cyber-Us/community.js','http://localhost:4173/Cyber-Us/comunidade.html'],
    ['https://sketchcerberus.github.io/Cyber-Us/community.js','https://sketchcerberus.github.io/Cyber-Us/comunidade.html'],
    ['https://preview.example/community.js?v=1#ignored','https://preview.example/comunidade.html']
  ]) {
    assert.equal(vm.runInNewContext(`${declaration}\nACCOUNT_URL`, { URL, document: { currentScript: { src: script } } }), expected);
  }
  assert.match(source, /emailRedirectTo: ACCOUNT_URL, captchaToken/);
  assert.match(source, /redirectTo: ACCOUNT_URL, captchaToken/);
});

function mount({ key = 'public_site_key_12345', service = true, hidden = false, forms = ['loginForm','signupForm','resetForm'] } = {}) {
  const buttons = forms.map(() => ({disabled:false}));
  const elements = Object.fromEntries(forms.map((id,i) => [id,{querySelectorAll:()=>[buttons[i]]}]));
  for (const id of forms) elements[id+'Captcha'] = {};
  elements.captchaSetupStatus = { hidden:true, dataset:{} };
  elements.guestAccount = { hidden };
  const renders = [], resets = [];
  let observer;
  const window = { matchMedia:()=>({matches:false}) };
  if (service) window.turnstile = {
    ready: () => { throw new Error('ready() rejects a deferred Turnstile script'); }, render: (el,options) => { renders.push(options); return renders.length-1; }, reset: id => resets.push(id)
  };
  vm.runInNewContext(captcha, {
    window, document: { body:{dataset:{communityPage:'account'}}, documentElement:{lang:'pt-BR'}, querySelector:()=>({content:key}), getElementById:id=>elements[id] },
    MutationObserver: class { constructor(fn){observer=fn;} observe(){} disconnect(){} }
  });
  return { window,buttons,elements,renders,resets,reveal(){elements.guestAccount.hidden=false;observer();} };
}

test('CAPTCHA fails closed when key or external script is missing', () => {
  for (const options of [{key:''},{service:false}]) {
    const state = mount(options);
    assert.equal(state.window.CyberUsCaptcha.configured,false);
    assert.ok(state.buttons.every(button=>button.disabled));
    assert.equal(state.window.CyberUsCaptcha.token('loginForm'),null);
    assert.equal(state.elements.captchaSetupStatus.hidden,false);
  }
});

test('CAPTCHA waits for visible forms and isolates, expires and resets tokens', () => {
  const state = mount({hidden:true});
  assert.equal(state.renders.length,0);
  state.reveal();
  assert.equal(state.renders.length,3);
  const gate = state.window.CyberUsCaptcha;
  state.renders[0].callback('login-token');
  assert.equal(gate.token('loginForm'),'login-token');
  assert.equal(gate.token('signupForm'),null);
  state.renders[0]['expired-callback']();
  assert.equal(gate.token('loginForm'),null);
  state.renders[1].callback('signup-token');
  state.renders[1]['error-callback']();
  assert.equal(gate.token('signupForm'),null);
  state.renders[2].callback('reset-token');
  gate.reset('resetForm');
  assert.equal(gate.token('resetForm'),null);
  assert.deepEqual(state.resets,[2]);
});

test('Each auth page contains one form and mounts only its protected challenge', () => {
  for (const [page, form] of [['comunidade.html','loginForm'],['cadastro.html','signupForm'],['recuperar-senha.html','resetForm']]) {
    const html = readFileSync(new URL('../'+page, import.meta.url), 'utf8');
    const authForms = [...html.matchAll(/id="(loginForm|signupForm|resetForm)"/g)].map(match=>match[1]);
    assert.deepEqual(authForms,[form]);
    const state = mount({forms:authForms});
    assert.equal(state.renders.length,1);
    assert.equal(state.renders[0].appearance,'interaction-only');
    assert.equal(state.window.CyberUsCaptcha.token(form),null);
    state.renders[0].callback('test-token');
    assert.equal(state.window.CyberUsCaptcha.token(form),'test-token');
    state.renders[0]['expired-callback']();
    assert.equal(state.window.CyberUsCaptcha.token(form),null);
    assert.match(html,/cyber-us-turnstile-site-key/);
  }
});

test('Reader switches the real episode images without a community service', () => {
  const reader = readFileSync(new URL('../reader.js',import.meta.url),'utf8');
  for (const slug of ['episodio-01','episodio-02','episodio-03','episodio-04','episodio-05','marco-zero']) {
    const html = readFileSync(new URL(`../episodios/${slug}.html`,import.meta.url),'utf8');
    const imageTag = html.match(/<img data-src-pt=[^>]+>/)[0];
    const attributes = Object.fromEntries([...imageTag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
    const image = {getAttribute:key=>attributes[key],setAttribute:(key,value)=>attributes[key]=value};
    let click;
    const button = {addEventListener:(_,fn)=>click=fn,setAttribute(){}};
    const document = {getElementById:()=>button,documentElement:{},querySelectorAll:selector=>selector.startsWith('img[')?[image]:[]};
    vm.runInNewContext(reader,{document,URLSearchParams,window:{location:{search:'?lang=pt'}},localStorage:{getItem:()=>null,setItem(){}}});
    assert.equal(attributes.src,attributes['data-src-pt']);
    click();
    assert.equal(document.documentElement.lang,'en');
    assert.equal(attributes.src,attributes['data-src-en']);
    assert.ok(readFileSync(new URL('../episodios/'+attributes.src,import.meta.url)).length>0);
  }
});
