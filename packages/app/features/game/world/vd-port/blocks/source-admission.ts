import type { ExternalBudget } from '../../cells/cell-stream.ts';
import type { SurfaceCellInfo, SurfaceCohortPlan } from './surface-layers.ts';
import { nearCellBytes } from './codec.ts';

type Cost={cells:number;bytes:number;triangles:number;vertices:number};
const zero=():Cost=>({cells:0,bytes:0,triangles:0,vertices:0});
const add=(a:Cost,b:Cost):Cost=>({cells:a.cells+b.cells,bytes:a.bytes+b.bytes,triangles:a.triangles+b.triangles,vertices:a.vertices+b.vertices});
const fits=(c:Cost,b:ExternalBudget)=>c.cells<=b.cellDraws&&c.bytes<=b.geometryBytes&&c.triangles<=b.triangles&&(b.vertices===undefined||c.vertices<=b.vertices);
/** Immutable exact metadata admission. A visible city may exceed residency; only
 * complete nearest cohorts enter. Legacy quota is counted once, independently
 * of which same-cell legacy siblings happen to be selected. */
export function createSourceAdmission(plan:SurfaceCohortPlan,options:{materialBytes:number;parameterBytes:number;geometry:ExternalBudget;legacyMinimum:ExternalBudget;
 pages(cells:readonly SurfaceCellInfo[]):readonly {id:string;bytes:number}[]}){
 for(const budget of [options.geometry,options.legacyMinimum])for(const value of [budget.cellDraws,budget.geometryBytes,budget.triangles,...(budget.vertices===undefined?[]:[budget.vertices])])
  if(!Number.isSafeInteger(value)||value<0)throw new Error('Invalid authored admission budget metadata');
 if(!Number.isSafeInteger(options.materialBytes)||!Number.isSafeInteger(options.parameterBytes)||options.materialBytes<=0||options.parameterBytes<0||
  (options.geometry.vertices!==undefined&&options.legacyMinimum.vertices===undefined))throw new Error('Missing authored material or legacy vertex admission reserve');
 const reserved:Cost={cells:options.legacyMinimum.cellDraws,bytes:options.legacyMinimum.geometryBytes,triangles:options.legacyMinimum.triangles,vertices:options.legacyMinimum.vertices??0};
 if(!fits(reserved,options.geometry)||options.parameterBytes>=options.materialBytes)throw new Error('Invalid authored source admission reserve');
 const metadata=new Map<number,{source:Cost;legacy:Cost;pages:readonly{id:string;bytes:number}[]}>();
 for(const [id,group] of plan){
  const source=group.cells.reduce((a,c)=>add(a,{cells:1,bytes:nearCellBytes(c),triangles:c.triangles,vertices:c.vertices}),zero());
  const legacy=group.siblings.reduce((a,p)=>add(a,{cells:1,bytes:p.bytes,triangles:p.triangles!,vertices:p.vertexCount}),zero());
  const pages=options.pages(group.cells),pageBytes=new Map(pages.map(p=>[p.id,p.bytes]));
  if(!fits(add(source,reserved),options.geometry)||!fits(legacy,options.legacyMinimum)||options.parameterBytes+[...pageBytes.values()].reduce((a,b)=>a+b,0)>options.materialBytes)
   throw new Error(`Authored source cohort ${id} exceeds its explicit complete-cohort admission budget`);
  metadata.set(id,{source,legacy,pages});
 }
 return {select(nearest:readonly number[]):number[]{
  const admitted:number[]=[],pages=new Map<string,number>();let source=zero(),legacy=zero(),bytes=options.parameterBytes;
  for(const id of nearest){
   const next=metadata.get(id);if(!next)throw new Error('Unknown source admission cohort');
   let extra=0;for(const page of next.pages)if(!pages.has(page.id))extra+=page.bytes;
   const sourceCost=add(source,next.source),legacyCost=add(legacy,next.legacy);
   if(bytes+extra>options.materialBytes||!fits(add(sourceCost,reserved),options.geometry)||!fits(legacyCost,options.legacyMinimum))continue;
   admitted.push(id);source=sourceCost;legacy=legacyCost;bytes+=extra;for(const page of next.pages)pages.set(page.id,page.bytes);
  }
  return admitted;
 }};
}
