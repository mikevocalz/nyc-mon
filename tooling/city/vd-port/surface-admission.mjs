import{readFile,writeFile}from'node:fs/promises';
import{join}from'node:path';
import{pathToFileURL,fileURLToPath}from'node:url';
const repositoryRoot=fileURLToPath(new URL('../../../',import.meta.url));
import{createHash}from'node:crypto';
import ts from'../../../node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js';
import{selectSourceCohorts}from'../../../packages/app/features/game/world/vd-port/blocks/source-activation.ts';
import{cellNum}from'../../../packages/app/features/game/world/cells/cell-rules.ts';
import{SURFACE_OUTPUT,SURFACE_BANK}from'./surface-paths.mjs';

const unwrap=node=>{while(ts.isAsExpression(node)||ts.isSatisfiesExpression(node)||ts.isParenthesizedExpression(node))node=node.expression;return node;};
function property(node,name){const object=unwrap(node);if(!ts.isObjectLiteralExpression(object))throw new Error('Preset must remain an explicit object');const field=object.properties.find(field=>field.name?.text===name);if(!field||!ts.isPropertyAssignment(field))throw new Error(`Missing preset field ${name}`);return unwrap(field.initializer);}
function numeric(node,constants){node=unwrap(node);if(ts.isNumericLiteral(node))return Number(node.text.replaceAll('_',''));if(ts.isIdentifier(node)&&constants.has(node.text))return constants.get(node.text);if(ts.isBinaryExpression(node)){const a=numeric(node.left,constants),b=numeric(node.right,constants);if(node.operatorToken.kind===ts.SyntaxKind.AsteriskToken)return a*b;if(node.operatorToken.kind===ts.SyntaxKind.LessThanLessThanToken)return a<<b;}throw new Error('Unreviewed preset numeric expression');}
async function sourcePreset(){
 const path='packages/app/features/game/perf/tier-presets.ts',text=await readFile(join(repositoryRoot,path),'utf8'),file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true),declarations=file.statements.filter(ts.isVariableStatement).flatMap(statement=>[...statement.declarationList.declarations]);
 const find=name=>{const declaration=declarations.find(declaration=>declaration.name.text===name);if(!declaration?.initializer)throw new Error(`Missing preset constant ${name}`);return declaration.initializer;};
 const constants=new Map([['MiB',numeric(find('MiB'),new Map())]]),preset=property(find('WORLD_PRESETS'),'ipad-a12x'),near=property(property(preset,'vdPort'),'blocksNear');
 const number=(object,key)=>numeric(property(object,key),constants),level=property(near,'level');if(!ts.isStringLiteral(level))throw new Error('Unknown source near-level selector');
 return{source:path,sha256:createHash('sha256').update(text).digest('hex'),residentRadius:number(preset,'residentRadiusM'),screenErrorPx:number(preset,'screenErrorPx'),hysteresis:number(preset,'hysteresis'),errorM:number(near,'errorM'),level:level.text,
  existingGeometryBudget:{geometryBytes:number(near,'geometryBytes'),cellDraws:number(near,'cellDraws'),triangles:number(near,'triangles')}};
}

