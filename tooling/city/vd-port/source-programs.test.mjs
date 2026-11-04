import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_APOLLO_IDENTITIES,classifyApolloSource,apolloParameterSchema} from '../../../packages/app/features/game/world/vd-port/blocks/source-apollo-programs.ts';
import {SOURCE_CUSTOM_BUILDING_IDENTITIES,classifyCustomBuildingSource,customBuildingSourceConstants,customBuildingParameterSchema} from '../../../packages/app/features/game/world/vd-port/blocks/source-custom-building-programs.ts';
import {SOURCE_VEGETATION_IDENTITIES,classifyVegetationSource,vegetationParameterSchema} from '../../../packages/app/features/game/world/vd-port/blocks/source-vegetation-programs.ts';
const input=record=>({key:record.key,type:record.type,shaderHash:record.hash,shaderSha256:record.sha256,shaderHashBasis:'shaderlib-material-template-and-hook-defines-v1',vertexColors:record.vertexColorModes[0],hasAlphaTest:record.alphaTestModes[0],mapRoles:record.mapRoleSets[0],normalMapType:0});
test('settled source identity requires full SHA, exact key/type/basis and captured renderer flags',()=>{
 for(const[records,classify]of[[Object.values(SOURCE_APOLLO_IDENTITIES),classifyApolloSource],[SOURCE_CUSTOM_BUILDING_IDENTITIES,classifyCustomBuildingSource],[SOURCE_VEGETATION_IDENTITIES,classifyVegetationSource]])for(const record of records){
  const source=input(record);assert.doesNotThrow(()=>classify(source));
  for(const change of[{shaderSha256:'0'.repeat(64)},{key:source.key+'|unknown'},{shaderHashBasis:'provisional'},{type:'UnknownMaterial'},{mapRoles:['unknownMap']}])assert.throws(()=>classify({...source,...change}));
  if(record.vertexColorModes.length===1)assert.throws(()=>classify({...source,vertexColors:!source.vertexColors}));
 }
});
test('Apollo Basic tubes reject provisional Standard-template locators and require no invented emission',()=>{
 const record=SOURCE_APOLLO_IDENTITIES['a32tube0.62,0.68,0.760.22,0.48,1.35'];
 assert.throws(()=>classifyApolloSource({...input(record),shaderHash:'960010e1'}));
 const schema=apolloParameterSchema(input(record));assert.equal(schema.mode,'output');assert.ok(!schema.material.some(field=>field.name==='emissive'));assert.deepEqual(schema.material.map(field=>field.name),['diffuse','opacity']);
});
test('VG schema retains original object/instance frame needs and rejects unsupported vegetation variants',()=>{
 const source=input(SOURCE_VEGETATION_IDENTITIES[0]),schema=vegetationParameterSchema(source);
 assert.ok(schema.frame.includes('source-local-position'));assert.ok(schema.frame.includes('inverse-combined-matrix'));assert.deepEqual(schema.samplers,['map','vgNrm']);
 assert.throws(()=>classifyVegetationSource({...source,key:source.key.replace('lf140','lf142')}));
});

test('custom self-lit constants match source decimal literals and normal maps require actual tangent policy',()=>{
 const self=SOURCE_CUSTOM_BUILDING_IDENTITIES.find(record=>record.key.endsWith('|b3self0.17856,1.1'));
 assert.deepEqual(customBuildingSourceConstants(input(self)).sourceDayNight,[0.179,1.1]);
 assert.notEqual(customBuildingSourceConstants(input(self)).sourceDayNight[0],0.17856);
 const mapped=SOURCE_CUSTOM_BUILDING_IDENTITIES.find(record=>record.mapRoleSets.some(roles=>roles.includes('normalMap')));
 const source={...input(mapped),mapRoles:mapped.mapRoleSets.find(roles=>roles.includes('normalMap'))};
 assert.equal(customBuildingParameterSchema(source).material.find(field=>field.name==='normalScale').size,2);
 assert.throws(()=>classifyCustomBuildingSource({...source,normalMapType:undefined}),/captured Tangent/);
 assert.throws(()=>classifyCustomBuildingSource({...source,normalMapType:1}),/captured Tangent/);
});
