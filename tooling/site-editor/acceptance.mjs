/** End-to-end acceptance. Requires the guarded disposable fixture and two local built apps. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
if (process.env.SITE_EDITOR_TEST_CONFIRM !== 'disposable') throw new Error('Run only against the disposable local test environment.');
const admin='http://localhost:3001',site='http://localhost:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const credentials=JSON.parse(await readFile('/tmp/cms-browser-fixture.json','utf8'));
const login=await context.newPage();
await login.goto(admin+'/admin/login',{waitUntil:'networkidle',timeout:60000});
await login.locator('input[type="text"]').fill(credentials.email);
await login.locator('input[type="password"]').fill(credentials.password);
await login.getByRole('button',{name:'Sign in',exact:true}).click();
await login.waitForURL(url=>url.pathname === '/admin/collections/site-pages',{timeout:30000}).catch(async error=>{console.log('LOGIN LANDING',login.url(),(await login.locator('body').innerText()).slice(0,800));throw error;});
assert.equal(new URL(login.url()).pathname,'/admin/collections/site-pages');
console.log('PASS content editor signs in and lands on Website pages');
await login.close();
const visitor=await browser.newContext({viewport:{width:1440,height:1000}});
const results=[]; const pass=name=>{results.push(name);console.log('PASS '+name);};
for (const ctx of [context,visitor]) {
 await ctx.route('https://cdn.example.test/**',async route=>{
  try{const name=path.basename(new URL(route.request().url()).pathname);await route.fulfill({status:200,body:await readFile('/tmp/nycmon-cms-test-objects/'+name),contentType:name.endsWith('.png')?'image/png':'image/webp'});}catch{await route.fulfill({status:404,body:''});}
 });
 await ctx.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>YouTube transport fixture</title>'}));
 await ctx.route('https://nyc-mon.vercel.app/cms-embed-test',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>UI frame fixture</title><p>UI embed fixture</p>'}));
}
const api=async(method,route,data)=>{
 const response=await context.request.fetch(admin+route,{method,data,headers:{Origin:admin}});
 assert.ok(response.ok(),`${method} ${route}: ${response.status()} ${await response.text()}`);return response.json();
};
const docs=(await api('GET','/payload-api/site-pages?limit=100&draft=true&depth=0')).docs;
const home=docs.find(doc=>doc.route==='/');assert.ok(home);const id=home.id;
const original=structuredClone(home);const editor=await context.newPage();const publicPage=await visitor.newPage();
const errors=[];publicPage.on('pageerror',error=>errors.push(error.message));
const readHome=async()=>{await publicPage.goto(site+'/',{waitUntil:'domcontentloaded',timeout:90000});await publicPage.locator('h1').waitFor({timeout:30000});return (await publicPage.locator('h1').innerText()).replace(/\s+/g,' ').trim();};
const openEditor=async()=>{
 await editor.goto(`${admin}/admin/collections/site-pages/${id}`,{waitUntil:'networkidle',timeout:60000});
 await editor.getByRole('button',{name:'Show All: Sections',exact:true}).click();
};
const save=async(label)=>{
 const response=editor.waitForResponse(r=>new URL(r.url()).pathname===`/payload-api/site-pages/${id}`&&r.request().method()==='PATCH'&&r.ok(),{timeout:30000});
 await editor.getByRole('button',{name:label,exact:typeof label==='string'}).click();await response;
};
try {
 // A real native browser drop event, not input.setFiles or an API-only upload.
 await editor.goto(admin+'/admin/collections/media/create',{waitUntil:'networkidle',timeout:60000});
 await editor.locator('input[name="alt"]').fill('Acceptance drag/drop image');
 const transfer=await editor.evaluateHandle(()=>{const d=new DataTransfer();const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),x=>x.charCodeAt(0));d.items.add(new File([bytes],'editor-drop.png',{type:'image/png'}));return d;});
 for(const event of ['dragenter','dragover','drop']) await editor.locator('.dropzone').dispatchEvent(event,{dataTransfer:transfer});
 const upload=editor.waitForResponse(r=>new URL(r.url()).pathname==='/payload-api/media'&&r.request().method()==='POST'&&r.ok(),{timeout:30000});
 await editor.getByRole('button',{name:'Save',exact:true}).click();const uploaded=(await (await upload).json()).doc;
 assert.match(uploaded.url,/^https:\/\/cdn\.example\.test\//);pass('browser drag/drop uploads a media record through the existing Bunny hook');
 const oldHeading=await readHome();await openEditor();
 await editor.locator('#sections-row-0').getByRole('button',{name:/^Show All:/}).last().click();
 const image=editor.locator('#field-sections__0__content__0__image');
 await image.getByRole('button',{name:'Remove',exact:true}).click();await image.getByRole('button',{name:'Choose from existing',exact:true}).click();
 await editor.getByRole('button').filter({hasText:uploaded.filename}).click();
 await editor.waitForLoadState('networkidle');
 await image.getByRole('button',{name:'Edit',exact:true}).waitFor();
 await editor.waitForTimeout(600);
 const draftTitle='My editable NYC-MON website';await editor.locator('textarea[name="sections.0.copy.0.value"]').fill(draftTitle);await editor.locator('textarea[name="sections.0.copy.0.value"]').press('Tab');await editor.waitForTimeout(350);await save('Save Draft');
 const draft=(await api('GET',`/payload-api/site-pages/${id}?draft=true&depth=0`));
 assert.equal(draft.sections[0].copy[0].value,draftTitle);assert.equal(draft.sections[0].content[0].image,uploaded.id);pass('browser media picker replaces only the chosen page/section image');
 assert.equal(await readHome(),oldHeading);pass('saving a draft does not change the anonymous published page');
 const popup=context.waitForEvent('page');await editor.getByRole('link',{name:/Preview saved draft/}).click();const preview=await popup;
 await preview.waitForURL(url=>url.origin===site&&!url.pathname.startsWith('/api/'),{timeout:30000});
 await preview.getByLabel('Draft preview',{exact:true}).waitFor({timeout:30000});
 await preview.locator('h1').waitFor({timeout:30000});
  await preview.waitForFunction(()=>document.querySelector('h1')?.textContent?.toLowerCase().includes('my editable'),{timeout:30000});
 assert.match(await preview.locator('meta[name="robots"]').getAttribute('content'),/noindex/);pass('explicit preview opens a private saved draft with noindex');
 const liveTitle='Saved preview refresh works';draft.sections[0].copy[0].value=liveTitle;
 await api('PATCH',`/payload-api/site-pages/${id}?draft=true`,{sections:draft.sections,_status:'draft'});
 await preview.waitForFunction(()=>document.querySelector('h1')?.textContent?.toLowerCase().includes('saved preview refresh'),{timeout:15000});pass('saved-draft preview refreshes without publishing');
 await preview.getByRole('link',{name:'Exit preview',exact:true}).click();await preview.waitForURL(site+'/',{timeout:30000});
 await preview.waitForFunction(()=>!document.querySelector('[aria-label="Draft preview"]'),{timeout:15000});await preview.close();pass('exit preview removes the private preview session');
 await openEditor();await save(/^Publish changes/);
 assert.match(await readHome(),/saved preview refresh/i);
 const heroImage=publicPage.locator('#mfx-hero-art img').first();assert.equal(await heroImage.getAttribute('src'),uploaded.url);pass('browser Publish updates page copy and selected image without a deployment');
 const updated=await api('GET',`/payload-api/site-pages/${id}?draft=true&depth=0`);
 updated.sections.push({sectionKey:'acceptance-media',label:'Acceptance media',copy:[],content:[
  {blockType:'text',heading:'CMS acceptance section',body:'Editable section body.'},
  {blockType:'gallery',images:[{image:uploaded.id,alt:'Gallery first',caption:'First'},{image:uploaded.id,alt:'Gallery second',caption:'Second'}]},
  {blockType:'youtube',title:'CMS YouTube video',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',aspect:'16:9'},
  {blockType:'iframe',title:'CMS UI embed',url:'https://nyc-mon.vercel.app/cms-embed-test',aspect:'16:9'},
 ]});
 await api('PATCH',`/payload-api/site-pages/${id}`,{sections:updated.sections,_status:'published'});await readHome();
 await publicPage.getByText('CMS acceptance section',{exact:true}).waitFor();assert.equal(await publicPage.getByAltText('Gallery first').count(),1);
 assert.match(await publicPage.locator('iframe[title="CMS YouTube video"]').getAttribute('src'),/^https:\/\/www.youtube-nocookie.com\/embed\//);
 const frame=publicPage.locator('iframe[title="CMS UI embed"]');assert.equal(await frame.getAttribute('sandbox'),'allow-scripts allow-same-origin allow-presentation');
 pass('section copy, gallery, YouTube and allowlisted UI iframe render through the existing UI');
 const routes=['/story','/city','/how-it-works','/get','/mons','/mons/hood-ratti','/mons/bodega-cee','/mons/yotes','/legal/privacy','/legal/terms','/legal/childrens-privacy'];
 for(const route of routes){await publicPage.goto(site+route,{waitUntil:'domcontentloaded',timeout:60000});await publicPage.locator('h1').waitFor({timeout:30000});assert.ok((await publicPage.locator('h1').innerText()).length,route);}
 pass('all twelve marketing and legal page routes render published CMS records');
 await api('PATCH',`/payload-api/site-pages/${id}`,{_status:'draft'});
 await publicPage.goto(site+'/',{waitUntil:'domcontentloaded',timeout:60000});await publicPage.waitForTimeout(500);
 assert.equal(await publicPage.locator('#mfx-hero-title').count(),0);assert.match(await publicPage.locator('body').innerText(),/404|not found|wrong block|lost/i);pass('unpublishing does not resurrect the old hardcoded homepage');
 await publicPage.setViewportSize({width:390,height:844});await publicPage.goto(site+'/story',{waitUntil:'domcontentloaded'});await publicPage.locator('h1').waitFor();
 assert.ok(await publicPage.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+2));pass('phone-width Story page has no horizontal overflow');
 await mkdir('/tmp/cms-evidence',{recursive:true});await publicPage.screenshot({path:'/tmp/cms-evidence/story-mobile.png',fullPage:true});
 await writeFile('/tmp/cms-evidence/browser.json',JSON.stringify({checks:results,errors,externalTransport:'Bunny image transport and embedded external page responses isolated with test fixtures; real built website/admin/DB.'},null,2));
 console.log(`BROWSER RESULT: ${results.length} passed; page errors: ${JSON.stringify(errors)}`);
} finally {
 const {title,route,seo,sections}=original;await api('PATCH',`/payload-api/site-pages/${id}`,{title,route,seo,sections,_status:'published'}).catch(error=>console.error('Fixture restore failed',error.message));await browser.close();
}
