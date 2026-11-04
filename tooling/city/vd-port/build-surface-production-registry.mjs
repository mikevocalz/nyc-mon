import{readFile,writeFile,mkdir,readdir}from'node:fs/promises';
import{gunzipSync}from'node:zlib';
import{join}from'node:path';
import{registryFromCapture}from'./surface-capture.mjs';
import{surfaceBankBindings}from'./surface-bank-bindings.mjs';
import{identifySurfaceFamily}from'./surface-families.mjs';
import{buildSurfaceParameters}from'./surface-parameters.mjs';
import{SURFACE_CAPTURE,SURFACE_BANK,SURFACE_OUTPUT,SURFACE_BAKE_DEPS}from'./surface-paths.mjs';
const[capturePath=SURFACE_CAPTURE,bankPath=join(SURFACE_BANK,'manifest.json'),out=SURFACE_OUTPUT]=process.argv.slice(2);
const bytes=await readFile(capturePath),capture=JSON.parse(capturePath.endsWith('.gz')?gunzipSync(bytes):bytes),bank=JSON.parse(await readFile(bankPath,'utf8'));
if(!bank.complete)throw new Error('Production texture bank is incomplete');
// The authoritative audits retain every source frame/channel signature. Raw pilot vertices are unnecessary here.
for(const tile of capture.tiles)tile.surfaces=[];
const blockDir='packages/app/features/game/world/vd-port/blocks';
const provenanceFiles=(await readdir(blockDir)).filter(name=>name.endsWith('.ts')&&!name.endsWith('.test.ts')&&(name.startsWith('source-')||['glass-material.ts','material-table.ts','surface-parameters.ts','surface-registry.ts','surface-material-bank.ts','surface-layers.ts','surface-part.ts','codec.ts','sign-material.ts','apollo-material.ts','custom-building-material.ts','vegetation-material.ts'].includes(name))).map(name=>({path:`${blockDir}/${name}`,file:`${blockDir}/${name}`}));
for(const name of ['surface-layout.mjs','surface-codec.mjs','write-surfaces.mjs','surface-harvest.mjs','shadow-provenance.js','geometry-provenance.js','surface-registry.mjs','surface-capture.mjs','surface-parameters.mjs','surface-frame.mjs','pack-surface-textures.mjs','surface-bank-bindings.mjs','surface-families.mjs','surface-uniforms.mjs','stream-source-surfaces.js','surface-stream-spool.mjs','build-surface-production-bank.mjs','build-surface-production-registry.mjs','write-surface-stream.mjs','surface-admission.mjs','surface-paths.mjs','material-census.mjs','transcode-surface-ktx.mjs'])provenanceFiles.push({path:`tooling/city/vd-port/${name}`,file:`tooling/city/vd-port/${name}`});
provenanceFiles.push({path:'packages/app/features/game/world/vd-port/furniture/pbr-material.ts',file:'packages/app/features/game/world/vd-port/furniture/pbr-material.ts'});
for(const name of ['three.module.js','three.core.js'])provenanceFiles.push({path:`bake-deps/three0.185.1/build/${name}`,file:join(SURFACE_BAKE_DEPS,'three/build',name)});
const{registry,capturedMaterialUses}=registryFromCapture(capture,{...surfaceBankBindings(capture,bank),identifyFamily:identifySurfaceFamily,metadataOnly:true,provenanceFiles});
registry.parameters=buildSurfaceParameters(registry);const snapshot=registry.finalize();
if(!snapshot.coverage.complete)throw new Error('Production shader coverage incomplete');
const pages=new Map(bank.pages.map(page=>[page.id,page])),cellUses=new Map(),structureUses=new Map();
const extend=(entry,material,triangles)=>{
 entry.materials.add(material.material);entry.families.add(material.family);entry.triangles+=triangles;
 for(const binding of Object.values(registry.materials[material.material].textureBindings)){
  if(!pages.has(binding.page))throw new Error('Unresolved cohort resource');entry.pages.add(binding.page);
 }
};
const use=()=>({materials:new Set(),families:new Set(),pages:new Set(),triangles:0});
for(const tile of capture.tiles){
 const ids=new Map(tile.materials.map((material,index)=>[material.uuid,index]));
 for(const mesh of tile.meshes){
  const cast=mesh.shadowPolicy?.castShadow??mesh.castShadow,receive=mesh.shadowPolicy?.receiveShadow??mesh.receiveShadow;
  const material=uuid=>{const key=`${tile.key}:${ids.get(uuid)}:${mesh.renderOrder}:${cast}:${receive}`,found=capturedMaterialUses.get(key);if(!found)throw new Error(`Unregistered mesh use ${key}`);return found;};
  if(!structureUses.has(mesh.structure))structureUses.set(mesh.structure,use());
  for(const uuid of mesh.materials)extend(structureUses.get(mesh.structure),material(uuid),0);
  for(const ref of mesh.cellRefs){
   if(!cellUses.has(ref.key))cellUses.set(ref.key,use());
   for(const uuid of ref.materials)extend(cellUses.get(ref.key),material(uuid),0);
   cellUses.get(ref.key).triangles+=ref.triangles;
  }
 }
}
const finish=(key,entry)=>({key,materials:[...entry.materials].sort((a,b)=>a-b),families:[...entry.families].sort((a,b)=>a-b),pages:[...entry.pages].sort((a,b)=>a-b),
 triangles:entry.triangles,gpuPageBytes:[...entry.pages].reduce((n,id)=>n+pages.get(id).gpuBytes,0),storedPageBytes:[...entry.pages].reduce((n,id)=>n+pages.get(id).storage.fileBytes,0)});
const cells=[...cellUses].map(([key,entry])=>finish(key,entry)),structures=[...structureUses].map(([key,entry])=>finish(key,entry));
const unions=cells.map(cell=>{
 const[cx,cz]=cell.key.split('_').map(Number),set=new Set(),selected=cells.filter(other=>{const[x,z]=other.key.split('_').map(Number);return Math.abs(cx-x)<=1&&Math.abs(cz-z)<=1;});
 for(const member of selected)for(const page of member.pages)set.add(page);
 return{center:cell.key,cells:selected.map(cell=>cell.key),gpuPageBytes:[...set].reduce((n,id)=>n+pages.get(id).gpuBytes,0)};
});
const report={scope:'Exact source centroid cell/material/page references; per-cell triangle totals include explicitly omitted zero-area source faces;3x3 unions are spatial diagnostics, not game START selection',registrySha256:snapshot.sha256,
 materials:snapshot.materialCount,variants:snapshot.variantCount,families:snapshot.families.length,cells,
 maxCell:[...cells].sort((a,b)=>b.gpuPageBytes-a.gpuPageBytes)[0],maxBuilding:structures.sort((a,b)=>b.gpuPageBytes-a.gpuPageBytes)[0],
 max3x3:unions.sort((a,b)=>b.gpuPageBytes-a.gpuPageBytes)[0],pilotCell:cells.find(cell=>cell.key==='-1_1')};
await mkdir(out,{recursive:true});await writeFile(join(out,'registry.json'),JSON.stringify(snapshot));await writeFile(join(out,'resource-budget.json'),JSON.stringify(report,null,2));
await writeFile(join(out,'source-uses.json'),JSON.stringify([...capturedMaterialUses]));
console.log(JSON.stringify({out,sha256:snapshot.sha256,materials:snapshot.materialCount,variants:snapshot.variantCount,families:snapshot.families.length,cells:cells.length,maxCell:report.maxCell,maxBuilding:report.maxBuilding,max3x3:report.max3x3,pilotCell:report.pilotCell}));
