// Bounded, resumable source bank. One original image is verified/packed at a time.
import{readFile,writeFile,mkdir,link,rename}from'node:fs/promises';
import{existsSync}from'node:fs';
import{join}from'node:path';
import{createHash}from'node:crypto';
import{gzipSync,gunzipSync}from'node:zlib';
import{loadSurfaceBasis,transcodeSurfaceKtx}from'./transcode-surface-ktx.mjs';
import{packSurfaceTextures}from'./pack-surface-textures.mjs';
import{canonicalSurfaceJSON}from'./surface-registry.mjs';
import{SURFACE_CAPTURE,SURFACE_BANK,SURFACE_PAYLOADS,SURFACE_PBR_FOOTPRINT,SURFACE_PILOT_BANK}from'./surface-paths.mjs';
const[capturePath=SURFACE_CAPTURE,output=SURFACE_BANK,payloadDir=SURFACE_PAYLOADS]=process.argv.slice(2);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=async path=>JSON.parse(path.endsWith('.gz')?gunzipSync(await readFile(path)):await readFile(path,'utf8'));
const capture=await readJson(capturePath),verified=await readJson(SURFACE_PBR_FOOTPRINT);
const old=await readJson(join(SURFACE_PILOT_BANK,'manifest.json'));
await mkdir(output,{recursive:true});
const manifest={version:1,complete:false,pages:[],textures:[],gpuBytes:0,requiredFeatures:['texture-compression-astc'],cityAORect:old.cityAORect,
 provenance:{sourcePin:capture.sourcePin,sourceRevision:verified.revision,policy:'Original dimensions/channels/mips/samplers; original Basis ASTC4x4 PBR; lossless gzip disk storage only'},missing:[]};
const writeManifest=async()=>{const path=join(output,'manifest.json');await writeFile(`${path}.next`,JSON.stringify(manifest));await rename(`${path}.next`,path);};
const signatures=new Map();
async function pack(texture,payload){
 const signature=canonicalSurfaceJSON({...texture,uuid:undefined,source:undefined,name:undefined});
 if(signatures.has(signature)){manifest.textures.push({...texture,page:signatures.get(signature),layer:0});await writeManifest();return;}
 const offset=manifest.pages.length;
 const packed=await packSurfaceTextures([texture],{maxPageBytes:64*2**20,maxLayers:1,readPayload:()=>payload,writePage:async(page,bytes)=>{
  const stored=gzipSync(bytes),storedSha=sha(stored),file=`${storedSha}.bin`,target=join(output,file),cached=join(payloadDir,`${page.sha256}.bin.gz`);
  if(!existsSync(target)){
   if(existsSync(cached)&&sha(await readFile(cached))===storedSha)await link(cached,target);
   else{await writeFile(`${target}.next`,stored);await rename(`${target}.next`,target);}
  }
  const actual=await readFile(target);if(actual.length!==stored.length||sha(actual)!==storedSha)throw new Error('Existing generated page integrity failure');
  page.storage={encoding:'gzip',sha256:storedSha,fileBytes:stored.byteLength,file};
 }});
 for(const page of packed.pages)manifest.pages.push({...page,id:page.id+offset});
 for(const item of packed.textures)manifest.textures.push({...item,page:item.page+offset});
 manifest.gpuBytes+=packed.gpuBytes;signatures.set(signature,offset);await writeManifest();
}
const captured=new Map();
for(const tile of capture.tiles){
 const used=new Set();
 for(const material of tile.materials){
  for(const uuid of Object.values(material.maps))if(uuid)used.add(uuid);
  for(const[name,value]of Object.entries(material.shader.uniforms??{})){
   if(value?.dynamic||material.pbr?.set&&['pbAlb','pbNrm','pbOrm'].includes(name))continue;
   const uuid=value?.texture??value?.initial?.texture;if(uuid)used.add(uuid);
  }
 }
 for(const texture of tile.textures)if(used.has(texture.uuid)){
  const{uuid,name,source,...props}=texture;
  const key=canonicalSurfaceJSON(props);if(!captured.has(key))captured.set(key,{...props,uuid:`captured:${texture.sha256}:${sha(key).slice(0,16)}`});
 }
}
for(const texture of captured.values()){
 const raw=join(payloadDir,`${texture.sha256}.bin`),gz=`${raw}.gz`;
 if(!existsSync(raw)&&!existsSync(gz)){manifest.missing.push({uuid:texture.uuid,sha256:texture.sha256,sourceBytes:texture.sourceBytes});continue;}
 const bytes=existsSync(gz)?gunzipSync(await readFile(gz)):await readFile(raw);await pack(texture,bytes);
}
const ao=old.textures.find(t=>t.uuid==='env:cityAO');
if(!ao)throw new Error('Missing verified original cityAO page');
const aoPage=old.pages.find(page=>page.id===ao.page),aoBytes=await readFile(join(SURFACE_PILOT_BANK,`${aoPage.sha256}.bin`));
if(sha(aoBytes)!==ao.sha256)throw new Error('CityAO payload identity failure');await pack(ao,aoBytes);
const{basis,provenance}=await loadSurfaceBasis();manifest.provenance.basis=provenance;
for(const record of verified.files){
 const path=join('tooling/city/.cache/vd-pbr',record.set,`${record.role}.ktx2`);
 let bytes;if(existsSync(path))bytes=await readFile(path);else{
  const response=await fetch(`https://huggingface.co/datasets/mehmetkeremturkcan/valdrada/resolve/${verified.revision}/${record.path}`);
  if(!response.ok)throw new Error(`Pinned PBR ${record.set}/${record.role} HTTP${response.status}`);bytes=Buffer.from(await response.arrayBuffer());
 }
 const result=transcodeSurfaceKtx(bytes,{basis,sourceSha256:record.sha256,set:record.set,role:record.role});await pack(result.texture,result.payload);
 console.log(JSON.stringify({set:record.set,role:record.role,pages:manifest.pages.length,gpuBytes:manifest.gpuBytes}));
}
manifest.complete=manifest.missing.length===0;await writeManifest();
console.log(JSON.stringify({output,complete:manifest.complete,pages:manifest.pages.length,references:manifest.textures.length,gpuBytes:manifest.gpuBytes,storedBytes:manifest.pages.reduce((n,p)=>n+p.storage.fileBytes,0),missing:manifest.missing.length}));
