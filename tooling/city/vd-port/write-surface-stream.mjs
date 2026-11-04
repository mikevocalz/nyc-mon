import{readFile,writeFile,mkdir,statfs}from'node:fs/promises';
import{createReadStream}from'node:fs';
import{createGunzip,gunzipSync}from'node:zlib';
import{createInterface}from'node:readline';
import{join,relative}from'node:path';
import{createHash}from'node:crypto';
import{MeshoptEncoder}from'../../../node_modules/.pnpm/meshoptimizer@1.1.1/node_modules/meshoptimizer/index.js';
import{AFFINE}from'./write.mjs';
import{transformSurfaceNormal}from'./surface-layout.mjs';
import{canonicalSurfaceJSON}from'./surface-registry.mjs';
import{encodeSurfaceCell}from'./surface-codec.mjs';
import{writeSurfaceAdmission}from'./surface-admission.mjs';
import{verifySurfaceStreamMaterials}from'./surface-stream-spool.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
import{SURFACE_SPOOL,SURFACE_OUTPUT,SURFACE_CAPTURE,SURFACE_BANK,SURFACE_WORKSPACE}from'./surface-paths.mjs';
const[spoolDir=SURFACE_SPOOL,outDir=SURFACE_OUTPUT,capturePath=SURFACE_CAPTURE]=process.argv.slice(2);
const spool=JSON.parse(await readFile(join(spoolDir,'manifest.json'),'utf8'));
if(!spool.complete)throw new Error('Full geometry stream has not passed all source parity checks');
const snapshot=JSON.parse(await readFile(join(outDir,'registry.json'),'utf8'));
const uses=new Map(JSON.parse(await readFile(join(outDir,'source-uses.json'),'utf8')));
const rawCapture=await readFile(capturePath),capture=JSON.parse(capturePath.endsWith('.gz')?gunzipSync(rawCapture):rawCapture);
const materialParity=verifySurfaceStreamMaterials(capture,JSON.parse(gunzipSync(await readFile(join(SURFACE_WORKSPACE,'source-stream-capture.json.gz')))));
const audits=new Map(capture.tiles.flatMap(tile=>tile.geometryAudits.map(audit=>[audit.id,audit])));
const frameRows=new Map(snapshot.frames.map((frame,index)=>[canonicalSurfaceJSON(frame),index]));
const variantRows=new Map(snapshot.variants.map((variant,index)=>[canonicalSurfaceJSON({fields:variant.fields,frame:variant.frame}),index]));
const sourceVariants=new Map();
for(const[id,audit]of audits){
 sourceVariants.set(id,audit.variants.map(variant=>{
  const frame=frameRows.get(canonicalSurfaceJSON({...variant.frame,...audit.sceneFrame,sourceYOffset:audit.sceneFrame.baseY-audit.sceneFrame.curb}));
  const row=variantRows.get(canonicalSurfaceJSON({fields:variant.fields,frame}));if(row===undefined)throw new Error('Unbound original frame/variant');return row;
 }));
}
const linear=[AFFINE.sx,0,0,0,0,1,0,0,0,0,AFFINE.sz,0,0,0,0,1];
const output={complete:false,cells:[],audit:{sourceGeometryParity:spool.structures,sourceMaterialParity:materialParity,sourceStructures:spool.structures.length}};
await mkdir(outDir,{recursive:true});await MeshoptEncoder.ready;
for(const sourceCell of spool.cells){
 const path=join(spoolDir,sourceCell.file),file=await readFile(path);
 if(file.length!==sourceCell.fileBytes||sha(file)!==sourceCell.sha256)throw new Error('Source spool integrity failure');
 const[cx,cz]=sourceCell.key.split('_').map(Number),groups=new Map();let triangles=0;
 const lines=createInterface({input:createReadStream(path).pipe(createGunzip()),crlfDelay:Infinity});
 for await(const line of lines){
  const batch=JSON.parse(line),audit=audits.get(batch.id),rows=sourceVariants.get(batch.id);if(!audit||!rows)throw new Error('Unknown streamed source structure');
  for(let at=0;at<batch.vertices.length;at+=3){
   const triangle=batch.vertices.slice(at,at+3);triangles++;
   const use=uses.get(`${batch.tile}:${triangle[0].material}:${triangle[0].renderOrder}:${triangle[0].castShadow}:${triangle[0].receiveShadow}`);
   if(!use)throw new Error('Unbound source draw state');
   let cell=groups.get(use.family);if(!cell){cell={key:`${sourceCell.key}-f${use.family}`,cx,cz,family:use.family,vertices:[],indices:[],bounds:[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],materials:new Set(),variants:new Set(),structures:new Set(),weld:new Map()};groups.set(use.family,cell);}
   cell.structures.add(batch.id);
   for(const original of triangle){
    const material=uses.get(`${batch.tile}:${original.material}:${original.renderOrder}:${original.castShadow}:${original.receiveShadow}`);
    if(material?.family!==use.family)throw new Error('Stream triangle crosses source graph state');
    const vertex={...original,material:material.material,variant:rows[original.variant],
     position:[original.position[0]*AFFINE.sx+AFFINE.ox,original.position[1]-audit.sceneFrame.baseY+audit.sceneFrame.curb,original.position[2]*AFFINE.sz+AFFINE.oz],normal:transformSurfaceNormal(original.normal,linear)};
    if(vertex.variant===undefined)throw new Error('Unbound stream constant variant');
    const key=JSON.stringify([vertex.position,vertex.color,vertex.uv,vertex.normal,vertex.material,vertex.variant,vertex.grime,vertex.weather,vertex.flags]);
    let index=cell.weld.get(key);if(index===undefined){index=cell.vertices.length;cell.weld.set(key,index);cell.vertices.push(vertex);}cell.indices.push(index);cell.materials.add(vertex.material);cell.variants.add(vertex.variant);
    for(let axis=0;axis<3;axis++){cell.bounds[axis]=Math.min(cell.bounds[axis],vertex.position[axis]);cell.bounds[axis+3]=Math.max(cell.bounds[axis+3],vertex.position[axis]);}
   }
  }
 }
 if(triangles!==sourceCell.triangles)throw new Error('Source spool triangle count changed');
 for(const cell of groups.values()){
  const encoded=await encodeSurfaceCell({...cell,registry:snapshot,encoder:MeshoptEncoder}),free=await statfs(outDir);
  if(free.bavail*free.bsize<encoded.bytes.length+32*2**20)throw new Error('Production output paused: insufficient safe disk headroom');
  await writeFile(join(outDir,`${cell.key}.bin`),encoded.bytes);
  const textures=[...new Set([...cell.materials].flatMap(id=>snapshot.materials[id].textures))].sort((a,b)=>a-b);
  output.cells.push({key:cell.key,cx,cz,family:cell.family,vertices:cell.vertices.length,wide:encoded.index.BYTES_PER_ELEMENT===4,sha256:sha(encoded.bytes),triangles:cell.indices.length/3,bounds:cell.bounds,bytes:cell.vertices.length*76+encoded.index.byteLength,fileBytes:encoded.bytes.length,
   surface:{sha256:snapshot.sha256,materialCount:snapshot.materialCount,variantCount:snapshot.variantCount},materials:[...cell.materials].sort((a,b)=>a-b),variants:[...cell.variants].sort((a,b)=>a-b),structures:[...cell.structures].sort(),textures});
  cell.weld.clear();cell.vertices.length=0;cell.indices.length=0;
 }
 await writeFile(join(outDir,'manifest.json'),JSON.stringify(output));console.log(JSON.stringify({cell:sourceCell.key,triangles,families:groups.size,files:output.cells.length}));
}
if(output.cells.reduce((n,cell)=>n+cell.triangles,0)!==spool.structures.reduce((n,item)=>n+item.triangles,0))throw new Error('Production triangle coverage changed');
output.complete=true;await writeFile(join(outDir,'manifest.json'),JSON.stringify(output));
const bank=JSON.parse(await readFile(join(SURFACE_BANK,'manifest.json'),'utf8'));
const bankRelative=relative(outDir,SURFACE_BANK).split('\\').join('/');
const generated=`// Generated complete authored source assets. Admission budgets remain scene-owned.\n`+
 `export const SURFACE_REGISTRY=require('./registry.json');\nexport const SURFACE_MANIFEST=require('${bankRelative}/manifest.json');\nexport const SURFACE_CELLS=require('./manifest.json').cells;\n`+
 `export const SURFACE_PAGE_ASSETS={\n${bank.pages.map(page=>`${JSON.stringify(page.id)}:require(${JSON.stringify(`${bankRelative}/${page.storage?.file??`${page.sha256}.bin`}`)})`).join(',\n')}\n};\n`+
 `export const SURFACE_CELL_ASSETS={\n${output.cells.map(cell=>`${JSON.stringify(cell.key)}:require(${JSON.stringify(`./${cell.key}.bin`)})`).join(',\n')}\n};\n`;
await writeFile(join(outDir,'assets.js'),generated);
await writeSurfaceAdmission(outDir,SURFACE_BANK);
console.log(JSON.stringify({outDir,complete:true,cells:output.cells.length,triangles:output.cells.reduce((n,c)=>n+c.triangles,0),gpuGeometryBytes:output.cells.reduce((n,c)=>n+c.bytes,0),fileBytes:output.cells.reduce((n,c)=>n+c.fileBytes,0)}));
