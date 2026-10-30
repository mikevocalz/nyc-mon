/** Test-only object transport. Never import this module in an application entry point. */
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const database=new URL(process.env.DATABASE_URL??'');
if(process.env.SITE_EDITOR_TEST_CONFIRM!=='disposable'||!['','localhost','127.0.0.1'].includes(database.hostname)||!/(?:test|clean)/.test(database.pathname)) throw new Error('Mock storage is only available in an explicitly disposable local test database.');
const root=process.env.SITE_EDITOR_TEST_OBJECT_DIR??'/tmp/nycmon-cms-test-objects';await mkdir(root,{recursive:true});
process.env.BUNNY_STORAGE_ZONE='cms-integration-test';process.env.BUNNY_STORAGE_PASSWORD='not-a-real-storage-key';process.env.BUNNY_CDN_URL='https://cdn.example.test';
const original=globalThis.fetch;
globalThis.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(url.hostname.endsWith('storage.bunnycdn.com')){
   if(url.hostname!=='storage.bunnycdn.com'||!url.pathname.startsWith('/cms-integration-test/')||options.method!=='PUT') throw new Error('Unexpected object-storage request in local acceptance test.');
   const name=decodeURIComponent(url.pathname.split('/').at(-1));
   if(!name||path.basename(name)!==name) throw new Error('Invalid test object name');
   await writeFile(path.join(root,name),Buffer.from(options.body));
   return new Response('',{status:201});
 }
 return original(input,options);
};
