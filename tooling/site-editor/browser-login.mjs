import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const fixture=JSON.parse(readFileSync('/tmp/editor-evidence/auth-fixtures.json','utf8')).find(x=>x.role==='ops');
const browser=await chromium.launch({headless:true,channel:'chromium'});const context=await browser.newContext();const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:3001/admin/login');
 await page.locator('input[type=text]').fill(fixture.email);
 await page.locator('input[type=password]').fill(fixture.password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.waitForURL('**/admin/overview',{timeout:25000});
 await context.storageState({path:'/tmp/editor-evidence/admin-state.json'});
 await page.goto('http://localhost:3001/admin/collections/site-pages');
 await page.waitForTimeout(2000);
 console.log(JSON.stringify({login:true,url:page.url(),headings:await page.getByRole('heading').allTextContents(),buttons:await page.getByRole('button').allTextContents(),errors}));
 await page.screenshot({path:'/tmp/editor-evidence/pages-list.png',fullPage:true});
}finally{await browser.close();}
