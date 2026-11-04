import {classifySourcePbr,sourcePbrParameterSchema} from '../../../packages/app/features/game/world/vd-port/blocks/source-pbr-programs.ts';
import {classifyPilotFk,pilotFkParameterSchema} from '../../../packages/app/features/game/world/vd-port/blocks/source-fk-programs.ts';
import {classifySourceSignMaterial,sourceSignParameterSchema} from '../../../packages/app/features/game/world/vd-port/blocks/source-sign-programs.ts';
import {classifySourcePbrGlass,sourcePbrGlassParameterSchema} from '../../../packages/app/features/game/world/vd-port/blocks/source-glass-programs.ts';
import {classifySourceStandard,sourceStandardParameterSchema} from '../../../packages/app/features/game/world/vd-port/blocks/source-standard-programs.ts';
import {classifyApolloSource,apolloParameterSchema} from '../../../packages/app/features/game/world/vd-port/blocks/source-apollo-programs.ts';
import {classifyCustomBuildingSource,customBuildingParameterSchema} from '../../../packages/app/features/game/world/vd-port/blocks/source-custom-building-programs.ts';
import {classifyVegetationSource,vegetationParameterSchema} from '../../../packages/app/features/game/world/vd-port/blocks/source-vegetation-programs.ts';

const lanes=[['source-pbr',classifySourcePbr,sourcePbrParameterSchema],['source-fk',classifyPilotFk,pilotFkParameterSchema],
 ['source-sign',classifySourceSignMaterial,sourceSignParameterSchema],['source-glass',classifySourcePbrGlass,sourcePbrGlassParameterSchema],
 ['source-standard',classifySourceStandard,sourceStandardParameterSchema],['source-apollo',classifyApolloSource,apolloParameterSchema],
 ['source-custom-building',classifyCustomBuildingSource,customBuildingParameterSchema],['source-vegetation',classifyVegetationSource,vegetationParameterSchema]];
export const SURFACE_FIXED_STATE=['fog','wireframe','shadowSide','flatShading','side','transparent','depthWrite','depthTest','colorWrite','blending','blendSrc','blendDst','blendSrcAlpha','blendDstAlpha','blendEquation','blendEquationAlpha','premultipliedAlpha','alphaHash','alphaToCoverage','polygonOffset','polygonOffsetFactor','polygonOffsetUnits'];
export function sourceIdentity(descriptor){
 const map=descriptor.textureBindings?.map;
 return {...descriptor.source,type:descriptor.type,vertexColors:descriptor.vertexColors,hasAlphaTest:descriptor.alphaTest>0,
  mapRoles:Object.keys(descriptor.textureBindings??{}).filter(role=>!role.startsWith('uniform:')).sort(),attributeRoles:descriptor.shader?.attrs??[],normalMapType:descriptor.normalMapType,
  mapFormat:map?.format,mapColorSpace:map?.colorSpace};
}
/** One exact runtime contract must accept the source. No default Standard route. */
export function classifySurfaceFamily(descriptor){
 const source=sourceIdentity(descriptor),matches=[];
 for(const [name,classify,schema] of lanes){try{matches.push({name,program:classify(source),schema:schema(source)});}catch{}}
 if(matches.length!==1)throw new Error(`Expected exactly one source graph: ${source.key}; matched ${matches.length}`);
 return matches[0];
}
export function surfaceTextureRoles(descriptor){
 // ENV samplers are shared dynamic resources, while PBR/vegetation use their actual semantic pages.
 return Object.keys(descriptor.textureBindings??{}).filter(role=>!role.startsWith('uniform:')||['uniform:pbAlb','uniform:pbNrm','uniform:pbOrm','uniform:vgNrm'].includes(role)).sort();
}
/** Production grouping: original fixed state, actual graph composition and resident page identity only. */
export function identifySurfaceFamily(descriptor){
 const match=classifySurfaceFamily(descriptor),textureRoles=surfaceTextureRoles(descriptor);
 const texturePages=textureRoles.map(role=>{const page=descriptor.textureBindings[role]?.page;if(!Number.isInteger(page))throw new Error(`Missing packed page ${role}`);return{role,page};});
 const source=sourceIdentity(descriptor);
 return{name:match.name,supported:true,renderState:Object.fromEntries(SURFACE_FIXED_STATE.filter(name=>descriptor.state[name]!==undefined).map(name=>[name,descriptor.state[name]])),
  staticFlags:{renderOrder:descriptor.renderOrder,castShadow:descriptor.castShadow,receiveShadow:descriptor.receiveShadow,
   program:match.program,vertexColors:descriptor.vertexColors,hasAlphaTest:source.hasAlphaTest,mapRoles:source.mapRoles,
   ...(match.name==='source-pbr'?{pbrSet:descriptor.pbr.set}:{}),textureRoles,texturePages},
  requiredAttributes:[...new Set([...source.attributeRoles,...(descriptor.type==='MeshStandardMaterial'?['normal']:[]),...(descriptor.vertexColors?['color']:[]),...(textureRoles.length?['uv']:[])])]};
}
