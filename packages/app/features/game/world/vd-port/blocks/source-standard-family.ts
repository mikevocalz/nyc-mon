import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { classifySourceStandard, type SourceStandardIdentity } from './source-standard-programs.ts';
import { createSourceStandardMaterial, type SourceRenderState } from './source-standard.ts';
import { createSourceLightingModel } from './source-lighting.ts';
import { sourceDiffuseTrim } from './source-light-trim.ts';
import type { SourceParameterBinding, SourceTextureBinding } from './source-bindings.ts';
export { classifySourceStandard, sourceStandardParameterSchema, SOURCE_STANDARD_PROGRAMS, type SourceStandardIdentity } from './source-standard-programs.ts';
type Common=Parameters<typeof createSourceLightingModel>[1];
export interface SourceStandardInput {
  name:string; source:SourceStandardIdentity; state:SourceRenderState; material:SourceParameterBinding; textures:SourceTextureBinding;
  rawUv:Node<'vec2'>; rawColor:Node<'vec3'>;
  common?:Pick<Common,'trim'|'cityAo'|'cityReflection'>;
}
/** Exact r185 derivative TBN, including its zero determinant and double-sided tangent signs. */
export function sourceStandardNormal(THREE:Three, sample:Node<'vec4'>, uv:Node<'vec2'>, scale:Node<'vec2'>, doubleSided:boolean):Node<'vec3'> {
  const T=THREE.TSL,n=T.normalView,dp0=T.dFdx(T.positionView),dp1=T.dFdy(T.positionView),st0=T.dFdx(uv),st1=T.dFdy(uv);
  const q1=T.cross(dp1,n),q0=T.cross(n,dp0),t=q1.mul(st0.x).add(q0.mul(st1.x)),b=q1.mul(st0.y).add(q0.mul(st1.y));
  const det=T.max(T.dot(t,t),T.dot(b,b)),inv=T.select(det.equal(0),0,T.inverseSqrt(det));
  const sign=doubleSided?T.faceDirection:T.float(1),map=sample.xyz.mul(2).sub(1);
  return T.normalize(t.mul(inv).mul(sign).mul(map.x).mul(scale.x).add(b.mul(inv).mul(sign).mul(map.y).mul(scale.y)).add(n.mul(map.z)));
}
export function createSourceStandardFamily(THREE:Three,input:SourceStandardInput) {
  const flags=classifySourceStandard(input.source),T=THREE.TSL,m=input.material,roles=new Set(input.source.mapRoles);
  const sampled=new Map<string,Node<'vec4'>>(),uvs=new Map<string,Node<'vec2'>>();
  for(const role of roles){const uv=input.textures.uv(role,input.rawUv);uvs.set(role,uv);sampled.set(role,input.textures.sample(role,uv));}
  let color=input.source.vertexColors?m.vec3('diffuse').mul(input.rawColor):m.vec3('diffuse'),opacity=m.scalar('opacity');
  if(roles.has('map')){color=color.mul(sampled.get('map')!.rgb);opacity=opacity.mul(sampled.get('map')!.a);}
  if(roles.has('alphaMap'))opacity=opacity.mul(sampled.get('alphaMap')!.g);
  const alphaTest=m.scalar('alphaTest');
  if(flags.basic){
    const material=new THREE.MeshBasicNodeMaterial();material.name=input.name;Object.assign(material,input.state);
    material.colorNode=color;material.opacityNode=opacity;if(input.source.hasAlphaTest)material.alphaTestNode=alphaTest;return material;
  }
  const common=input.common;
  if(flags.trim&&!common?.trim)throw new Error('Missing authored standard LT bindings');
  if(flags.cityAo&&!common?.cityAo)throw new Error('Missing authored standard city AO bindings');
  if((flags.cs34||flags.pbrCity)&&!common?.cityReflection)throw new Error('Missing authored standard reflection bindings');
  if(flags.trim)color=color.mul(sourceDiffuseTrim(THREE,common!.trim!));
  let roughness=m.scalar('roughness'),metalness=m.scalar('metalness');
  if(roles.has('roughnessMap'))roughness=roughness.mul(sampled.get('roughnessMap')!.g);
  if(roles.has('metalnessMap'))metalness=metalness.mul(sampled.get('metalnessMap')!.b);
  const reflection=common?.cityReflection;
  return createSourceStandardMaterial(THREE,{name:input.name,state:input.state,envMapIntensityNode:m.scalar('envMapIntensity'),
    lightingModel:()=>createSourceLightingModel(THREE,{trim:flags.trim?common!.trim:undefined,cityAo:flags.cityAo?common!.cityAo:undefined,
      cityReflection:reflection&&(flags.cs34||flags.pbrCity)?{...reflection,pbrCity:flags.pbrCity,...(!flags.cs34?{cs34:T.vec4(0)}:{})}:undefined}),
    surface:{color,opacity,emission:m.vec3('emissive').mul(m.scalar('emissiveIntensity')),roughness,metalness,
      ...(roles.has('normalMap')?{normal:sourceStandardNormal(THREE,sampled.get('normalMap')!,uvs.get('normalMap')!,m.vec2('normalScale'),input.state.side===THREE.DoubleSide)}:{}),
      alphaTest,hasAlphaTest:input.source.hasAlphaTest}});
}
