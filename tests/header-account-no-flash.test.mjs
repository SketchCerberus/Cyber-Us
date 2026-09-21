import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../header-account.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../header-scroll.css', import.meta.url), 'utf8');
const id = '11111111-1111-4111-8111-111111111111';
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function setup({ sdkAvailable = true } = {}) {
  const session = deferred(), profile = deferred();
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.dataset = {};
      this.attributes = {};
      this.events = {};
      this.children = [];
      this.classNames = new Set();
      this.classList = {
        add: name => this.classNames.add(name),
        remove: name => this.classNames.delete(name),
        contains: name => this.classNames.has(name)
      };
    }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return this.text; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name, fn) { this.events[name] = fn; }
    remove() { this.removed = true; }
  }
  const link = new Element('a');
  link.setAttribute('data-pt', 'Entrar / Cadastre-se');
  link.setAttribute('data-en', 'Sign in / Sign up');
  link.textContent = 'Entrar / Cadastre-se';
  const sdkTag = new Element('script');
  const db = {
    auth: {
      getUser: () => session.promise,
      onAuthStateChange() {}
    },
    from(table) {
      assert.equal(table, 'profiles');
      return {
        select() { return { eq() { return { maybeSingle: () => profile.promise }; } }; }
      };
    }
  };
  const document = {
    documentElement: { lang: 'pt-BR' }, baseURI: 'https://example.test/',
    head: { appendChild() {} },
    querySelector(selector) {
      return selector.includes('.account-access') ? link : sdkTag;
    },
    getElementById() { return null; },
    createElement: tag => new Element(tag),
    addEventListener() {}
  };
  const window = {
    supabase: sdkAvailable ? { createClient: () => db } : null,
    addEventListener() {}
  };
  class MutationObserver { observe() {} }
  vm.runInNewContext(script, { document, window, MutationObserver, URL });
  return { link, session, profile, sdkTag };
}

test('Header stylesheet suppresses only the unresolved account link and has a no-script fallback', () => {
  assert.match(css, /\.site-header nav a\.account-access:not\(\.account-badge-ready\)\s*\{\s*visibility:hidden;/);
  assert.match(css, /animation:account-badge-fallback 0s 5s forwards/);
});

test('Existing signed-in session remains concealed through both async requests, then shows complete badge', async () => {
  const s = setup();
  assert.equal(s.link.classList.contains('account-badge-ready'), false);
  s.session.resolve({ data: { user: { id } }, error: null });
  await settle();
  assert.equal(s.link.classList.contains('account-badge-ready'), false);
  s.profile.resolve({ data: { display_name: 'Maria', avatar: 'robot' }, error: null });
  await settle();
  assert.equal(s.link.children[1].textContent, 'Maria');
  assert.equal(s.link.children[0].textContent, '🤖');
  assert.equal(s.link.classList.contains('account-badge-ready'), true);
});

test('Guest link becomes visible only after the session check finishes', async () => {
  const s = setup();
  assert.equal(s.link.classList.contains('account-badge-ready'), false);
  s.session.resolve({ data: { user: null }, error: null });
  await settle();
  assert.equal(s.link.textContent, 'Entrar / Cadastre-se');
  assert.equal(s.link.classList.contains('account-badge-ready'), true);
});

test('An unavailable SDK reveals the original sign-in link instead of hiding it forever', () => {
  const s = setup({ sdkAvailable: false });
  assert.equal(s.link.classList.contains('account-badge-ready'), false);
  s.sdkTag.events.error();
  assert.equal(s.link.classList.contains('account-badge-ready'), true);
});
