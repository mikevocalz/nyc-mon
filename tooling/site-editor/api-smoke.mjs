// HTTP integration against the real local Payload instance. Bunny transport is a separately labelled network double.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { request } from 'playwright';
import { signPreview } from '../../packages/content/site-content/preview.ts';
const base='http://localhost:3001';
const state='/tmp/editor-evidence/admin-state.json';
const staff=await request.newContext({baseURL:base,storageState:state,extraHTTPHeaders:{Origin:base}});
const anon=await request.newContext({baseURL:base});
const checks=[];
const fixtures=JSON.parse(readFileSync('/tmp/editor-evidence/auth-fixtures.json','utf8'));
async function json(response){const data=await response.json();assert.ok(response.ok(),`${response.status()} ${JSON.stringify(data).slice(0,700)}`);return data;}
async function publicHTML(route){const response=await fetch(`http://localhost:3000${route}`);return {response,html:await response.text()};}
try {
 const initial=await json(await anon.get('/payload-api/site-pages?limit=100'));assert.equal(initial.docs.length,0);checks.push('13 imported drafts are not anonymously readable');
 const list=await json(await staff.get('/payload-api/site-pages?draft=true&limit=100&depth=1'));assert.equal(list.docs.length,13);
 for(const doc of list.docs)await json(await staff.patch(`/payload-api/site-pages/${doc.id}`,{data:{_status:'published'}}));
 checks.push('All 13 seed documents publish through authenticated REST');
 const home=list.docs.find(x=>x.route==='/');const sections=structuredClone(home.sections);const marker='Private integration draft headline';sections.find(s=>s.sectionKey==='world').copy.find(r=>r.key==='title').value=marker;
 await json(await staff.patch(`/payload-api/site-pages/${home.id}?draft=true`,{data:{sections,_status:'draft'}}));
 const publicHome=await json(await anon.get('/payload-api/site-pages?where[route][equals]=%2F&draft=false&depth=1'));assert.ok(!JSON.stringify(publicHome).includes(marker));checks.push('Saving a draft preserves the published document');
 const token=signPreview({id:String(home.id),editor:fixtures.find(x=>x.role==='ops').id,route:'/',audience:'http://localhost:3000'},process.env.SITE_PREVIEW_SECRET);
 const preview=await publicHTML(`/cms-preview/${token}`);assert.equal(preview.response.status,200);assert.ok(preview.html.includes(marker));assert.match(preview.response.headers.get('cache-control')??'',/no-store|private/);checks.push('Signed private preview renders the unpublished draft');
 await json(await staff.patch(`/payload-api/site-pages/${home.id}`,{data:{sections,_status:'published'}}));
 const published=await publicHTML('/');assert.ok(published.html.includes(marker));checks.push('Publish updates the actual Next.js page');
 await json(await staff.patch(`/payload-api/site-pages/${home.id}`,{data:{sections:home.sections,_status:'published'}}));
 for(const doc of list.docs.filter(x=>x.route!=='/site-chrome')){const result=await publicHTML(doc.route);assert.equal(result.response.status,200,doc.route);assert.match(result.html,/<h1\b/);assert.ok(!result.html.includes('NEXT_HTTP_ERROR_FALLBACK;500'),doc.route);}
 checks.push('All 12 public marketing routes return rendered pages');
 const story=list.docs.find(x=>x.route==='/story');await json(await staff.patch(`/payload-api/site-pages/${story.id}`,{data:{_status:'draft'}}));const hidden=await publicHTML('/story');assert.ok(!hidden.html.includes('data-testid="w07-story"'));const hiddenDocs=await json(await anon.get('/payload-api/site-pages?where[route][equals]=%2Fstory'));assert.equal(hiddenDocs.docs.length,0);checks.push('Unpublish removes anonymous content instead of resurrecting hardcoded copy');
 await json(await staff.patch(`/payload-api/site-pages/${story.id}`,{data:{_status:'published'}}));
 const file=list.docs.find(x=>x.route==='/').sections.flatMap(x=>x.content).find(x=>x.blockType==='image').image;
 const deletion=await staff.delete(`/payload-api/media/${file.id}`);assert.ok([403,409].includes(deletion.status()));checks.push('Referenced media cannot be deleted');
 const user=fixtures.find(x=>x.role==='user');const caller=await request.newContext({baseURL:base,extraHTTPHeaders:{Origin:base}});await json(await caller.post('/payload-api/auth/sign-in/email',{data:{email:user.email,password:user.password}}));const denied=await caller.patch(`/payload-api/site-pages/${home.id}`,{data:{title:'Unauthorized'}});assert.equal(denied.status(),403);await caller.dispose();checks.push('An ordinary Caller cannot edit website content');
 const bad=await staff.post('/payload-api/site-pages',{data:{title:'Unsafe embed',route:'/test-invalid-embed',sections:[{sectionKey:'video',label:'Video',content:[{blockType:'iframe',title:'Unsafe',url:'javascript:alert(1)',aspect:'16:9'}]}]}});assert.ok([400,422].includes(bad.status()));checks.push('Unsafe iframe URLs are rejected server-side');
 const sitemap=await publicHTML('/sitemap.xml');assert.equal(sitemap.response.status,200);assert.ok(sitemap.html.includes('/story'));assert.ok(!sitemap.html.includes('/site-chrome'));checks.push('Sitemap contains published public pages only');
 writeFileSync('/tmp/editor-evidence/api-smoke.json',JSON.stringify({checks,storage:'Mock Bunny transport; real Payload/Postgres/Next.js'},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
} finally {await staff.dispose();await anon.dispose();}
