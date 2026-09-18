import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../community.js', import.meta.url), 'utf8');
function setup() {
  const elements = new Map();
  const make = () => ({
    value: '', type: 'password', events: {}, attributes: {},
    addEventListener(event, fn) { (this.events[event] ||= []).push(fn); },
    async fire(event) { for (const fn of this.events[event] || []) await fn({preventDefault(){},currentTarget:this}); },
    setAttribute(key, value) { this.attributes[key] = value; },
    setCustomValidity(value) { this.validationMessage = value; },
    reportValidity() { this.reported = true; }, focus() {},
    checkValidity() { return this.value.includes('@'); },
    insertAdjacentElement(_, button) { this.toggle = button; },
    append(...children) { children.forEach(child => { if (child.id) elements.set(child.id, child); }); },
    insertBefore(child) { elements.set(child.id, child); },
    querySelectorAll() { return []; }
  });
  const byId = id => { if (!elements.has(id)) elements.set(id, Object.assign(make(), {id})); return elements.get(id); };
  const calls = [], notices = [];
  let english = false, fail = false;
  const context = {
    byId, node: (_, __, text) => Object.assign(make(), {textContent:text}),
    t: (pt, en) => english ? en : pt,
    notice: (_, text) => notices.push(text), state:{user:{id:'test'}},
    captchaTokenFor: () => 'mock-token', resetCaptcha(){}, busy(){},
    errorText: error => error.message, refreshIdentity(){}, loadModeration(){}, ACCOUNT_URL:'http://localhost:4173/Cyber-Us/comunidade.html',
    db:{auth:{
      async resetPasswordForEmail(email, options) { calls.push(['reset',email,options]); return {error:null}; },
      async signUp(args) { calls.push(['signup',args]); if(fail)throw new Error('Network unavailable'); return {data:{},error:null}; },
      async updateUser(args) { calls.push(['update',args]); if(fail)throw new Error('Network unavailable'); return {error:null}; }
    }}
  };
  vm.runInNewContext(source.slice(source.indexOf('  function installPasswordToggle('),source.indexOf('  async function loadModeration()'))+'\ninstallAccountForms();',context);
  return {byId,calls,notices, setEnglish(){english=true;},fail(){fail=true;}};
}

for (const [form, password, confirmation, operation] of [
  ['signupForm','signupPassword','signupPasswordConfirm','signup'],
  ['passwordForm','newPassword','newPasswordConfirm','update']
]) {
  test(`${operation}: mismatched or short passwords never reach Auth; matching values do`, async () => {
    const s=setup(), first=s.byId(password), second=s.byId(confirmation);
    first.value='Test-password-123'; second.value='Different-password';
    await s.byId(form).fire('submit');
    assert.equal(s.calls.length,0);
    assert.match(second.validationMessage,/não coincidem/);
    second.value=first.value;
    await second.fire('input');
    assert.equal(second.validationMessage,'');
    first.value=second.value='short';
    await s.byId(form).fire('submit');
    assert.equal(s.calls.length,0);
    first.value=second.value='Test-password-123';
    await first.toggle.fire('click');
    await s.byId(form).fire('submit');
    assert.equal(s.calls.length,1);
    assert.equal(s.calls[0][0],operation);
    assert.equal(s.calls[0][1].password,'Test-password-123');
    assert.equal(first.value,''); assert.equal(second.value,'');
    assert.equal(first.type,'password'); assert.equal(second.type,'password');
  });
  test(`${operation}: network failures clear and hide both fields`,async()=>{
    const s=setup(); s.fail();
    for(const id of [password,confirmation]) {s.byId(id).value='Test-password-123';await s.byId(id).toggle.fire('click');}
    await s.byId(form).fire('submit');
    for(const id of [password,confirmation]) {assert.equal(s.byId(id).value,'');assert.equal(s.byId(id).type,'password');}
    assert.equal(s.notices.at(-1),'Network unavailable');
  });
}

test('Visibility controls are independent, do not submit and track PT/EN',async()=>{
  const s=setup();
  for(const id of ['loginPassword','signupPassword','signupPasswordConfirm','newPassword','newPasswordConfirm']) {
    const field=s.byId(id), button=field.toggle;
    assert.equal(button.type,'button'); assert.equal(button.attributes['aria-controls'],id);
    await button.fire('click'); assert.equal(field.type,'text'); assert.equal(button.textContent,'Ocultar senha');
    await button.fire('click'); assert.equal(field.type,'password');
  }
  await s.byId('signupPassword').toggle.fire('click');
  assert.equal(s.byId('signupPasswordConfirm').type,'password');
  s.setEnglish(); await s.byId('languageBtn').fire('click');
  assert.equal(s.byId('signupPassword').toggle.textContent,'Hide password');
  assert.equal(s.byId('signupPasswordConfirm').toggle.textContent,'Show password');
  assert.equal(s.calls.length,0);
});

test('Recovery uses its own email field and keeps the existing callback',async()=>{
  const s=setup();
  s.byId('loginEmail').value='unrelated@example.test';
  s.byId('resetEmail').value='recovery@example.test';
  await s.byId('resetForm').fire('submit');
  assert.equal(s.calls.length,1);
  assert.equal(s.calls[0][0],'reset');
  assert.equal(s.calls[0][1],'recovery@example.test');
  assert.equal(s.calls[0][2].redirectTo,'http://localhost:4173/Cyber-Us/comunidade.html');
  assert.equal(s.calls[0][2].captchaToken,'mock-token');
});
