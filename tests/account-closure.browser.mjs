import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});test.after(()=>browser.close());
test('closure requires typed confirmation, translates, handles reauthentication and signs out after success',async()=>{
 const page=await browser.newPage({viewport:{width:320,height:850}});
 await page.setContent('<html lang="pt"><body><p id="accountStatus"></p><section id="memberAccount"></section></body></html>');
 await page.evaluate(()=>{window.calls=0;window.signedOut=0;window.code='reauth';window.CyberUsGetClient=()=>({functions:{invoke:async()=>{window.calls++;return window.code==='closed'?{data:{code:'closed'}}:{error:{context:{json:async()=>({code:window.code})}}};}},auth:{signOut:async()=>{window.signedOut++;}}});});
 await page.addScriptTag({content:readFileSync(new URL('../account-closure.js',import.meta.url),'utf8')});
 await page.locator('input').fill('wrong');await page.getByRole('button').click();assert.equal(await page.evaluate(()=>window.calls),0);
 await page.locator('input').fill('EXCLUIR');await page.getByRole('button').click();assert.match(await page.getByRole('status').textContent(),/entre novamente/);assert.equal(await page.evaluate(()=>window.signedOut),0);
 await page.evaluate(()=>document.documentElement.lang='en');await page.getByRole('button',{name:'Permanently delete account'}).waitFor();
 await page.locator('input').fill('DELETE');await page.evaluate(()=>window.code='closed');await page.getByRole('button').click();assert.equal(await page.evaluate(()=>window.signedOut),1);assert.equal(await page.locator('#memberAccount').isVisible(),false);assert.match(await page.locator('#accountStatus').textContent(),/anonymized/);
 await page.close();
});
