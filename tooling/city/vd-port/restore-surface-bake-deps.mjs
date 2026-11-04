// Isolated offline tools only; application manifests and node_modules are untouched.
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{existsSync}from'node:fs';
import{createHash}from'node:crypto';
import{execFileSync}from'node:child_process';
import{join}from'node:path';
import{homedir}from'node:os';
import{SURFACE_BAKE_DEPS}from'./surface-paths.mjs';
const source=process.argv[2]??join(homedir(),'src/valdrada');
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!=='2724c7938f20e068748ad1fd66e907d2bc662e3e'||execFileSync('git',['-C',source,'status','--porcelain'],{encoding:'utf8'}).trim())throw new Error('Expected clean pinned Valdrada source checkout');
const lock=JSON.parse(await readFile(join(source,'client/package-lock.json'),'utf8')),records=[];
await mkdir(SURFACE_BAKE_DEPS,{recursive:true});
for(const[name,version]of[['three','0.185.1'],['earcut','3.2.3']]){
 const pin=lock.packages[`node_modules/${name}`];if(pin.version!==version||!pin.integrity.startsWith('sha512-'))throw new Error('Unexpected source dependency pin');
 const archive=join(SURFACE_BAKE_DEPS,`${name}-${version}.tgz`);let bytes;
 if(existsSync(archive))bytes=await readFile(archive);else{const response=await fetch(pin.resolved);if(!response.ok)throw new Error(`Pinned package HTTP${response.status}`);bytes=Buffer.from(await response.arrayBuffer());}
 if(`sha512-${createHash('sha512').update(bytes).digest('base64')}`!==pin.integrity)throw new Error('Pinned bake dependency integrity mismatch');
 await writeFile(archive,bytes);const target=join(SURFACE_BAKE_DEPS,name);
 if(existsSync(join(target,'package.json'))&&JSON.parse(await readFile(join(target,'package.json'),'utf8')).version!==version)throw new Error('Archive historical bake dependency before replacing it');
 await mkdir(target,{recursive:true});execFileSync('tar',['-xzf',archive,'--strip-components=1','-C',target]);
 records.push({name,version,url:pin.resolved,integrity:pin.integrity,sha256:createHash('sha256').update(bytes).digest('hex'),reason:'Exact pinned source lock; isolated offline dependency'});
}
await writeFile(join(SURFACE_BAKE_DEPS,'provenance.json'),JSON.stringify(records,null,2));console.log(JSON.stringify(records));
