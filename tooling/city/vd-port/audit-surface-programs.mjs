import {classifySourcePbrGlass} from '../../../packages/app/features/game/world/vd-port/blocks/source-glass-programs.ts';
import {classifySourceStandard} from '../../../packages/app/features/game/world/vd-port/blocks/source-standard-programs.ts';
import {classifyApolloSource} from '../../../packages/app/features/game/world/vd-port/blocks/source-apollo-programs.ts';
import {classifyCustomBuildingSource} from '../../../packages/app/features/game/world/vd-port/blocks/source-custom-building-programs.ts';
import {classifyVegetationSource} from '../../../packages/app/features/game/world/vd-port/blocks/source-vegetation-programs.ts';
import {readFile,writeFile} from 'node:fs/promises';
import {classifySourcePbr} from '../../../packages/app/features/game/world/vd-port/blocks/source-pbr-programs.ts';
import {classifyPilotFk} from '../../../packages/app/features/game/world/vd-port/blocks/source-fk-programs.ts';
import {classifySourceSignMaterial} from '../../../packages/app/features/game/world/vd-port/blocks/source-sign-programs.ts';
import {sourceApolloProgram} from '../../../packages/app/features/game/world/vd-port/blocks/apollo-material.ts';
import {sourceCustomBuildingProgram} from '../../../packages/app/features/game/world/vd-port/blocks/custom-building-material.ts';
import {sourceVegetationProgram} from '../../../packages/app/features/game/world/vd-port/blocks/vegetation-material.ts';
import {sourceGlassProgram,sourceFkProgram} from '../../../packages/app/features/game/world/vd-port/blocks/glass-material.ts';
const input=process.argv[2]??'/tmp/nycmon-block-geometry-provenance.json',output=process.argv[3]??'/tmp/nycmon-surface-program-gaps.json';
const census=JSON.parse(await readFile(input,'utf8'));if(!census.complete||census.missingStructures.length)throw new Error('Complete settled census required');
const records=new Map();
for(const tile of census.tiles)for(const material of tile.materials){
 const shader=material.shader;
 const roleSets=[...new Map(tile.meshes.filter(mesh=>mesh.materials.includes(material.uuid)).map(mesh=>{const roles=Object.keys(mesh.attributes).filter(name=>shader.attrs.includes(name)&&!['position','normal','uv','color'].includes(name));return[JSON.stringify(roles),roles];})).values()];
 const identity={key:material.key,shaderHash:shader.hash,shaderSha256:shader.sha256,attributeRoles:roleSets[0]??[],attributeRoleSets:roleSets,basis:shader.sha256Basis,shaderHashBasis:shader.sha256Basis,type:material.type,vertexColors:material.vertexColors,normalMapType:material.normalMapType,hasAlphaTest:material.alphaTest>0,mapRoles:Object.entries(material.maps).filter(([,value])=>value).map(([role])=>role).sort()};
 const unique=JSON.stringify([identity.shaderSha256,identity.key,identity.type]);let record=records.get(unique);
 if(!record){
  const family=identity.key.startsWith('pbr|')?'pbr':identity.key.startsWith('pbrglass')||identity.key.startsWith('kitwinglass')?'glass':/(^|\|)a3[234]/.test(identity.key)?'apollo':/^(b[23])|\|b[23]|\|w33cal\|/.test(identity.key)?'custom-building':identity.key.startsWith('vg37')?'vegetation':identity.key.includes('ar33sg')?'sign':'fk-or-standard';
  const reference={pbr:['city/mat/pbrLib.js'],glass:['city/mat/pbrLib.js','city/fk/kitMats.js'],apollo:['city/w125cKit.js'],'custom-building':['city/fk/custom/bid2.js','city/fk/custom/bid3Util.js'],vegetation:['world/vg37.js','world/materials.js','city/cpFloraKit.js'],sign:['city/fk/signKit.js'],'fk-or-standard':['city/fk/kitMats.js','world/materials.js']}[family];
  const tests=[['apollo-strong-contract',()=>classifyApolloSource(identity)],['custom-building-strong-contract',()=>classifyCustomBuildingSource(identity)],['vegetation-strong-contract',()=>classifyVegetationSource(identity)],['source-pbr-factory',()=>classifySourcePbr(identity)],['source-glass-factory',()=>classifySourcePbrGlass(identity)],['source-standard-factory',()=>classifySourceStandard(identity)],['pilot-fk-factory',()=>classifyPilotFk(identity)],['sign-factory',()=>classifySourceSignMaterial(identity)],['apollo-helper',()=>sourceApolloProgram(identity.key,identity.shaderHash)],['custom-building-helper',()=>sourceCustomBuildingProgram(identity.key,identity.shaderHash)],['vegetation-helper',()=>sourceVegetationProgram(identity.key,identity.shaderHash)],['glass-helper',()=>sourceGlassProgram(identity.key,identity.shaderHash)],['fk-helper',()=>sourceFkProgram(identity.key,identity.shaderHash)]];
  const matches=[];for(const[name,fn]of tests){try{matches.push({name,program:fn()});}catch{}}
  record={...identity,family,sourceFiles:reference.map(path=>`client/src/${path}`),matches,strongIdentityContract:matches.some(match=>match.name.endsWith('contract')||match.name.endsWith('factory')),materialRecords:0,tiles:[],mapRoles:identity.mapRoles,uniformNames:Object.keys(shader.uniforms),sourceFlags:material.pbr?{set:material.pbr.set,opts:material.pbr.opts,attrs:material.pbr.attrs,paint:material.pbr.paint,over:material.pbr.over,street:material.pbr.street,gum:material.pbr.gum,city:material.pbr.city,skyMetal:material.pbr.skyMetal}:null,activeAttributes:shader.attrs,gap:matches.some(match=>match.name.endsWith('factory'))?'factory-identity-covered-needs-layout-state-validation':matches.length?'helper-graph-needs-factory-validation':'no-matching-factory-or-helper'};records.set(unique,record);
 }
 record.mapRoleSets??=[];if(!record.mapRoleSets.some(roles=>JSON.stringify(roles)===JSON.stringify(identity.mapRoles)))record.mapRoleSets.push(identity.mapRoles);
 record.unresolvedRequirements??=[];if(material.maps.normalMap&&material.normalMapType===undefined&&!record.unresolvedRequirements.includes('captured normalMapType'))record.unresolvedRequirements.push('captured normalMapType');
 record.normalMapTypes??=[];if(material.normalMapType!==undefined&&!record.normalMapTypes.includes(material.normalMapType))record.normalMapTypes.push(material.normalMapType);
 record.alphaTestValues??=[];if(!record.alphaTestValues.includes(material.alphaTest))record.alphaTestValues.push(material.alphaTest);
 record.vertexColorModes??=[];if(!record.vertexColorModes.includes(material.vertexColors))record.vertexColorModes.push(material.vertexColors);
 record.materialRecords++;if(!record.tiles.includes(tile.key))record.tiles.push(tile.key);
}
for(const tile of census.tiles){const materials=new Map(tile.materials.map(material=>[material.uuid,material]));for(const mesh of tile.meshes)for(const uuid of new Set(mesh.materials)){const material=materials.get(uuid);if(!material)continue;const record=records.get(JSON.stringify([material.shader.sha256,material.key,material.type]));record.meshUses=(record.meshUses??0)+1;record.geometryAttributes??={};for(const name of Object.keys(mesh.attributes))record.geometryAttributes[name]=(record.geometryAttributes[name]??0)+1;}}
const programs=[...records.values()].sort((a,b)=>a.family.localeCompare(b.family)||a.key.localeCompare(b.key));
for(const program of programs){
 const key=program.key, locations=[];const loc=(file,line)=>locations.push({file:`client/src/${file}`,line});
 if(key.includes('b3self')){loc('city/fk/custom/bid3Util.js',256);const [day,night]=key.split('|b3self')[1].split(',').map(Number);program.implementationWork='Bind diffuse-driven self-emission addition; coefficients are source toFixed(3), not raw key floats';program.sourceConstants={day:Number(day.toFixed(3)),night:Number(night.toFixed(3))};}
 else if(key.includes('b3plit')){loc('city/w125cbKit.js',74);program.implementationWork='Reuse verified night-emission multiplication; add exact strong identity/factory binding';}
 else if(key.includes('b3mr')){loc('city/w125cbKit.js',59);program.implementationWork='Port reflected radiance luma desaturation plus reflected-world-Y horizon attenuation';}
 else if(key.includes('w33cal')){loc('city/fk/custom/west.js',64);program.implementationWork='Reuse customWallColorNode clean calibration with exact source wrapper order';}
 else if(program.family==='apollo'){loc('city/w125cKit.js',key.startsWith('a32tube')?228:key==='a33led2'?568:key.endsWith('a32sign')?207:688);program.implementationWork='Strong Apollo contract exists; actual Standard/Basic factory binding owned by root';}
 else if(program.family==='vegetation'){loc('world/vg37.js',55);loc('city/cpFloraKit.js',270);program.implementationWork='Bind complete VG maps/normal/translucency/wind/snow/fade/commonlighting using original object+instance frames';}
 else if(program.family==='glass'){loc(key.startsWith('kitwin')?'city/fk/kitMats.js':'city/mat/pbrLib.js',key.startsWith('kitwin')?536:802);program.implementationWork='Existing glass math; exact strong identity, source pg uniforms/variant/body/frame and blend/factory binding remain';}
 else if(program.family==='pbr'){loc('city/mat/pbrLib.js',425);if(key.includes('skymetalU'))loc('city/fk/kitMats.js',495);if(key.includes('fkenvU'))loc('city/fk/kitMats.js',617);program.implementationWork='Shared PBR core already handles paint/weather/street flags; extend strict identities and bind exact modifier composition (SkyMetal/FK tint/env as active)';}
 else if(program.family==='sign'){loc('city/fk/signKit.js',key.endsWith('ar33sgDu')?92:key.endsWith('ar33sgG')?196:key==='ar33sgH'?240:key==='ar33sgS3'?270:123);program.implementationWork='Bind exact SG program identity/material family; Du/S3/G/H branches remain outside current face+Gvc factory';}
 else if(program.family==='fk-or-standard'){loc('city/fk/kitMats.js',key.includes('fklv')?649:key.includes('fksoft')?636:320);loc('world/materials.js',1);program.implementationWork='Known common/FK helper math exists; require explicit strong source identity and complete wrapper/map/base-type binding, never generic acceptance';}
 if(locations.length)program.sourceLocations=locations;
}
const summary={};for(const p of programs){const key=`${p.family}:${p.gap}`;summary[key]=(summary[key]??0)+1;}
await writeFile(output,JSON.stringify({sourcePin:census.sourcePin,basis:'settled source; exact key/type/SHA variants retained separately',scope:'Identity/helper audit only; matching contracts never imply complete factory, bank, or native acceptance',strongProgramCount:new Set(programs.map(p=>p.shaderSha256)).size,keyVariants:programs.length,summary,programs},null,2));console.log(JSON.stringify({output,summary,strongProgramCount:new Set(programs.map(p=>p.shaderSha256)).size,keyVariants:programs.length}));
