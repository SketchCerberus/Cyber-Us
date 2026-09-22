import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('upload layout loads after both existing controllers with cache-busted assets',()=>{
  const html=read('fanarts-publicar.html');
  const submit=html.indexOf('src="fanarts-submit.js"');
  const owned=html.indexOf('src="fanarts-my-submissions.js"');
  const layout=html.indexOf('src="fanarts-submit-layout.js?v=');
  assert.ok(submit!==-1&&owned>submit&&layout>owned,'layout must run after original setup and the my-submissions tag reorder');
  assert.match(html,/href="fanarts-submit-layout\.css\?v=/);
  for(const id of ['fanarts-name','fanarts-art-title','fanarts-country','fanarts-publish-country','fanarts-image','fanarts-artist-link','fanarts-original'])
    assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/fieldset disabled/);
});

test('existing inputs and preview move into four accessible sections without replacing validation or submit',()=>{
  const js=read('fanarts-submit-layout.js');
  const submit=read('fanarts-submit.js');
  assert.match(js,/const fieldset=form\?\.querySelector\('fieldset'\)/);
  assert.match(js,/item\.append\(label,input\);panel\.append\(item\)/);
  assert.match(js,/fieldset\.append\(layout,footer\)/);
  for(const id of ['fanarts-name','fanarts-art-title','fanarts-country','fanarts-artist-link','fanarts-image','fanarts-accent'])
    assert.ok(js.includes(`moveField(info,'${id}')`)||js.includes(`moveField(upload,'${id}')`)||js.includes(`moveField(classification,'${id}')`),id);
  for(const section of ['fanarts-info-heading','fanarts-file-heading','fanarts-classification-heading','fanarts-preview-heading'])
    assert.ok(js.includes(section),section);
  assert.match(js,/footer\.append\(button\)/);
  assert.match(js,/previewCard\)/);
  assert.match(js,/form\.addEventListener\('reset'/);
  assert.match(js,/window\.addEventListener\('cyberus:fanart-uploaded'/);
  assert.match(submit,/fieldset\.disabled=!ready/);
  assert.match(submit,/form\.addEventListener\('submit'/);
  assert.doesNotMatch(js,/cloneNode|replaceWith|\.innerHTML\s*=|createClient|\.insert\(|\.upload\(/);
});

test('all existing tags stay in grouped choices with spoiler and eight-tag limit unchanged',()=>{
  const js=read('fanarts-submit-layout.js');
  const submit=read('fanarts-submit.js');
  for(const tag of ['Auará','Kaubi','Óete','Sistema','Trojan','Malware','OC','Ships','Crossover','Grupo','Swap','E se...','AU','Colaboração','Fofo','Sério','Chibi','Humor','WIP','Spoiler'])
    assert.ok(js.includes(`'${tag}'`),`missing categorized tag ${tag}`);
  assert.match(js,/choices\.append\(tag\)/);
  assert.match(js,/classification\.append\(tags\)/);
  assert.match(js,/tagInputs\.filter\(input=>input\.checked\)\.length\}\/8/);
  assert.match(submit,/tagInputs\.filter\(input=>input\.checked\)\.length>8/);
});

test('responsive layout balances columns then stacks, and dynamic copy is bilingual',()=>{
  const css=read('fanarts-submit-layout.css');
  const js=read('fanarts-submit-layout.js');
  assert.match(css,/\.fanarts-form-layout\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:860px\)\{\.fanarts-form-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/\.fanarts-preview-placeholder\[hidden\]\{display:none!important\}/);
  assert.match(css,/\.fanarts-form-footer button\{width:100%/);
  assert.match(js,/element\.dataset\.pt=br;element\.dataset\.en=en/);
  assert.match(js,/attributeFilter:\['lang'\]/);
  assert.match(js,/values\.title\.textContent=/);
  assert.match(js,/placeholder\.hidden=!previewCard\.hidden/);
});