/** Generation metadata uses finished geometry bounds and the runtime's real selector; it changes no budgets. */
export async function writeSurfaceAdmission(outDir=SURFACE_OUTPUT,bankDir=SURFACE_BANK){
 const registry=JSON.parse(await readFile(join(outDir,'registry.json'),'utf8')),manifest=JSON.parse(await readFile(join(outDir,'manifest.json'),'utf8')),bank=JSON.parse(await readFile(join(bankDir,'manifest.json'),'utf8'));
 if(!manifest.complete||!bank.complete)throw new Error('Complete source geometry and pages required for admission metadata');
 const preset=await sourcePreset(),groups=new Map(),pageById=new Map(bank.pages.map(page=>[page.id,page]));
 const materialPages=new Map(registry.materials.map(material=>[material.id,new Set(Object.values(material.textureBindings).map(binding=>binding.page))]));
 const extend=(bounds,other)=>{for(let axis=0;axis<3;axis++){bounds[axis]=Math.min(bounds[axis],other[axis]);bounds[axis+3]=Math.max(bounds[axis+3],other[axis+3]);}};
 for(const cell of manifest.cells){const id=cellNum(cell.cx,cell.cz);let group=groups.get(id);if(!group){group={key:{},cells:[],siblings:[],bounds:new Float64Array([Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity])};groups.set(id,group);}group.cells.push(cell);extend(group.bounds,cell.bounds);}
 const rings=[];
 for(let ring=1;ring<=10;ring++){
  const path=`packages/app/features/game/world/vd-port/blocks/data-ring${ring}/manifest.ts`,module=await import(pathToFileURL(join(repositoryRoot,path))),data=module[`VD_BLOCKS_RING${ring}`];
  for(const info of data[preset.level]){const group=groups.get(cellNum(info.cx,info.cz));if(group){group.siblings.push({...info,bytes:info.vertices*28+info.triangles*3*(info.wide?4:2)});extend(group.bounds,info.bounds);}}
  rings.push(path);
 }
 const parameters=registry.parameters,parameterBytes=16*(parameters.materialCount+parameters.families.reduce((n,family)=>n+family.fields.length*family.materials.length,0)+parameters.variantFields.length*parameters.variants.length+parameters.frameFields.length*parameters.frames.length);
 const summary=ids=>{
  const pages=new Set(),cells=ids.flatMap(id=>groups.get(id).cells),siblings=ids.flatMap(id=>groups.get(id).siblings);
  for(const cell of cells)for(const material of cell.materials)for(const page of materialPages.get(material))pages.add(page);
  return{cohorts:ids.map(id=>({cx:groups.get(id).cells[0].cx,cz:groups.get(id).cells[0].cz})),sourceDraws:cells.length,siblingDraws:siblings.length,
   sourceTriangles:cells.reduce((n,cell)=>n+cell.triangles,0),siblingTriangles:siblings.reduce((n,cell)=>n+cell.triangles,0),
   sourceVertices:cells.reduce((n,cell)=>n+cell.vertices,0),siblingVertices:siblings.reduce((n,cell)=>n+cell.vertices,0),
   sourceGeometryBytes:cells.reduce((n,cell)=>n+cell.bytes,0),siblingGeometryBytes:siblings.reduce((n,cell)=>n+cell.bytes,0),
   geometryWithGlobalLegacyMinimum:{geometryBytes:cells.reduce((n,cell)=>n+cell.bytes,0)+preset.existingGeometryBudget.geometryBytes,cellDraws:cells.length+preset.existingGeometryBudget.cellDraws,triangles:cells.reduce((n,cell)=>n+cell.triangles,0)+preset.existingGeometryBudget.triangles},
   gpuPageBytes:[...pages].reduce((n,id)=>n+pageById.get(id).gpuBytes,0),materialBytes:parameterBytes+[...pages].reduce((n,id)=>n+pageById.get(id).gpuBytes,0),pages:[...pages].sort((a,b)=>a-b)};
 };
 const k=1097.987543300894,startRadius=180;
 const views=[{name:'native-initial-overview',camera:{x:192,y:176,z:22.000000000000014}},{name:'caller-spawn',camera:{x:-20,y:4.12,z:22}},{name:'authored-pilot-view',camera:{x:-10,y:4.1202279586,z:112}}];
 const starts=views.map(view=>({...view,k,startRadius,...summary(selectSourceCohorts(groups,{camera:view.camera,k,startRadius,layer:{errorM:preset.errorM,reachM:120,pin:false},residentRadius:preset.residentRadius,screenErrorPx:preset.screenErrorPx,hysteresis:preset.hysteresis}))}));
 const cohorts=[...groups.keys()].map(id=>({id,bounds:[...groups.get(id).bounds],...summary([id])}));
 const report={scope:'Exact completed source cells plus configured legacy-ring siblings; START demand before nearest complete-cohort admission; logical GPU bytes exclude scene render targets/shadows/other city layers',registrySha256:registry.sha256,preset,legacyRingInputs:rings,parameterBytes,
  legacyMinimum:preset.existingGeometryBudget,legacyPolicy:'One shared global legacy-only subquota is reserved once beside admitted SOURCE-only costs. Same-cell sibling sums must fit within that subquota; they are not an additional reserve.',
  starts,cohorts,maxPageCohort:[...cohorts].sort((a,b)=>b.gpuPageBytes-a.gpuPageBytes)[0],maxGeometryCohort:[...cohorts].sort((a,b)=>b.sourceGeometryBytes+b.siblingGeometryBytes-a.sourceGeometryBytes-a.siblingGeometryBytes)[0],maxDrawCohort:[...cohorts].sort((a,b)=>b.sourceDraws+b.siblingDraws-a.sourceDraws-a.siblingDraws)[0]};
 await writeFile(join(outDir,'admission.json'),JSON.stringify(report,null,2));return report;
}
