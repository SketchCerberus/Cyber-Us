import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../header-account.js', import.meta.url), 'utf8');
const id = '11111111-1111-4111-8111-111111111111';
const version = '22222222-2222-4222-8222-222222222222';
const settle = () => new Promise(resolve => setImmediate(resolve));

function setup({ user = null, profile = null, lang = 'pt-BR' } = {}) {
  const observers = [], windowEvents = {}, documentEvents = {};
  class Element {
    constructor(tag) { this.tag = tag; this.attributes = {}; this.dataset = {}; this.children = []; this.events = {}; this._text = ''; this.classNames = new Set(); this.classList = { add: key => this.classNames.add(key), remove: key => this.classNames.delete(key), contains: key => this.classNames.has(key) }; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    removeAttribute(key) { delete this.attributes[key]; }
    appendChild(node) { this.children.push(node); return node; }
    replaceChildren(...nodes) { this.children = nodes; this._text = ''; }
    addEventListener(key, fn) { this.events[key] = fn; }
    remove() { this.removed = true; }
  }
  const link = new Element('a');
  link.setAttribute('data-pt', 'Entrar / Cadastre-se');
  link.setAttribute('data-en', 'Sign in / Sign up');
  link.textContent = 'Entrar / Cadastre-se';
  const root = { lang };
  const memberSection = { hidden: !user };
  const accountStatus = {};
  const document = {
    documentElement: root, baseURI: 'https://example.test/index.html',
    head: { children: [], appendChild(el) { this.children.push(el); } },
    querySelector(selector) { return selector.includes('.account-access') ? link : null; },
    getElementById(key) { return key === 'memberAccount' ? memberSection : key === 'accountStatus' ? accountStatus : null; },
    createElement: tag => new Element(tag),
    addEventListener(key, fn) { documentEvents[key] = fn; }
  };
  let loggedIn = user, currentProfile = profile, onAuth = null, profileQueries = 0;
  const db = {
    auth: { async getUser() { return { data: { user: loggedIn }, error: null }; }, onAuthStateChange(fn) { onAuth = fn; } },
    from(table) { assert.equal(table, 'profiles'); return { select(cols) { assert.equal(cols, 'display_name,username,avatar'); return { eq(field, value) { assert.equal(field, 'id'); assert.equal(value, id); return { async maybeSingle() { ++profileQueries; return { data: currentProfile, error: null }; } }; } }; } }; }
  };
  const window = {
    supabase: { createClient(url, key, options) { assert.equal(url, 'https://znenamrszhjsiztllcit.supabase.co'); assert.equal(options.auth.detectSessionInUrl, false); return db; } },
    addEventListener(key, fn) { windowEvents[key] = fn; }
  };
  class MutationObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
  }
  const context = { window, document, MutationObserver, URL, setTimeout(fn) { fn(); return 1; }, clearTimeout() {} };
  vm.runInNewContext(source, context);
  return {
    link, root, observers, memberSection, accountStatus,
    async signedIn(profileValue = { display_name: 'Maria', avatar: 'robot' }) { loggedIn = { id }; currentProfile = profileValue; onAuth('SIGNED_IN'); await settle(); await settle(); },
    async signedOut() { loggedIn = null; onAuth('SIGNED_OUT'); await settle(); await settle(); },
    async setProfile(value) { currentProfile = value; observers.filter(o => o.target === memberSection).forEach(o => o.callback()); await settle(); await settle(); },
    changeLanguage(next) { root.lang = next; observers.filter(o => o.target === root).forEach(o => o.callback()); },
    get profileQueries() { return profileQueries; }
  };
}

test('Guests see the original bilingual sign-in link and can still use it', async () => {
  const s = setup(); await settle(); await settle();
  assert.equal(s.link.textContent, 'Entrar / Cadastre-se');
  assert.equal(s.link.classList.contains('is-signed-in'), false);
  s.changeLanguage('en');
  assert.equal(s.link.textContent, 'Sign in / Sign up');
});

test('Verified account shows public name + preset avatar, updates language, and returns to guest after logout', async () => {
  const s = setup({ user: { id }, profile: { display_name: 'Maria', avatar: 'robot' } }); await settle(); await settle();
  assert.equal(s.link.classList.contains('is-signed-in'), true);
  assert.equal(s.link.children[0].textContent, '🤖');
  assert.equal(s.link.children[1].textContent, 'Maria');
  assert.equal(s.link.getAttribute('data-pt'), null);
  s.changeLanguage('en');
  assert.equal(s.link.getAttribute('aria-label'), 'Your account: Maria');
  await s.signedOut();
  assert.equal(s.link.textContent, 'Sign in / Sign up');
  assert.equal(s.link.getAttribute('data-pt'), 'Entrar / Cadastre-se');
});

test('Login replaces guest link with name and avatar', async () => {
  const s = setup(); await settle(); await settle();
  await s.signedIn({ display_name: 'Ana', avatar: 'fox' });
  assert.equal(s.link.children[1].textContent, 'Ana');
  assert.equal(s.link.children[0].textContent, '🦊');
  assert.equal(s.link.classList.contains('is-signed-in'), true);
});

test('Image URLs require two UUIDs; arbitrary URLs and names are never HTML', async () => {
  const s = setup({ user: { id }, profile: { display_name: '<img onerror=evil()>', avatar: 'https://bad.example/x' } }); await settle(); await settle();
  assert.equal(s.link.children[1].textContent, '<img onerror=evil()>');
  assert.equal(s.link.children[0].textContent, '👤');
  assert.equal(s.link.children[0].children.length, 0);
  await s.setProfile({ display_name: 'Taylor', avatar: 'upload:' + version });
  assert.equal(s.link.children[0].children[0].src, `https://znenamrszhjsiztllcit.supabase.co/storage/v1/object/public/community-avatars/${id}/avatar.jpg?v=${version}`);
  assert.ok(s.profileQueries >= 2);
});
