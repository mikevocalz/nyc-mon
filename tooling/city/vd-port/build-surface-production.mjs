// Complete offline generation; no tests, device actions or acceptance checks.
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{createWriteStream}from'node:fs';
import{gunzipSync,gzipSync}from'node:zlib';
import{spawn}from'node:child_process';
import{join}from'node:path';
import{homedir}from'node:os';
import{SURFACE_WORKSPACE,SURFACE_CAPTURE,SURFACE_BAKE_DEPS,SURFACE_SPOOL,SURFACE_PAYLOADS}from'./surface-paths.mjs';
await mkdir(SURFACE_WORKSPACE,{recursive:true});
const statusPath=join(SURFACE_WORKSPACE,'production-status.json');
const status={complete:false,started:new Date().toISOString(),stage:'awaiting-settled-source-capture'};
const record=async stage=>{status.stage=stage;status.updated=new Date().toISOString();await writeFile(statusPath,JSON.stringify(status,null,2));console.log(JSON.stringify(status));};
async function run(name,args=[]){
 await record(name);
 const log=createWriteStream(join(SURFACE_WORKSPACE,`${name}.log`),{flags:'a'});
 try{await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[`tooling/city/vd-port/${name}.mjs`,...args],{env:{...process.env,VD_BAKE_DEPS:SURFACE_BAKE_DEPS},stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(new Error(`${name} exited ${code??signal}`)));
 });}finally{await new Promise(resolve=>log.end(resolve));}
}
try{
 await record(status.stage);
 if(process.argv.includes('--capture')){
  await run('restore-surface-bake-deps');
  await run('material-census',['--geometry-provenance','--payload-dir',SURFACE_PAYLOADS,'--payload-gzip','--out',SURFACE_CAPTURE]);
 }
 for(;;){
  let capture;try{capture=JSON.parse(gunzipSync(await readFile(SURFACE_CAPTURE)));}catch{}
  if(capture?.complete){if(capture.missingStructures.length||!capture.geometryProvenance?.complete)throw new Error('Full source provenance is incomplete');break;}
  await new Promise(resolve=>setTimeout(resolve,10_000));
 }
 const capture=JSON.parse(gunzipSync(await readFile(SURFACE_CAPTURE))),dependencies=JSON.parse(await readFile(join(SURFACE_BAKE_DEPS,'provenance.json'),'utf8'));
 const sourceLock=JSON.parse(await readFile(join(process.env.VD_VALDRADA??join(homedir(),'src/valdrada'),'client/package-lock.json'),'utf8'));
 for(const dependency of dependencies){
  const installed=JSON.parse(await readFile(join(SURFACE_BAKE_DEPS,dependency.name,'package.json'),'utf8'));
  const pin=sourceLock.packages[`node_modules/${dependency.name}`];
  if(installed.version!==pin.version||dependency.version!==pin.version||dependency.integrity!==pin.integrity)throw new Error('Offline dependency provenance differs from pinned source lock');
 }
 capture.bakeEarcut=dependencies.find(dependency=>dependency.name==='earcut').version;capture.bakeDependencies=dependencies;
 await writeFile(SURFACE_CAPTURE,gzipSync(JSON.stringify(capture)));
 await run('surface-dependencies');
 await run('pbr-footprint');
 await run('build-surface-production-bank');
 await run('build-surface-production-registry');
 await run('material-census',['--surface-stream-dir',SURFACE_SPOOL,'--stream-batch-triangles','8000','--out',join(SURFACE_WORKSPACE,'source-stream-capture.json.gz')]);
 // All semantic source code is included in the final immutable registry before
 // its identity is embedded into any finished VDN3 package.
 await run('build-surface-production-registry');
 await run('write-surface-stream');
 status.complete=true;await record('generation-complete');
}catch(error){status.error=String(error);await record('generation-blocked');throw error;}
