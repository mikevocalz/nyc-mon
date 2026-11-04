import type { SurfaceFamily, SurfaceMaterial } from './surface-registry.ts';
import { classifySourcePbr } from './source-pbr-programs.ts';
import { classifyPilotFk } from './source-fk-programs.ts';
import { classifySourceSignMaterial } from './source-sign-programs.ts';
import { classifySourcePbrGlass } from './source-glass-programs.ts';
import { classifySourceStandard } from './source-standard-programs.ts';
import { classifyApolloSource } from './source-apollo-programs.ts';
import { classifyCustomBuildingSource } from './source-custom-building-programs.ts';
import { classifyVegetationSource } from './source-vegetation-programs.ts';

/** Triangle-only policy. Exclusions explicitly identify geometry needing authored alpha sampling or a nonstructural effect role. */
export interface SourceCollisionPolicy { camera: boolean; body: boolean; reason: string }

/** Verify the same strong program/attribute contract as rendering before assigning any collision role. */
export function sourceCollisionPolicy(family: SurfaceFamily, material: SurfaceMaterial): SourceCollisionPolicy {
 const identity={...material.source,type:material.type,vertexColors:material.vertexColors,
  hasAlphaTest:family.staticFlags.hasAlphaTest,mapRoles:Object.keys(material.textureBindings).filter(role=>!role.startsWith('uniform:')).sort(),
  attributeRoles:material.shader?.attrs ?? [],normalMapType:material.normalMapType};
 let apollo:ReturnType<typeof classifyApolloSource>|undefined;
 let sign:ReturnType<typeof classifySourceSignMaterial>|undefined;
 switch(family.name){
  case 'source-pbr':classifySourcePbr(identity);break;
  case 'source-fk':classifyPilotFk(identity);break;
  case 'source-sign':sign=classifySourceSignMaterial(identity);break;
  case 'source-glass':classifySourcePbrGlass(identity);break;
  case 'source-standard':classifySourceStandard(identity);break;
  case 'source-apollo':apollo=classifyApolloSource(identity);break;
  case 'source-custom-building':classifyCustomBuildingSource(identity);break;
  case 'source-vegetation':classifyVegetationSource(identity);break;
  default:throw new Error('Unknown authored source collision family');
 }
 const exclude=(reason:string)=>({camera:false,body:false,reason});
 if(family.name==='source-vegetation')return exclude('Authored foliage is nonstructural; alpha-shaped collision is not implemented');
 if(family.name==='source-glass' || (family.name==='source-fk' && material.source.key.startsWith('kitwinglass3|')))
  return {camera:true,body:true,reason:'Verified structural window pane; composited glass can occlude the camera'};
 if(apollo?.startsWith('a32tube'))return exclude('Verified Apollo emissive tube effect is nonstructural');
 if(sign?.program==='ar33sgH' || sign?.program==='ar33sgS3')return exclude('Verified additive/custom-composited SG light effect is nonstructural');
 if(family.staticFlags.hasAlphaTest)return exclude('Authored cutout requires alpha-sampled collision; triangle quads would close transparent holes');
 if(family.state.transparent || (family.state.blending!==0 && family.state.blending!==1))return exclude('Non-glass transparent/custom-blended surface has no structural collision contract');
 // cpFloraKit's empty :lod callback trigger writes neither color nor depth.
 // Require its verified stock Basic program and exact no-output/order contract.
 if(family.name==='source-standard' && material.source.shaderHash==='30f27eeb' && material.type==='MeshBasicMaterial' &&
  family.state.colorWrite===false && family.state.depthWrite===false && family.state.depthTest===false && family.staticFlags.renderOrder===-1000)
  return exclude('Verified cpFloraKit no-output LOD callback trigger is nonstructural');
 if(material.type==='MeshStandardMaterial')return {camera:true,body:true,reason:'Verified opaque non-cutout authored Standard triangles, including solid sign boards'};
 throw new Error(`Unknown authored collision role for ${family.name}:${material.source.key}`);
}
