import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_PBR_PROGRAMS} from '../../../packages/app/features/game/world/vd-port/blocks/source-pbr-programs.ts';
import {classifySurfaceFamily,identifySurfaceFamily} from './surface-families.mjs';

const material=(hash='5d3e43a0')=>({source:{key:SOURCE_PBR_PROGRAMS[hash].key,shaderHash:hash,shaderSha256:SOURCE_PBR_PROGRAMS[hash].sha256},
 type:'MeshStandardMaterial',vertexColors:false,alphaTest:0,shader:{attrs:[]},pbr:{set:'brick_tan'},state:{side:0,transparent:false},renderOrder:0,castShadow:true,receiveShadow:true,
 textureBindings:Object.fromEntries(['pbAlb','pbNrm','pbOrm'].map((role,page)=>[`uniform:${role}`,{page,layer:0,matrix:[1,0,0,0,1,0,0,0,1]}]))});
test('source grouping retains graph composition, fixed draw state and actual texture bank identity',()=>{
 const source=material(),family=identifySurfaceFamily(source);
 assert.equal(family.name,'source-pbr');assert.equal(classifySurfaceFamily(source).program.sharedTint,true);
 // Uniformized per-seed values and exact UV transforms stay table rows, not extra draws.
 const changed=structuredClone(source);changed.color=[.3,.4,.5];changed.opacity=.4;changed.textureBindings['uniform:pbAlb'].matrix[6]=.23;
 assert.deepEqual(identifySurfaceFamily(changed),family);
 for(const change of [x=>x.renderOrder=2,x=>x.receiveShadow=false,x=>x.textureBindings['uniform:pbAlb'].page=42,x=>x.pbr.set='stone_plain']){
  const other=structuredClone(source);change(other);assert.notDeepEqual(identifySurfaceFamily(other),family);
 }
 assert.notDeepEqual(identifySurfaceFamily(material('77942aa6')),family);
});
test('unknown source graph and missing actual page fail before a family can be published',()=>{
 const source=material();source.source.shaderSha256='0'.repeat(64);
 assert.throws(()=>classifySurfaceFamily(source),/exactly one/);
 const missing=material();delete missing.textureBindings['uniform:pbOrm'].page;
 assert.throws(()=>identifySurfaceFamily(missing),/Missing packed page/);
});
