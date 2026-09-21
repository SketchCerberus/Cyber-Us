import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function setupShortcut() {
  const observers = [];
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.attributes = {};
      this.hidden = false;
      this.parentNode = null;
    }
    appendChild(item) { this.children.push(item); item.parentNode = this; }
    append(item) { this.appendChild(item); }
    insertBefore(item, previous) {
      const index = this.children.indexOf(previous);
      this.children.splice(index < 0 ? this.children.length : index, 0, item);
      item.parentNode = this;
    }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
  }
  const member = new Element('section');
  member.hidden = true;
  const heading = new Element('h2');
  member.appendChild(heading);
  const panel = new Element('section');
  panel.hidden = true;
  const document = {
    currentScript: {src:'https://example.test/Cyber-Us/moderation-launch.js'},
    documentElement: {lang:'pt-BR'},
    getElementById(id) { return {memberAccount:member, memberHeading:heading, moderationPanel:panel}[id] || null; },
    createElement: tag => new Element(tag)
  };
  class MutationObserver {
    constructor(fn) { this.fn = fn; observers.push(this); }
    observe(target) { this.target = target; }
  }
  vm.runInNewContext(read('moderation-launch.js'), {document, MutationObserver, URL});
  const link = member.children[0].children[1];
  const sync = () => observers.forEach(observer => observer.fn());
  return {member,panel,heading,link,sync};
}

test('Moderation shortcut is located alongside the profile heading, initially hidden', () => {
  const {member,heading,link} = setupShortcut();
  assert.equal(member.children[0].children[0],heading);
  assert.equal(link.hidden,true);
  assert.equal(link.attributes['data-pt'],'⚙ Moderação');
  assert.equal(link.attributes['data-en'],'⚙ Moderation');
  assert.equal(link.href,'https://example.test/Cyber-Us/moderacao.html');
});

test('Shortcut is shown only with visible account AND authorized legacy staff state', () => {
  const state = setupShortcut();
  state.member.hidden = false;
  state.sync();
  assert.equal(state.link.hidden,true);
  state.panel.hidden = false;
  state.sync();
  assert.equal(state.link.hidden,false);
  state.member.hidden = true;
  state.sync();
  assert.equal(state.link.hidden,true);
  state.member.hidden = false;
  state.panel.hidden = true;
  state.sync();
  assert.equal(state.link.hidden,true);
});

test('Comment submission records reader language in root and reply, while DB owns reply inheritance', () => {
  const community = read('community.js');
  const migration = read('supabase/migrations/20260921_tag_comment_language_for_moderation.sql');
  assert.match(community, /parent_id:comment\.id,body,language_code:pt\(\) \? 'pt' : 'en'/);
  assert.match(community, /author_id: state\.user\.id, body, language_code: pt\(\) \? 'pt' : 'en'/);
  assert.match(migration, /language_code text not null default 'pt'/);
  assert.match(migration, /new\.language_code\s+from public\.comments parent/);
  assert.match(migration, /grant insert \(language_code\) on public\.comments to authenticated/);
});

test('Moderation dashboard checks staff before rendering and filters on server by episode and locale', () => {
  const page = read('moderacao.html');
  const code = read('moderation.js');
  const css = read('moderation.css');
  assert.match(page, /id="moderationWorkspace" hidden/);
  assert.match(code, /db\.auth\.getUser\(\)/);
  assert.match(code, /db\.rpc\('is_moderator'\)/);
  assert.match(code, /\.eq\('episode_slug',slug\)\.eq\('language_code',locale\)/);
  assert.match(code, /\.from\('episodes'\)\.select\('slug,title_pt,title_en,sort_order'\)/);
  assert.match(code, /\.range\(start,start\+pageSize-1\)/);
  assert.match(code, /\+\+state\.request;\s*state\.loading = false;\s*state\.selection = \{slug:episode\.slug,locale\}/);
  assert.match(css, /\.moderation-languages\[hidden\]\s*\{\s*display:none!important/);
  assert.match(css, /#moderationPanel\s*\{\s*display:none!important/);
});
