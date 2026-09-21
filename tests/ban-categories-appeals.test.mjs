import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql = read('supabase/migrations/20260921_ban_categories_and_appeals.sql');
const mod = read('moderation-ban-appeals.js');
const mine = read('ban-self-service.js');

test('Both pages load their feature scripts and responsive stylesheet',()=>{
  const profile=read('comunidade.html');
  const panel=read('moderacao.html');
  assert.match(profile, /src="ban-self-service\.js"/);
  assert.match(panel, /src="moderation-ban-appeals\.js"/);
  for(const html of [profile,panel]) assert.match(html,/href="ban-appeals\.css"/);
  const css=read('ban-appeals.css');
  assert.match(css,/\.ban-detail-facts/);
  assert.match(css,/@media\(max-width:600px\)/);
});

test('Ban creation requires classification and prevents legacy click while access loads',()=>{
  for(const category of ['rule_violation','inappropriate_content','harassment','spam','other']) {
    assert.ok(sql.includes("'"+category+"'"));
    assert.ok(mod.includes("'"+category+"'"));
  }
  assert.match(mod,/addEventListener\('click',async event => \{/);
  assert.match(mod,/event\.stopImmediatePropagation\(\)/);
  assert.match(mod,/if \(!authorized\) return notice/);
  assert.match(mod,/db\.rpc\('ban_member_categorized'/);
  assert.match(sql,/community_private\.ban_member\(p_user_id,p_reason,p_expires_at\)/);
  assert.match(sql,/community_private\.ban_category_changes/);
  assert.match(mod,/db\.rpc\('moderation_classify_ban'/);
});

test('Only the logged-in account sees their own active ban and can appeal once',()=>{
  assert.match(sql,/CREATE FUNCTION public\.my_active_ban_details\(\)/);
  assert.match(sql,/b\.user_id=auth\.uid\(\)/);
  assert.match(sql,/CREATE FUNCTION public\.submit_ban_appeal\(p_ban_id uuid,p_body text\)/);
  assert.match(sql,/b\.id=p_ban_id AND b\.user_id=v_user/);
  assert.match(sql,/ban_id uuid NOT NULL UNIQUE/);
  assert.match(mine,/db\.rpc\('my_active_ban_details'\)/);
  assert.match(mine,/db\.rpc\('submit_ban_appeal'/);
  assert.match(mine,/form\.hidden=!!current\.appeal_status/);
  assert.match(mine,/appeal_status==='pending'/);
  assert.match(mine,/appeal_status==='rejected'/);
  assert.match(mine,/Math\.max\(0,Math\.ceil/);
  assert.match(mine,/t\('Permanente','Permanent'\)/);
});

test('Moderation RPCs validate server-side staff access and revoke only appealed ban',()=>{
  for(const name of ['ban_member_categorized','moderation_active_ban_categories','moderation_classify_ban','moderation_pending_appeals','moderation_decide_appeal']) {
    const fn=sql.indexOf('CREATE FUNCTION public.'+name+'(');
    assert.ok(fn!==-1,name+' exists');
    const next=sql.indexOf('CREATE FUNCTION public.',fn+1);
    const definition=sql.slice(fn,next<0?undefined:next);
    assert.match(definition,/community_private\.is_moderator\(\)/,name+' checks role');
  }
  assert.match(sql,/WHERE id=v_appeal\.ban_id AND user_id=v_appeal\.user_id AND revoked_at IS NULL/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/FROM PUBLIC,anon/);
  assert.match(mod,/db\.rpc\('moderation_pending_appeals'/);
  assert.match(mod,/db\.rpc\('moderation_decide_appeal'/);
});
