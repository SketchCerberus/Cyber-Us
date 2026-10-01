import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../newsletter-embed.js',import.meta.url),'utf8');
test('newsletter changes both the embedded and external form without reloading on repeated language updates',()=>{
  let observer,reloads=0,src='pt-form';
  const frame={dataset:{newsletterSrcPt:'pt-form',newsletterSrcEn:'en-form'},getAttribute:()=>src,setAttribute(_key,value){src=value;reloads++;}};
  const link={dataset:{newsletterLinkPt:'pt-link',newsletterLinkEn:'en-link'}};
  const document={documentElement:{lang:'pt-BR'},querySelector:s=>s.includes('src')?frame:link};
  vm.runInNewContext(source,{document,MutationObserver:class{constructor(fn){observer=fn;}observe(){}}});
  assert.equal(src,'pt-form');assert.equal(link.href,'pt-link');assert.equal(reloads,0);
  document.documentElement.lang='en';observer();assert.equal(src,'en-form');assert.equal(link.href,'en-link');assert.equal(reloads,1);
  observer();assert.equal(reloads,1);
  document.documentElement.lang='pt-BR';observer();assert.equal(src,'pt-form');assert.equal(link.href,'pt-link');
});
