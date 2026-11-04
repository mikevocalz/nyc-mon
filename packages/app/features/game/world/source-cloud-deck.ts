import type { Three } from '@acme/ui/three';
import type { Camera, Node } from 'three/webgpu';
import type { SourceLook } from './source-look.ts';

/** Pinned weather.js camera-following cloud sheet, distinct from CS25's golden sky. */
export function createSourceCloudDeck(THREE:Three){
 const T=THREE.TSL,time=T.uniform(0),cover=T.uniform(0),flash=T.uniform(0),lit=T.uniform(new THREE.Vector3(1,1,1));
 const hash=T.Fn(([p]:[Node<'vec2'>])=>{
  const q=T.fract(T.vec3(p.x,p.y,p.x).mul(.1031)).toVar();
  q.addAssign(T.dot(q,q.yzx.add(33.33)));
  return T.fract(q.x.add(q.y).mul(q.z));
 });
 const noise=T.Fn(([p]:[Node<'vec2'>])=>{
  const i=T.floor(p),f=T.fract(p),u=f.mul(f).mul(T.vec2(3).sub(f.mul(2)));
  return T.mix(T.mix(hash(i),hash(i.add(T.vec2(1,0))),u.x),T.mix(hash(i.add(T.vec2(0,1))),hash(i.add(1)),u.x),u.y);
 });
 const material=new THREE.NodeMaterial();material.transparent=true;material.depthWrite=false;material.fog=false;material.side=THREE.DoubleSide;
 material.fragmentNode=T.Fn(()=>{
  const uv=T.uv(),p=uv.mul(34).add(T.vec2(time.mul(.008),time.mul(.003))).toVar(),f=T.float(0).toVar();
  let amplitude=.5;
  for(let i=0;i<5;i++){f.addAssign(noise(p).mul(amplitude));p.mulAssign(2.03);amplitude*=.5;}
  const coverage=T.smoothstep(T.float(1.08).sub(cover.mul(.95)),T.float(1.34).sub(cover.mul(.8)),f);
  const shade=T.mix(T.float(.98),T.float(.52),coverage.mul(T.float(.35).add(cover.mul(.65))));
  const color=T.vec3(1.02,1,.975).mul(lit).mul(shade).mul(T.float(1).add(flash.mul(3)));
  const edge=T.smoothstep(0,.12,uv.x).mul(T.float(1).sub(T.smoothstep(.88,1,uv.x)))
   .mul(T.smoothstep(0,.12,uv.y)).mul(T.float(1).sub(T.smoothstep(.88,1,uv.y)));
  const radial=T.float(1).sub(T.smoothstep(.3,.485,T.length(uv.sub(.5))));
  return T.vec4(color,coverage.mul(.82).mul(edge).mul(radial));
 })();
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(14000,14000,1,1),material);
 mesh.name='city:source-weather-clouds';mesh.rotation.x=-Math.PI/2;mesh.visible=false;
 let look:SourceLook|undefined;
 return {mesh,
  apply(value:SourceLook){look=value;mesh.visible=value.clouds.visible;cover.value=value.clouds.cover;flash.value=value.clouds.flash;lit.value.set(...value.clouds.lit);},
  update(camera:Camera,seconds:number,sourceYOffset=0){time.value=seconds;mesh.position.set(camera.position.x,(look?.clouds.height??780)+sourceYOffset,camera.position.z);},
  dispose(){mesh.removeFromParent();mesh.geometry.dispose();material.dispose();},
 };
}
