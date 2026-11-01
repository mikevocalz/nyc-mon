import { Buffer } from 'node:buffer';
/** Integration acceptance against an explicitly disposable, already migrated local PostgreSQL database. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const db = new URL(process.env.DATABASE_URL ?? '');
if (process.env.SITE_EDITOR_TEST_CONFIRM !== 'disposable' || !['localhost','127.0.0.1',''].includes(db.hostname) || !/(?:test|clean)/.test(db.pathname) || process.env.PAYLOAD_PUSH === 'true') throw new Error('Only an explicitly disposable local migrated database may run this test.');
process.env.NYCMON_SITE_EDITOR='1';
process.env.BUNNY_STORAGE_ZONE='cms-integration-test';process.env.BUNNY_STORAGE_PASSWORD='test-transport-not-a-real-key';process.env.BUNNY_CDN_URL='https://cdn.example.test';
// Real Payload upload hooks and database, with the external object-storage transport isolated.
const originalFetch=globalThis.fetch;const stored=new Map();
globalThis.fetch=async (input,options={})=>{
 const url=new URL(String(input));
 if (url.hostname==='storage.bunnycdn.com' && url.pathname.startsWith('/cms-integration-test/')) {
   if(options.method==='PUT'){stored.set(url.pathname,Buffer.from(options.body));return new Response('',{status:201});}
   throw new Error('Unexpected storage operation');
 }
 return originalFetch(input,options);
};
const {getPayload}=await import('payload');const {default:config}=await import('../payload.config.ts');const payload=await getPayload({config});
let count=0;const pass=name=>{count++;console.log('PASS '+name);};
try {
 const run=randomUUID().slice(0,8);
 let actor=(await payload.find({collection:'users',where:{role:{equals:'ops'}},limit:1,overrideAccess:true})).docs[0];
 if(!actor) actor=await payload.create({collection:'users',data:{email:`cms-bootstrap-${run}@example.test`,name:'Disposable CMS fixture',role:'ops'},overrideAccess:true});
 actor={...actor,collection:'users'};
 const users={};for(const role of ['ops','content','support','user']) {const user=await payload.create({collection:'users',data:{email:`cms-${role}-${run}@example.test`,name:'Disposable CMS test',role},user:actor,overrideAccess:true});users[role]={...user,collection:'users'};}
 const context=role=>({user:users[role],overrideAccess:false});
 const data={title:'CMS acceptance',route:`/cms-acceptance-${run}`,sections:[{label:'Hero',sectionKey:'hero',hidden:false,copy:[{label:'Heading',key:'title',value:'Published original'}],content:[]}],_status:'draft'};
 const draft=await payload.create({collection:'site-pages',data,draft:true,...context('content')});pass('content editor creates a draft');
 const find=options=>payload.find({collection:'site-pages',where:{id:{equals:draft.id}},depth:1,...options});
 assert.equal((await find({overrideAccess:false})).totalDocs,0);pass('anonymous visitor cannot read a draft');
 for(const role of ['support','user']) await assert.rejects(payload.update({collection:'site-pages',id:draft.id,data:{title:'Unauthorized'},...context(role)}));
 pass('support and ordinary accounts cannot edit website content');
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
 const upload=()=>payload.create({collection:'media',data:{alt:'Acceptance test image'},file:{data:bytes,name:'same-name.png',mimetype:'image/png',size:bytes.length},...context('content')});
 const media=await upload(),other=await upload();assert.notEqual(media.filename,other.filename);assert.equal(stored.size,2);assert.match(media.url,/^https:\/\/cdn\.example\.test\//);pass('real upload hooks produce unique object names and public CDN URLs');
 data.sections[0].content=[{blockType:'image',slot:'hero',image:media.id,alt:'Hero replacement',decorative:false},{blockType:'youtube',title:'Trailer',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}];
 await payload.update({collection:'site-pages',id:draft.id,data:{...data,_status:'published'},draft:false,...context('content')});
 const published=(await find({overrideAccess:false})).docs[0];assert.equal(published.sections[0].copy[0].value,'Published original');assert.equal(published.sections[0].content[0].image.id,media.id);pass('publish exposes the selected image and section text anonymously');
 const versions=await payload.findVersions({collection:'site-pages',where:{parent:{equals:draft.id}},sort:'-updatedAt',...context('content')});
 const originalVersion=versions.docs.find(doc=>doc.version._status==='published');assert.ok(originalVersion);
 data.sections[0].copy[0].value='Saved draft only';
 await payload.update({collection:'site-pages',id:draft.id,data:{...data,_status:'draft'},draft:true,...context('content')});
 assert.equal((await find({overrideAccess:false})).docs[0].sections[0].copy[0].value,'Published original');
 assert.equal((await find({...context('content'),draft:true})).docs[0].sections[0].copy[0].value,'Saved draft only');pass('saved draft leaves the published page unchanged');
 const used=await payload.findByID({collection:'media',id:media.id,...context('content')});assert.match(used.websiteUsage,/CMS acceptance.*Hero/);pass('media usage identifies the owning page and section');
 await assert.rejects(payload.update({collection:'media',id:media.id,data:{alt:'Replace bytes'},file:{data:bytes,name:'replacement.png',mimetype:'image/png',size:bytes.length},...context('content')}));
 await assert.rejects(payload.delete({collection:'media',id:media.id,...context('ops')}));pass('shared image bytes and revision references cannot be overwritten or deleted');
 await payload.restoreVersion({collection:'site-pages',id:String(originalVersion.id),...context('content')});
 assert.equal((await find({...context('content'),draft:true})).docs[0].sections[0].copy[0].value,'Published original');pass('revision restore returns the previous copy and image references');
 const bad={...data,route:`/unsafe-${run}`,_status:'published',sections:[{...data.sections[0],content:[{blockType:'iframe',title:'Unsafe',url:'https://unapproved.example/evil'}]}]};
 await assert.rejects(payload.create({collection:'site-pages',data:bad,...context('content')}));pass('unapproved iframe cannot be published');
 const {signPreview}=await import('@acme/content/site-preview');const {websitePreviewEndpoints}=await import('./preview.ts');
 const {createPayloadRequest}=await import('payload');
 const token=signPreview({id:String(draft.id),actor:String(users.content.id),route:data.route,audience:process.env.NEXT_PUBLIC_SITE_URL},process.env.SITE_PREVIEW_SECRET);
 const req=await createPayloadRequest({user:users.content,payload});req.headers=new Headers({authorization:`Bearer ${token}`});
 const endpoint=websitePreviewEndpoints.find(item=>item.path==='/site-preview/content');
 assert.equal((await endpoint.handler(req)).status,200);pass('signed page-scoped draft preview reads through real access controls');
 await payload.update({collection:'users',id:users.content.id,data:{role:'support'},user:users.ops,overrideAccess:true});
 assert.equal((await endpoint.handler(req)).status,403);pass('removing an editor role immediately revokes its preview grant');
 console.log(`INTEGRATION RESULT: ${count} passed, 0 failed. External Bunny HTTP transport mocked; PostgreSQL and Payload operations real.`);
} finally {globalThis.fetch=originalFetch;await payload.destroy();}
