import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { request } from 'playwright';
const staff=await request.newContext({baseURL:'http://localhost:3001',storageState:'/tmp/editor-evidence/admin-state.json',extraHTTPHeaders:{Origin:'http://localhost:3001'}});
async function ok(response){const data=await response.json();assert.ok(response.ok(),`${response.status()} ${JSON.stringify(data).slice(0,400)}`);return data;}
const checks=[];
try{
 const original=await ok(await staff.get('/payload-api/site-pages/1?draft=false&depth=1'));
 const versions=await ok(await staff.get('/payload-api/site-pages/versions?where[parent][equals]=1&sort=-updatedAt&limit=1'));
 const savedVersion=versions.docs[0].id;
 const media=await ok(await staff.get('/payload-api/media?limit=100&depth=0'));
 const replacement=media.docs.find(x=>x.alt==='Integration drag-and-drop photo');assert.ok(replacement);
 const sections=structuredClone(original.sections);const hero=sections.find(s=>s.sectionKey==='hero');const image=hero.content.find(b=>b.blockType==='image');const oldImage=image.image.id;image.image=replacement.id;
 sections.push({sectionKey:'media-test',label:'Media verification',copy:[],content:[{blockType:'gallery',images:[{image:replacement.id,caption:'First gallery image'},{image:oldImage,caption:'Second gallery image'}]},{blockType:'youtube',title:'Integration video',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',aspect:'16:9'}]});
 await ok(await staff.patch('/payload-api/site-pages/1',{data:{sections,_status:'published'}}));
 const html=await(await fetch('http://localhost:3000/')).text();assert.ok(html.includes(replacement.filename));assert.ok(html.indexOf('First gallery image')<html.indexOf('Second gallery image'));assert.ok(html.includes('www.youtube-nocookie.com/embed/dQw4w9WgXcQ'));checks.push('Image relationship replacement, gallery order and YouTube render on the public site');
 const usage=await ok(await staff.get(`/payload-api/media/${replacement.id}`));assert.ok(usage.websiteUsage.includes('Home'));assert.ok(usage.websiteUsage.includes('Hero'));checks.push('Media usage resolves the actual page and named section');
 await ok(await staff.post(`/payload-api/site-pages/versions/${savedVersion}`,{data:{}}));
 const restored=await ok(await staff.get('/payload-api/site-pages/1?draft=false&depth=1'));assert.equal(restored.sections.find(s=>s.sectionKey==='hero').content.find(b=>b.blockType==='image').image.id,oldImage);checks.push('Restoring a saved revision restores the original image relationship');
 const blocked=await staff.patch(`/payload-api/media/${oldImage}`,{multipart:{_payload:JSON.stringify({alt:'Overwrite forbidden'}),file:{name:'replacement.webp',mimeType:'image/webp',buffer:readFileSync('packages/assets/photos/harlem-apollo.webp')}}});assert.equal(blocked.status(),409);checks.push('An overwrite of bytes referenced by saved revisions is rejected');
 const restoredHTML=await(await fetch('http://localhost:3000/')).text();assert.ok(!restoredHTML.includes('First gallery image'));checks.push('Revision restore updates the public website without old gallery content');
 writeFileSync('/tmp/editor-evidence/versions-smoke.json',JSON.stringify({checks},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
}finally{await staff.dispose();}
