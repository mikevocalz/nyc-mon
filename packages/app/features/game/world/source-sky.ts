import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { SkyMesh } from 'three/examples/jsm/objects/SkyMesh.js';
import type { SourceLook } from './source-look.ts';

/** Exact analytic Sky r185.1 + pinned Valdrada sky.js SH35/TW36/N11/CS25/CS36.
 * Separate visible/env meshes intentionally have different scattering and gain. */
export function createSourceSky(THREE: Three, environment = false, reversedDepth = false) {
 const T=THREE.TSL, sky=new SkyMesh();
 sky.name=environment?'city:source-environment-sky':'city:physical-sky';
 sky.scale.setScalar(20000);sky.frustumCulled=false;sky.renderOrder=1;
 sky.cloudCoverage.value=0;
 const gain=T.uniform(1),haze=T.uniform(0),glow=T.uniform(0),twilight=T.uniform(0),clock=T.uniform(0);
 const coverage=T.uniform(0),density=T.uniform(0),cirrus=T.uniform(0),height=T.uniform(2200);
 const cloudLit=T.uniform(new THREE.Vector3()),cloudShade=T.uniform(new THREE.Vector3());
 // CS36 wraps signed cell coordinates to uint32 before xor; never the old sin hash.
 const hash=T.Fn(([p]:[Node<'vec2'>])=>{
  const q=T.uvec2(T.ivec2(p)).mul(T.uvec2(1597334673,3812015801));
  return T.float(q.x.bitXor(q.y).mul(T.uint(1597334673))).mul(1/4294967295);
 });
 const noise=T.Fn(([p]:[Node<'vec2'>])=>{
  const i=T.floor(p),f=T.fract(p),u=f.mul(f).mul(T.vec2(3).sub(f.mul(2)));
  return T.mix(T.mix(hash(i),hash(i.add(T.vec2(1,0))),u.x),T.mix(hash(i.add(T.vec2(0,1))),hash(i.add(1)),u.x),u.y);
 });
 const fbm=T.Fn(([input]:[Node<'vec2'>])=>{
  const p=input.toVar(),value=T.float(0).toVar();let amplitude=.5;
  for(let i=0;i<5;i++){
   value.addAssign(noise(p).mul(amplitude));
   // GLSL column-major mat2(.8,-.6,.6,.8).
   p.assign(T.vec2(p.x.mul(.8).add(p.y.mul(.6)),p.x.mul(-.6).add(p.y.mul(.8))).mul(2.03).add(17.1));amplitude*=.5;
  }
  return value;
 });
 const cumulus=T.Fn(([q]:[Node<'vec2'>])=>{
  const warp=T.vec2(fbm(q.mul(.7).add(3.1)),fbm(q.mul(.7).sub(5.7)));
  return T.smoothstep(T.float(1).sub(coverage),T.float(1.28).sub(coverage),fbm(q.add(warp.mul(1.6))));
 });
 const clouds=T.Fn(([dir,base,sun]:[Node<'vec3'>,Node<'vec3'>,Node<'vec3'>])=>{
  const col=base.toVar();
  T.If(dir.y.greaterThan(.004).and(coverage.greaterThan(0).or(cirrus.greaterThan(0))),()=>{
   const mu=T.dot(dir,sun),fade=T.smoothstep(.004,.18,dir.y),wind=T.vec2(1,.35);
   T.If(cirrus.greaterThan(0),()=>{
    const pc=dir.xz.div(dir.y).mul(height.mul(4).div(9000)).add(wind.mul(clock).mul(.004));
    const ps=T.vec2(pc.x.mul(.35).add(pc.y.mul(.9)),pc.y.mul(.35).sub(pc.x.mul(.9)));
    const c=T.smoothstep(.18,.46,fbm(T.vec2(ps.x.mul(.4),ps.y.mul(3))).mul(fbm(ps.mul(1.3).add(7)))).mul(cirrus).mul(fade);
    const fwd=T.float(1).add(T.pow(T.max(mu,0),6).mul(1.6));
    col.assign(T.mix(col,cloudLit.mul(.9).mul(fwd).add(cloudShade.mul(.3)),c.mul(.55)));
   });
   T.If(coverage.greaterThan(0),()=>{
    const q=dir.xz.div(dir.y).mul(height).div(2600).add(wind.mul(clock).mul(.01)),d=cumulus(q);
    T.If(d.greaterThan(.001),()=>{
     const toSun=T.normalize(sun.xz.add(.0001));
     const shadow=T.exp(cumulus(q.add(toSun.mul(.06))).mul(.65).add(cumulus(q.add(toSun.mul(.16))).mul(.55)).mul(-2.6));
     const fwd=T.float(1).add(T.pow(T.max(mu,0),8).mul(2.4).mul(T.float(1).sub(d)));
     const lit=cloudLit.mul(shadow).mul(fwd).add(cloudShade.mul(T.float(1).sub(d).mul(.45).add(.55)));
     const aerial=T.float(1).sub(T.exp(T.float(-.08).div(T.max(dir.y,.02))));
     col.assign(T.mix(col,T.mix(lit,base,aerial.mul(.6)),T.clamp(d.mul(density),0,1).mul(fade)));
    });
   });
  });return col;
 });
 sky.material.colorNode=T.Fn(()=>{
  const dir=T.normalize(T.positionWorld.sub(T.cameraPosition)),sun=T.normalize(sky.sunPosition);
  const sunE=T.max(T.float(0),T.float(1).sub(T.exp(T.float(1.6110731556870734).sub(T.acos(T.clamp(sun.y,-1,1))).div(-1.5)))).mul(1000);
  const sunfade=T.float(1).sub(T.clamp(T.float(1).sub(T.exp(sky.sunPosition.y.div(450000))),0,1));
  const betaR=T.vec3(5.804542996261093e-6,1.3562911419845635e-5,3.0265902468824876e-5).mul(sky.rayleigh.sub(T.float(1).sub(sunfade)));
  const betaM=T.vec3(1.8399918514433978e14,2.7798023919660528e14,4.0790479543861094e14).mul(sky.turbidity.mul(.2).mul(1e-17).mul(.434)).mul(sky.mieCoefficient);
  const angle=T.acos(T.max(dir.y,0)),inverse=T.float(1).div(T.cos(angle).add(T.pow(T.float(93.885).sub(angle.mul(180/Math.PI)),-1.253).mul(.15)));
  const extinction=T.exp(betaR.mul(inverse.mul(8400)).add(betaM.mul(inverse.mul(1250))).negate());
  const mu=T.dot(dir,sun),g=sky.mieDirectionalG,g2=g.mul(g);
  const rayleigh=T.pow(mu.mul(.5).add(.5),2).add(1).mul(.05968310365946075);
  const mie=T.float(1).sub(g2).div(T.pow(T.float(1).sub(g.mul(mu).mul(2)).add(g2),1.5)).mul(.07957747154594767);
  const scattering=betaR.mul(rayleigh).add(betaM.mul(mie)).div(betaR.add(betaM)).mul(sunE);
  const lin=T.pow(scattering.mul(T.vec3(1).sub(extinction)),T.vec3(1.5)).mul(T.mix(T.vec3(1),T.pow(scattering.mul(extinction),T.vec3(.5)),T.clamp(T.pow(T.float(1).sub(sun.y),5),0,1)));
  const disc=T.smoothstep(.9999566769464484,.9999766769464484,mu).mul(sky.showSunDisc);
  const raw=lin.add(extinction.mul(.1).add(extinction.mul(sunE).mul(19000).mul(disc))).mul(.04).add(T.vec3(0,.0003,.00075));
  const sh35=T.mix(raw,T.dot(raw,T.vec3(.2126,.7152,.0722)).mul(T.vec3(.90,1,1.16)),haze).mul(gain);
  const h=T.max(dir.y,0),sl=T.length(sun.xz),dl=T.length(dir.xz);
  const toward=T.select(sl.greaterThan(.0001).and(dl.greaterThan(.0001)),T.dot(dir.xz.div(T.max(dl,.0001)),sun.xz.div(T.max(sl,.0001))).mul(.5).add(.5),T.float(.5));
  const t3=T.pow(toward,3),hz=T.mix(T.vec3(.060,.090,.180),T.vec3(.700,.250,.085),t3.mul(t3));
  const tw=T.mix(T.vec3(.015,.041,.123).mul(toward.mul(.3).add(.85)),hz,T.exp(h.mul(T.mix(T.float(4),T.float(9),t3)).negate())).mul(twilight).mul(T.mix(T.float(.35),T.float(1),T.smoothstep(-.25,0,dir.y)));
  const gh=T.clamp(dir.y,-.30,1),band=T.exp(T.max(gh,0).mul(-6.5)),az=T.atan(dir.z,dir.x);
  const lobes=T.sin(az.add(.7)).mul(.3).add(T.sin(az.mul(2).sub(1.3)).mul(.14)).add(1);
  const night=T.mix(T.vec3(.0125,.0135,.0178),T.vec3(.062,.048,.038),band).mul(glow).mul(T.max(lobes,.35)).mul(T.mix(T.float(.55),T.float(1),T.smoothstep(-.30,.02,gh)));
  return T.vec4(T.min(clouds(dir,sh35.add(tw),sun).add(night),T.vec3(5)),1);
 })();
 if(reversedDepth){const vertex=sky.material.vertexNode as Node<'vec4'>;sky.material.vertexNode=T.Fn(()=>{const p=vertex.toVar();p.z.assign(0);return p;})();}
 function apply(look:SourceLook){
  sky.turbidity.value=environment?8:look.sky.turbidity;sky.rayleigh.value=environment?3:look.sky.rayleigh;
  sky.mieCoefficient.value=environment ? .0002 : look.sky.mieCoefficient;sky.mieDirectionalG.value=environment ? .7 : look.sky.mieDirectionalG;
  sky.sunPosition.value.set(...look.sunDirection);sky.showSunDisc.value=environment?0:1;
  gain.value=environment?(look.sourceMode==='night' ? .12 : 1):look.sky.gain;haze.value=look.sky.haze;glow.value=look.sky.nightGlow;twilight.value=look.sourceMode==='dusk'?1:0;
  const golden=look.sourceMode==='golden';coverage.value=golden ? .35 : 0;density.value=golden ? .9 : 0;cirrus.value=golden ? .5 : 0;height.value=2200;
  cloudLit.value.set(...look.sunColor).multiplyScalar(golden?1.6:0);cloudShade.value.set(...look.skyAmbient).multiplyScalar(golden ? .55 : 0);
 }
 return {sky,apply,update(time:number){clock.value=time;},dispose(){sky.removeFromParent();sky.geometry.dispose();sky.material.dispose();}};
}
