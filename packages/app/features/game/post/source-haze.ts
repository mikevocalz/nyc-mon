import type { Three } from '@acme/ui/three';
import type { Camera, Node, NodeBuilder } from 'three/webgpu';
import type { SourceLook, SourceRgb } from '../world/source-look.ts';

/** Pinned engine HazePass, before HDR bloom. Depth reconstruction delegates to
 * r187 getViewPosition so WebGPU [0,1]/reversed depth and texture Y agree. */
export function createSourceHaze(THREE:Three,color:Node<'vec4'>,depth:Node<'float'>,camera:Camera,look:SourceLook){
 const T=THREE.TSL;
 const inverseProjection=T.uniform(camera.projectionMatrixInverse.clone()),cameraWorld=T.uniform(camera.matrixWorld.clone());
 inverseProjection.onRenderUpdate((_,self)=>{self.value.copy(camera.projectionMatrixInverse);});
 cameraWorld.onRenderUpdate((_,self)=>{self.value.copy(camera.matrixWorld);});
 const cameraPosition=T.uniform(new THREE.Vector3()).onRenderUpdate((_,self)=>{self.value.setFromMatrixPosition(camera.matrixWorld);}),origin=T.uniform(new THREE.Vector3()),sourceOffset=T.uniform(0);
 const density=T.uniform(0),falloff=T.uniform(0),anisotropy=T.uniform(0),sunBoost=T.uniform(0),baseY=T.uniform(-25);
 const skyAmount=T.uniform(0),glowMax=T.uniform(0),blue=T.uniform(0),minT=T.uniform(0),ringAmount=T.uniform(0);
 const sun=T.uniform(new THREE.Vector3()),sunColor=T.uniform(new THREE.Vector3()),fog=T.uniform(new THREE.Vector3());
 const values=Array.from({length:16},()=>new THREE.Vector3()),ring=T.uniformArray<'vec3'>(values,'vec3');
 const sky=T.Fn((_: readonly Node[],builder: NodeBuilder)=>builder.renderer.reversedDepthBuffer===true ? depth.lessThanEqual(.000005) : depth.greaterThanEqual(.999995))();
 const output=T.Fn(()=>{
  const result=color.toVar();
  T.If(density.greaterThanEqual(.000001).and(sky.not().or(skyAmount.greaterThanEqual(.0001))),()=>{
   const view=T.getViewPosition(T.uv(),depth,inverseProjection),distance=T.min(T.length(view),14000);
   const ray=T.normalize(cameraWorld.mul(T.vec4(view,0)).xyz);
   const h0=cameraPosition.y.add(origin.y).sub(sourceOffset).sub(baseY),ky=ray.y.mul(falloff);
   const horizontal=density.mul(T.exp(h0.mul(falloff).negate())).mul(distance);
   // Avoid a hidden 0/0 in the unselected near-horizontal branch on eager GPUs.
   const safeKy=T.select(T.abs(ky).greaterThan(.00001),ky,T.float(.00001));
   const integral=density.mul(T.exp(h0.mul(falloff).negate())).mul(T.float(1).sub(T.exp(ky.mul(distance).negate()))).div(safeKy);
   const od=T.select(T.abs(ky).greaterThan(.00001),integral,horizontal).mul(T.select(sky,skyAmount,T.float(1)));
   const transmittance=T.exp(T.max(od,0).negate()).toVar();
   const mu=T.dot(ray,sun),g2=anisotropy.mul(anisotropy);
   const phase=T.float(1).sub(g2).div(T.pow(T.float(1).add(g2).sub(anisotropy.mul(mu).mul(2)),1.5)).mul(.25);
   const sunUp=T.smoothstep(-.06,.12,sun.y),away=T.float(.5).sub(mu.mul(.5)),up=T.smoothstep(-.25,.35,ray.y);
   const az=T.atan(ray.z,ray.x.add(.000001)).add(3.14159265).mul(1.27323954),index=T.floor(az),fraction=T.fract(az);
   const i0=T.int(T.mod(index,8)),i1=T.int(T.mod(index.add(1),8));
   const lo=T.mix(ring.element(i0),ring.element(i1),fraction),hi=T.mix(ring.element(i0.add(8)),ring.element(i1.add(8)),fraction);
   const fogBase=T.mix(fog,T.mix(lo,hi,T.smoothstep(.02,.22,ray.y)),ringAmount);
   const fogColor=T.mix(fogBase,fogBase.mul(T.vec3(.70,.87,1.26)),blue.mul(T.mix(T.float(.45),T.float(1),T.max(away,up))).mul(T.float(1).sub(ringAmount)));
   const scattering=fogColor.add(sunColor.mul(T.min(phase.mul(sunBoost),glowMax)).mul(sunUp).mul(T.float(1).sub(ringAmount.mul(.6))));
   const ign=T.fract(T.fract(T.dot(T.screenCoordinate,T.vec2(.06711056,.00583715))).mul(52.9829189));
   transmittance.assign(T.clamp(transmittance.add(ign.sub(.5).mul(.012)),0,1));
   transmittance.assign(T.select(sky,transmittance,minT.add(T.float(1).sub(minT).mul(transmittance))));
   result.assign(T.vec4(T.mix(scattering,color.rgb,transmittance),color.a));
  });return result;
 })();
 let lastLook:SourceLook|undefined;
 function updateLook(next:SourceLook){
  if(next===lastLook)return;lastLook=next;
  const h=next.haze;density.value=h.density;falloff.value=h.falloff;anisotropy.value=h.g;sunBoost.value=h.sunBoost;baseY.value=h.baseY;
  skyAmount.value=h.skyAmount;glowMax.value=h.glowMax;blue.value=h.blue;minT.value=h.minTransmittance;ringAmount.value=h.ringAmount;
  sun.value.set(...next.sunDirection);sunColor.value.set(...next.sunColor);fog.value.set(...next.horizon);
  if(h.ring.length!==16)throw new Error('Source haze requires all sixteen authored sky-ring samples');
  h.ring.forEach((v,i)=>values[i]!.set(...v));
 }
 function updateCamera(options:{origin?:SourceRgb;sourceYOffset?:number}={}){
  inverseProjection.value.copy(camera.projectionMatrixInverse);cameraWorld.value.copy(camera.matrixWorld);
  cameraPosition.value.setFromMatrixPosition(camera.matrixWorld);origin.value.set(...(options.origin??[0,0,0]));sourceOffset.value=options.sourceYOffset??0;
 }
 updateLook(look);updateCamera();
 return {output,updateLook,updateCamera,dispose(){ /* Uniform nodes own no scene-external textures or GPU targets. */ }};
}
