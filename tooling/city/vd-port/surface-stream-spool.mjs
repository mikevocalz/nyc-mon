import{readFile,mkdir,appendFile,writeFile,statfs,truncate,readdir,rename}from'node:fs/promises';
import{gunzipSync,gzipSync}from'node:zlib';
import{createHash}from'node:crypto';
import{join}from'node:path';
import{existsSync}from'node:fs';
import{canonicalSurfaceJSON}from'./surface-registry.mjs';
import{AFFINE}from'./write.mjs';
import{authoredSurfaceUniforms}from'./surface-uniforms.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function sourceMaterialFacts(material,textures){
 const texture=id=>{const value=textures.get(id);if(!value)throw new Error('Uncaptured original sampler');const{uuid,name,source,kind,pixelHash,alphaMin,alphaMax,...facts}=value;return facts;};
 const uniform=value=>{
  if(Array.isArray(value))return value.map(uniform);
  if(value&&typeof value==='object'){
   if(value.dynamic)return{dynamic:value.dynamic};
   if(value.texture)return{texture:texture(value.texture)};
   return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,uniform(child)]));
  }return value;
 };
 return canonicalSurfaceJSON({key:material.key,shaderSha256:material.shader.sha256,uniforms:uniform(authoredSurfaceUniforms(material)),
  properties:Object.fromEntries(Object.keys(material).filter(key=>!['uuid','shader','maps','key','userData'].includes(key)).sort().map(key=>[key,material[key]])),
  maps:Object.fromEntries(Object.entries(material.maps).map(([role,id])=>[role,id?texture(id):null]))});
}
/** Static authored uniforms and complete sampler state are part of bake parity; live scene uniforms remain scene-owned. */
export function verifySurfaceStreamMaterials(capture,stream){
 if(!stream.complete||stream.missingStructures.length||stream.sourcePin!==capture.sourcePin||stream.bakeThree!==capture.bakeThree||stream.bakeEarcut!==capture.bakeEarcut)throw new Error('Source stream provenance changed');
 const actual=new Map(stream.tiles.map(tile=>[tile.key,tile]));let materials=0;
 for(const tile of capture.tiles){const other=actual.get(tile.key);if(!other||other.materials.length!==tile.materials.length)throw new Error('Source stream material inventory changed');
  const before=new Map(tile.textures.map(texture=>[texture.uuid,texture])),after=new Map(other.textures.map(texture=>[texture.uuid,texture]));
  for(let index=0;index<tile.materials.length;index++){if(sourceMaterialFacts(tile.materials[index],before)!==sourceMaterialFacts(other.materials[index],after))throw new Error(`Source stream authored material/sampler changed ${tile.key}:${index}`);materials++;}
 }
 return{materials,tiles:capture.tiles.length,policy:'Exact static source uniforms/properties/pixel identities/mip/sampler/UV matrix facts; dynamic scene-owned initial audit values excluded'};
}
/** Verify exact ordered Float64 triangle provenance before declaring any spool complete. */
export async function createSurfaceStreamSpool(capturePath,outDir){
 const bytes=await readFile(capturePath),capture=JSON.parse(capturePath.endsWith('.gz')?gunzipSync(bytes):bytes);
 const roots=new Map(),tiles=new Map(capture.tiles.map(tile=>[tile.key,tile])),cells=new Map();let active;
 for(const tile of capture.tiles)for(const audit of tile.geometryAudits)roots.set(audit.id,{tile,audit,hash:createHash('sha256'),triangles:0,
  variants:new Map(audit.variants.map((variant,index)=>[canonicalSurfaceJSON({fields:variant.fields,frame:variant.frame}),index])),materials:new Map(audit.materials.map(material=>[material.index,material.sha256]))});
 await mkdir(outDir,{recursive:true});
 const manifestPath=join(outDir,'manifest.json');
 const report=existsSync(manifestPath)?JSON.parse(await readFile(manifestPath,'utf8')):{complete:false,sourcePin:capture.sourcePin,structures:[],cells:[]};
 if(report.sourcePin!==capture.sourcePin)throw new Error('Spool source pin changed');
 for(const cell of report.cells){
  const path=join(outDir,cell.file),bytes=await readFile(path),prefix=bytes.subarray(0,cell.fileBytes);
  if(bytes.length<cell.fileBytes)throw new Error('Prior spool is truncated');
  if(cell.chunks){let offset=0;for(const chunk of cell.chunks){if(sha(prefix.subarray(offset,offset+chunk.bytes))!==chunk.sha256)throw new Error('Prior spool chunk integrity failure');offset+=chunk.bytes;}if(offset!==cell.fileBytes)throw new Error('Prior spool chunk accounting failure');}
  else if(!cell.sha256||sha(prefix)!==cell.sha256)throw new Error('Prior spool integrity failure');
  // A failed/interrupted root never commits its append tail. Only authenticated
  // preceding chunks survive recovery; that root will be recaptured in full.
  if(bytes.length>cell.fileBytes)await truncate(path,cell.fileBytes);
  cells.set(cell.key,cell);
 }
 for(const file of await readdir(outDir))if(/^-?\d+_-?\d+\.jsonl\.gz$/.test(file)&&!report.cells.some(cell=>cell.file===file))await truncate(join(outDir,file),0);
 for(const structure of report.structures){const root=roots.get(structure.id);if(!root||root.audit.sha256!==structure.sha256||root.audit.triangles!==structure.triangles)throw new Error('Prior source parity record changed');}
 const completed=new Set(report.structures.map(structure=>structure.id));
 const save=async()=>{report.cells=[...cells.values()];await writeFile(`${manifestPath}.next`,JSON.stringify(report));await rename(`${manifestPath}.next`,manifestPath);};
 const signature=sourceMaterialFacts;
 return{
  async begin(key,materials,textures){
   const expected=tiles.get(key);if(!expected||materials.length!==expected.materials.length)throw new Error('Stream source material inventory changed');
   const actualTextures=new Map(textures.map(texture=>[texture.uuid,texture])),priorTextures=new Map(expected.textures.map(texture=>[texture.uuid,texture]));
   for(let index=0;index<materials.length;index++)if(signature(materials[index],actualTextures)!==signature(expected.materials[index],priorTextures)){
    await writeFile(join(outDir,'material-change.json'),JSON.stringify({tile:key,index,actual:JSON.parse(signature(materials[index],actualTextures)),expected:JSON.parse(signature(expected.materials[index],priorTextures))},null,2));
    throw new Error(`Stream source material changed ${key}:${index}`);
   }
   active=key;return [...completed];
  },
  async batch(batch){
   const root=roots.get(batch.id);if(!root||root.tile.key!==active)throw new Error('Unexpected streamed structure');
   if(batch.vertices.length>8192*3||batch.vertices.length%3)throw new Error('Unbounded source stream batch');
   const variants=batch.variants.map(variant=>{const row=root.variants.get(canonicalSurfaceJSON(variant));if(row===undefined)throw new Error('Source constant variant/frame changed');return row;});
   const buckets=new Map(),raw=Buffer.alloc(3*24*8);let offset;
   for(let at=0;at<batch.vertices.length;at+=3){
    const triangle=batch.vertices.slice(at,at+3),material=root.materials.get(triangle[0].material),row=variants[triangle[0].variant];
    if(!material)throw new Error('Source triangle material changed');root.hash.update(Buffer.from(material,'hex'));root.hash.update(Buffer.from(root.audit.variants[row].sha256,'hex'));offset=0;
    for(const vertex of triangle){
     const values=[...vertex.position,...vertex.color,...vertex.uv,...vertex.normal,vertex.grime,...vertex.weather,vertex.flags,vertex.renderOrder,Number(vertex.castShadow),Number(vertex.receiveShadow),Number(vertex.sourceCastShadow),Number(vertex.sourceReceiveShadow),Number(vertex.castOwner==='authored-source'),Number(vertex.receiveOwner==='authored-source')];
     if(values.length!==24||!values.every(Number.isFinite))throw new Error('Invalid original stream channel');for(const value of values){raw.writeDoubleLE(value,offset);offset+=8;}
     vertex.variant=variants[vertex.variant];
    }
    root.hash.update(raw);root.triangles++;
    const cx=Math.floor(triangle.reduce((sum,v)=>sum+v.position[0]*AFFINE.sx+AFFINE.ox,0)/3/128),cz=Math.floor(triangle.reduce((sum,v)=>sum+v.position[2]*AFFINE.sz+AFFINE.oz,0)/3/128),key=`${cx}_${cz}`;
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(...triangle);
   }
   const free=await statfs(outDir);if(free.bavail*free.bsize<32*2**20)throw new Error('Production spool paused: less than32MiB disk headroom');
   for(const[key,vertices]of buckets){
    const bytes=gzipSync(JSON.stringify({tile:active,id:batch.id,vertices})+'\n');await appendFile(join(outDir,`${key}.jsonl.gz`),bytes);
    const cell=cells.get(key)??{key,file:`${key}.jsonl.gz`,triangles:0,fileBytes:0,chunks:[]};
    if(!cell.chunks)cell.chunks=[{bytes:cell.fileBytes,sha256:cell.sha256}];
    cell.chunks.push({bytes:bytes.length,sha256:sha(bytes)});delete cell.sha256;
    cell.triangles+=vertices.length/3;cell.fileBytes+=bytes.length;cells.set(key,cell);
   }
  },
  async finish(id,diagnostics){
   const root=roots.get(id),digest=root.hash.digest('hex');
   if(root.triangles!==root.audit.triangles||digest!==root.audit.sha256)throw new Error(`Source geometry parity failed ${id}: ${root.triangles}/${root.audit.triangles} ${digest}/${root.audit.sha256}`);
   if(diagnostics.omittedZeroAreaTriangles!==root.audit.omittedZeroAreaTriangles||diagnostics.normalRepairs.length!==root.audit.normalRepairs.length)throw new Error('Source cleanup audit changed');
   report.structures.push({id,triangles:root.triangles,sha256:digest,...diagnostics});completed.add(id);await save();
  },
  async complete(){report.complete=report.structures.length===roots.size;for(const cell of cells.values()){cell.sha256=sha(await readFile(join(outDir,cell.file)));}await save();return report;},
 };
}
