import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSourceAdmission} from './source-admission.ts';
import {createSurfaceCohortPlan,type SurfaceCellInfo} from './surface-layers.ts';
function cell(cx:number,textures:number[]):SurfaceCellInfo{return {key:`${cx}_0-f0`,cx,cz:0,family:0,vertices:3,triangles:1,wide:false,surface:{sha256:'0'.repeat(64),materialCount:1,variantCount:1},bounds:[cx*32,0,0,cx*32+1,2,1],materials:[0],variants:[0],textures,sha256:'1'.repeat(64),fileBytes:1,bytes:234};}
const geometry={geometryBytes:1000,cellDraws:4,triangles:4,vertices:12};
const minimum={geometryBytes:234,cellDraws:1,triangles:1,vertices:3};
const pages=(cells:readonly SurfaceCellInfo[])=>[...new Set(cells.flatMap(c=>c.textures))].map(id=>({id:String(id),bytes:40}));
test('nearest complete cohorts respect unique page unions and reserve the actual legacy quota once',()=>{
 const plan=createSurfaceCohortPlan([cell(0,[0]),cell(1,[0]),cell(2,[1]),cell(3,[2])]);
 const admission=createSourceAdmission(plan,{materialBytes:90,parameterBytes:10,geometry,legacyMinimum:minimum,pages});
 const ids=[...plan.keys()];
 assert.deepEqual(admission.select(ids),ids.slice(0,3),'shared pages count once; fourth needs a third page and a fourth source draw');
 assert.deepEqual(admission.select([...ids].reverse()),[ids[3],ids[2]],'nearest ordering wins, not previous registration ordering');
});
test('visible aggregate over budget is admitted partially, while a single impossible cohort fails before IO',()=>{
 const plan=createSurfaceCohortPlan([cell(0,[0]),cell(1,[1])]);
 const admission=createSourceAdmission(plan,{materialBytes:50,parameterBytes:10,geometry,legacyMinimum:minimum,pages});
 assert.equal(admission.select([...plan.keys()]).length,1);
 assert.throws(()=>createSourceAdmission(plan,{materialBytes:49,parameterBytes:10,geometry,legacyMinimum:minimum,pages}),/complete-cohort/);
});
