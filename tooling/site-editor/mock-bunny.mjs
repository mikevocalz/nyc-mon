// Network double for automated integration tests, never loaded by application code.
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
const db = new URL(process.env.DATABASE_URL ?? '');
if (process.env.SITE_EDITOR_INTEGRATION !== '1' || !['localhost','127.0.0.1'].includes(db.hostname) || !db.pathname.startsWith('/site_editor_') || process.env.BUNNY_STORAGE_ZONE !== 'isolated-ci-no-upload') throw new Error('Mock storage is restricted to isolated local integration tests');
const root='/tmp/editor-bunny';await mkdir(root,{recursive:true});const originalFetch=globalThis.fetch;
globalThis.fetch=async (input,init) => {
 const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
 if(url.hostname!=='storage.bunnycdn.com'&&url.hostname!=='media.invalid')return originalFetch(input,init);
 const key=decodeURIComponent(url.pathname.replace(/^\/isolated-ci-no-upload\//,'/')).replace(/^\//,'');
 if(!key||key.includes('..')||key.includes('\\'))throw Error('Unsafe test object key');
 const file=path.join(root,key); const method=init?.method??(input instanceof Request?input.method:'GET');
 if(method==='PUT'){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,Buffer.from(await new Response(init?.body??(input instanceof Request?input.body:null)).arrayBuffer()));return new Response('{}',{status:201});}
 if(method==='DELETE'){await unlink(file).catch(()=>{});return new Response(null,{status:204});}
 try{return new Response(await readFile(file),{status:200});}catch{return new Response(null,{status:404});}
};
