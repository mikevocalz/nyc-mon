import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {canonicalSurfaceJSON} from './surface-registry.mjs';
import {surfaceBankBindings} from './surface-bank-bindings.mjs';
import {classifySurfaceFamily,identifySurfaceFamily,SURFACE_FIXED_STATE} from './surface-families.mjs';
import {buildSurfaceParameters} from './surface-parameters.mjs';
import {SURFACE_CAPTURE,SURFACE_BANK,SURFACE_WORKSPACE}from'./surface-paths.mjs';
import {join}from'node:path';

/** Metadata only. Missing pages remain gaps; no synthetic layers, geometry or pixels are emitted. */
export function auditSurfaceGrouping(capture,bank){
 const resolver=surfaceBankBindings(capture,bank),families=[],materials=[],variants=[],frames=[];
 const familyKeys=new Map(),gaps=new Map(),programs=new Map(),sourceToReady=new Map();
 const failures=[],uvErrors=[],drawUses=new Map(),counts={sourceDescriptors:0,drawUses:0,readyDrawUses:0,sourceVariants:0};
 const addGap=(key,context)=>{if(!gaps.has(key))gaps.set(key,{key,uses:0,examples:[]});const item=gaps.get(key);item.uses++;if(item.examples.length<3)item.examples.push(context);};
 for(const tile of capture.tiles){
  const textures=new Map(tile.textures.map(texture=>[texture.uuid,texture]));
  const meshes=tile.meshes??[];
  const normalized=tile.materials.map((raw,index)=>{
   counts.sourceDescriptors++;
   const {uuid,key,shader,maps,...props}=raw,textureBindings={},missing=[];
   const bind=(role,uuid,uniform)=>{
    const original=textures.get(uuid);if(!original)throw new Error(`Missing source texture ${uuid}`);
    if(!Array.isArray(original.matrix)||original.matrix.length!==9||!original.matrix.every(Number.isFinite))uvErrors.push({tile:tile.key,material:index,role,error:'Invalid source UV matrix'});
    try{textureBindings[role]=resolver.resolveTextureBinding({material:raw,role:role.replace(/^uniform:/,''),uniform,initialBinding:original});}
    catch(error){textureBindings[role]=original;missing.push(role);const pbr={pbAlb:'albedo',pbNrm:'normal',pbOrm:'orm'}[role.replace(/^uniform:/,'')];
     const resource=pbr&&raw.pbr?.set?`pbr:${raw.pbr.set}:${pbr}`:uniform?.dynamic==='cityAO'?'env:cityAO':`captured:${original.sha256}`;
     addGap(resource,{tile:tile.key,material:index,role,error:String(error),...(resource.startsWith('captured:')?{payload:{sha256:original.sha256,width:original.width,height:original.height,format:original.format,type:original.type,sourceBytes:original.sourceBytes,mipLevels:original.mipLevels},sampler:Object.fromEntries(['colorSpace','wrapS','wrapT','flipY','premultiplyAlpha','unpackAlignment','minFilter','magFilter','anisotropy','generateMipmaps'].map(key=>[key,original[key]]))}:{semantic:resource})});}
   };
   for(const [role,uuid]of Object.entries(maps??{}))if(uuid)bind(role,uuid,null);
   for(const [name,value]of Object.entries(shader.uniforms??{})){const uuid=value?.texture??value?.initial?.texture;if(uuid)bind(`uniform:${name}`,uuid,value);}
   const descriptor={...props,source:{key,shaderHash:shader.hash,shaderSha256:shader.sha256,shaderHashBasis:shader.sha256Basis},shader,textureBindings,
    state:Object.fromEntries(SURFACE_FIXED_STATE.filter(name=>raw[name]!==undefined).map(name=>[name,raw[name]]))};
   try{const match=classifySurfaceFamily(descriptor);programs.set(match.name,(programs.get(match.name)??0)+1);}catch(error){failures.push({tile:tile.key,index,key,error:String(error)});}
   return{descriptor,missing,uuid};
  });
  for(let index=0;index<normalized.length;index++){
   const {descriptor,missing,uuid}=normalized[index];
   // These are actual mesh draw states, not constructor defaults. Preserve each distinct use.
   const uses=new Map(meshes.filter(mesh=>mesh.materials.includes(uuid)).map(mesh=>{
    const policy=mesh.shadowPolicy;
    const draw={renderOrder:mesh.renderOrder,castShadow:policy?.castShadow??mesh.castShadow,receiveShadow:policy?.receiveShadow??mesh.receiveShadow};
    return[canonicalSurfaceJSON(draw),draw];
   }));
   if(!uses.size){failures.push({tile:tile.key,index,error:'Descriptor has no captured mesh use'});continue;}
   const ready=[];
   for(const draw of uses.values()){
    counts.drawUses++;if(missing.length)continue;
    try{
     const classification=identifySurfaceFamily({...descriptor,...draw});
     const familyRecord={name:classification.name,staticFlags:classification.staticFlags,state:classification.renderState,supported:true};
     const key=canonicalSurfaceJSON(familyRecord);let family=familyKeys.get(key);
     if(family===undefined){family=families.length;familyKeys.set(key,family);families.push({...familyRecord,id:family});}
     const id=materials.length;materials.push({...descriptor,...draw,id,family});ready.push(id);counts.readyDrawUses++;
     drawUses.set(classification.name,(drawUses.get(classification.name)??0)+1);
    }catch(error){failures.push({tile:tile.key,index,error:String(error)});}
   }
   sourceToReady.set(`${tile.key}:${index}`,ready);
  }
  for(const audit of tile.geometryAudits??[])for(const variant of audit.variants){
   counts.sourceVariants++;
   const ready=variant.materials.flatMap(index=>sourceToReady.get(`${tile.key}:${index}`)??[]);
   if(!ready.length)continue;
   const frame=frames.length;frames.push({...variant.frame,...audit.sceneFrame});variants.push({fields:variant.fields,frame,materials:ready});
  }
 }
 let parameters,parameterError;
 try{parameters=buildSurfaceParameters({materials,families,variants,frames});}catch(error){parameterError=String(error);}
 return{scope:'HOST metadata-only exact runtime classifiers, original UV matrices and actual packed page identities; captured mesh material/state uses are conservative until per-triangle emission; unresolved resources excluded from ready subset, not substituted',
  complete:failures.length===0&&uvErrors.length===0&&gaps.size===0&&!parameterError,...counts,
  graphDescriptors:Object.fromEntries(programs),readyDrawUsesByGraph:Object.fromEntries(drawUses),readyFamilies:families.length,
  readyFamiliesByGraph:Object.fromEntries([...new Set(families.map(f=>f.name))].map(name=>[name,families.filter(f=>f.name===name).length])),
  parameterReplay:{passed:!parameterError,error:parameterError,materialRows:parameters?.families.reduce((n,f)=>n+f.materials.length,0),variants:parameters?.variants.length,frames:parameters?.frames.length},
  uvErrors,failures,resourceGaps:[...gaps.values()].sort((a,b)=>a.key.localeCompare(b.key)),
  families:families.map(family=>({...family,materialCount:materials.filter(m=>m.family===family.id).length}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [capturePath=SURFACE_CAPTURE,bankPath=join(SURFACE_BANK,'manifest.json'),out=join(SURFACE_WORKSPACE,'source-grouping.json')]=process.argv.slice(2);
 const captureBytes=await readFile(capturePath);
 const report=auditSurfaceGrouping(JSON.parse(capturePath.endsWith('.gz')?gunzipSync(captureBytes):captureBytes),JSON.parse(await readFile(bankPath,'utf8')));
 await writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,resourceGaps:report.resourceGaps.length,families:undefined}));
}
