import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function harness({authorized = true, locale = 'pt-BR'} = {}) {
  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.children = [];
      this.hidden = false;
      this.textContent = '';
      this.listeners = {};
      this.classList = {toggle() {}};
    }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(key, value) { (this.attributes ||= {})[key] = value; }
    addEventListener(event, fn) { this.listeners[event] = fn; }
    scrollIntoView() {}
  }
  const ids = [
    'moderationWorkspace','moderationNotice','moderationCommentsView','moderationBansView',
    'moderationCommentsTab','moderationBansTab','moderationFolders','moderationSelection',
    'moderationSelectedHeading','moderationMore','moderationComments','moderationCommentsStatus',
    'moderationBans','moderationReload','moderationBansReload'
  ];
  const elements = Object.fromEntries(ids.map(id => [id,new Element()]));
  elements.moderationWorkspace.hidden = true;
  const calls = [];
  const db = {
    auth: {
      getUser: async () => ({data:{user:authorized ? {id:'test-member'} : null}}),
      onAuthStateChange() {}
    },
    rpc: async name => {
      calls.push(name);
      if (name === 'is_moderator') return {data:authorized};
      if (name === 'moderation_active_bans_with_history') return {data:[{
        user_id:'test-member',display_name:'Example reader',reason:'Repeated spam',
        expires_at:null,account_created_at:'2025-03-02T12:00:00Z',
        ban_count:3,days_banned:'1.25'
      }]};
      return {data:[]};
    },
    from: () => ({
      select() {return this;}, eq() {return this;},
      order: async () => ({data:[]})
    })
  };
  const document = {
    documentElement:{lang:locale},
    getElementById:id => elements[id] || null,
    createElement:tag => new Element(tag)
  };
  const window = {supabase:{createClient:()=>db}, CyberUsAvatars:null};
  class MutationObserver {observe() {}}
  vm.runInNewContext(read('moderation.js'), {window,document,MutationObserver,Intl,Date,Number,String,setTimeout});
  const settle = async () => {await new Promise(resolve => setImmediate(resolve));};
  return {elements,calls,settle};
}

test('staff ban cards show count, served duration and actual account creation in Portuguese', async () => {
  const {elements,calls,settle} = harness();
  await settle();
  assert.equal(elements.moderationWorkspace.hidden,false);
  elements.moderationBansTab.listeners.click();
  await settle();
  assert.equal(calls.filter(name=>name === 'moderation_active_bans_with_history').length,1);
  const card = elements.moderationBans.children[0];
  const stats = card.children.find(child=>child.tag === 'dl');
  assert.ok(stats);
  assert.equal(stats.children.length,3);
  const pairs = stats.children.map(row => row.children.map(field=>field.textContent));
  assert.deepEqual(pairs[0],['Vezes banido','3']);
  assert.deepEqual(pairs[1],['Tempo banido (cumprido)','1,25 dias']);
  assert.equal(pairs[2][0],'Conta criada em');
  assert.match(pairs[2][1],/2025/);
  assert.equal(card.children.at(-1).textContent,'Revogar banimento');
});

test('ban summary and day formatting follow the English interface', async () => {
  const {elements,settle} = harness({locale:'en'});
  await settle();
  elements.moderationBansTab.listeners.click();
  await settle();
  const stats = elements.moderationBans.children[0].children.find(child=>child.tag === 'dl');
  assert.deepEqual(stats.children.map(row => row.children.map(field => field.textContent)).slice(0,2), [
    ['Times banned','3'],['Time banned (served)','1.25 days']
  ]);
  assert.equal(stats.children[2].children[0].textContent,'Account created');
});

test('visitors never request private ban history or see the workspace', async () => {
  const {elements,calls,settle} = harness({authorized:false});
  await settle();
  elements.moderationBansTab.listeners.click();
  await settle();
  assert.equal(elements.moderationWorkspace.hidden,true);
  assert.equal(calls.includes('moderation_active_bans_with_history'),false);
  assert.equal(calls.includes('is_moderator'),false);
});

test('SQL RPC requires staff and counts all historical bans, clipping time to expiry/revocation/now', () => {
  const sql = read('supabase/migrations/20260921_moderation_ban_account_history.sql');
  assert.match(sql,/security definer/i);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/community_private\.is_moderator\(\)/);
  assert.match(sql,/revoke all on function public\.moderation_active_bans_with_history\(\) from public, anon/i);
  assert.match(sql,/grant execute on function public\.moderation_active_bans_with_history\(\) to authenticated/i);
  assert.match(sql,/join auth\.users u on u\.id = a\.user_id/i);
  assert.match(sql,/count\(\*\)::bigint as ban_count/i);
  assert.match(sql,/least\(coalesce\(b\.revoked_at, now\(\)\), coalesce\(b\.expires_at, now\(\)\), now\(\)\)/i);
  assert.match(sql,/greatest\(0::numeric/i);
  assert.match(sql,/from community_private\.bans b\s+where b\.user_id in \(select a\.user_id from active a\)/i);
});
