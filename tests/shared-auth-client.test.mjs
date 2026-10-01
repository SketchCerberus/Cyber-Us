import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../supabase-client.js',import.meta.url),'utf8');
for(const page of ['account','episode',undefined])test('one SDK client and safe callback handling on '+page,()=>{
  let calls=0,options;
  const db={auth:{}};const window={};
  vm.runInNewContext(source,{window,document:{body:{dataset:{communityPage:page}}}});
  assert.equal(window.CyberUsGetClient(),null);
  window.supabase={createClient(_url,_key,config){calls++;options=config;return db;}};
  assert.equal(window.CyberUsGetClient(),db);assert.equal(window.CyberUsGetClient(),db);assert.equal(calls,1);
  assert.equal(options.auth.flowType,'pkce');assert.equal(options.auth.autoRefreshToken,true);assert.equal(options.auth.detectSessionInUrl,page==='account');
});
