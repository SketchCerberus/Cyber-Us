import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('account and signup pages load the availability controller after the existing account flow',()=>{
  const js=read('community-username.js');
  for(const page of ['comunidade.html','cadastro.html']){
    const html=read(page);
    assert.ok(html.indexOf('src="community-username.js?v=')>html.indexOf('src="community.js"'));
    assert.match(html,/href="community-username\.css\?v=/);
    assert.match(html,/id="profileUsername"[^>]+required/);
    assert.match(html,/name="username"[^>]+pattern="\[a-z0-9_\]\{3,24\}"/);
    assert.match(html,/data-pt="@Usuário exclusivo/);
  }
  assert.match(read('cadastro.html'),/Após confirmar seu e-mail, escolha um @usuário exclusivo/);
  assert.match(js,/input\.required=true/);
});

test('availability distinguishes own username, taken username, invalid input and server error',()=>{
  const js=read('community-username.js');
  assert.match(js,/\^\[a-z0-9_\]\{3,24\}\$/);
  assert.match(js,/\.from\('profiles'\)\.select\('id'\)\.eq\('username',value\)\.limit\(1\)/);
  assert.match(js,/match\.data\[0\]\.id===auth\.data\.user\.id/);
  assert.match(js,/Este @usuário já está em uso/);
  assert.match(js,/Este @usuário está disponível/);
  assert.match(js,/Não foi possível verificar o usuário/);
  assert.match(js,/input\.setAttribute\('aria-describedby'/);
  assert.match(js,/status\.setAttribute\('aria-live','polite'\)/);
  assert.doesNotMatch(js,/service_role|sb_secret_|\.insert\(|innerHTML/);
});

test('pre-submit check runs before existing handler, protects against stale results and retries once',()=>{
  const js=read('community-username.js');
  const account=read('community.js');
  assert.match(js,/form\.addEventListener\('submit',event=>\{/);
  assert.match(js,/event\.preventDefault\(\);event\.stopImmediatePropagation\(\)/);
  assert.match(js,/token!==sequence\|\|input\.value\.trim\(\)!==value/);
  assert.match(js,/if\(allowOnce===value&&valid\(value\)\)/);
  assert.match(js,/form\.requestSubmit\(\)/);
  assert.match(account,/\.from\('profiles'\)\.update\(\{ display_name: name, username: username \|\| null \}\)/);
  assert.match(js,/attributeFilter:\['lang'\]/);
});
