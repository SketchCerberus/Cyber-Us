import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});test.after(()=>browser.close());
test('owner editor: keyboard, translated controls, conflict draft, spoiler and mobile widths',async()=>{
 for(const width of [320,390,1280]){
 const page=await browser.newPage({viewport:{width,height:850}});
 await page.setContent('<html lang="pt-BR"><body><main><article id="comment"><p>Comentário original</p></article></main></body></html>');
 await page.addStyleTag({content:readFileSync(new URL('../comment-editor.css',import.meta.url),'utf8')});
 await page.addScriptTag({content:readFileSync(new URL('../comment-editor.js',import.meta.url),'utf8')});
 await page.evaluate(()=>{window.calls=[];window.error={code:'40001'};window.saved=0;window.CyberUsCommentEditor.mount({container:document.querySelector('article'),comment:{id:'17',body:'[CYBER-US-SPOILER]\nsecret',created_at:'initial'},kind:'episode',eligible:()=>true,db:{rpc:async(n,args)=>{window.calls.push(args);return window.error?{error:window.error}:{data:'next'};}},onSaved:async()=>{window.saved++;}});});
 await page.getByRole('button',{name:'Editar meu comentário'}).click();
 assert.equal(await page.locator('textarea').evaluate(e=>e===document.activeElement),true);
 await page.locator('textarea').fill('draft');await page.getByRole('button',{name:'Salvar',exact:true}).click();
 assert.equal(await page.locator('textarea').inputValue?.() ?? await page.locator('textarea').evaluate(e=>e.value),'draft');
 assert.match(await page.getByRole('status').textContent(),/comentário mudou/);
 await page.evaluate(()=>document.documentElement.lang='en');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Edit my comment'}).click();await page.locator('textarea').press('Escape');
 assert.equal(await page.locator('form').isVisible(),false);
 await page.getByRole('button',{name:'Edit my comment'}).click();await page.locator('textarea').fill('changed');
 await page.evaluate(()=>window.error=null);await page.getByRole('button',{name:'Save',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.saved),1);assert.equal(await page.evaluate(()=>window.calls.at(-1).p_body),'[CYBER-US-SPOILER]\nchanged');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.close();
 }
});
