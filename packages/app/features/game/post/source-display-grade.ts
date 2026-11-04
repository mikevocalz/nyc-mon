import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import type { SourceLook } from '../world/source-look.ts';
import { lut3D } from 'three/examples/jsm/tsl/display/Lut3DNode.js';
import authoredLut from './source-teal-orange.json' with { type: 'json' };

/** Valdrada 2724c79 engine GradeShader and LUTPass, after the sole output transform. */
export function createSourceDisplayGrade(THREE: Three, hdr: Node<'vec4'>) {
  const T = THREE.TSL;
  const display = T.rtt(T.renderOutput(hdr, THREE.AgXToneMapping, THREE.SRGBColorSpace), null, null, { depthBuffer: false });
  const scalar = () => T.uniform(0);
  const vig=scalar(),sat=scalar(),con=scalar(),warm=scalar(),tint=scalar(),sharp=scalar(),definition=scalar();
  const grain=scalar(),ca=scalar(),time=scalar(),black=scalar(),white=T.uniform(1),hi=scalar(),edge=scalar(),lutAmount=scalar();
  const lut = new THREE.Data3DTexture(new Uint8Array(authoredLut.rgba), authoredLut.size, authoredLut.size, authoredLut.size);
  lut.name='Valdrada:teal_orange'; lut.format=THREE.RGBAFormat; lut.type=THREE.UnsignedByteType;
  lut.minFilter=lut.magFilter=THREE.LinearFilter; lut.wrapS=lut.wrapT=lut.wrapR=THREE.ClampToEdgeWrapping;
  lut.generateMipmaps=false; lut.colorSpace=THREE.NoColorSpace; lut.needsUpdate=true;
  const grade = T.Fn(() => {
    const uv=T.screenUV, texel=T.vec2(1).div(T.screenSize), weights=T.vec3(.2126,.7152,.0722);
    const color=display.sample(uv).rgb.toVar();
    const radial=uv.sub(.5), offset=radial.mul(T.dot(radial,radial)).mul(ca).mul(.014);
    T.If(ca.greaterThan(.003),()=>{color.r.assign(display.sample(uv.add(offset)).r);color.b.assign(display.sample(uv.sub(offset)).b);});
    T.If(sharp.greaterThan(.003),()=>{
      const sum=display.sample(uv.add(T.vec2(texel.x,0))).rgb.add(display.sample(uv.sub(T.vec2(texel.x,0))).rgb)
        .add(display.sample(uv.add(T.vec2(0,texel.y))).rgb).add(display.sample(uv.sub(T.vec2(0,texel.y))).rgb);
      color.addAssign(T.clamp(color.sub(sum.mul(.25)).mul(sharp),-.05,.05));
    });
    T.If(definition.greaterThan(.003),()=>{
      const t=texel.mul(4),sum=T.float(0).toVar();
      for(const [x,y] of [[1,1],[-1,1],[1,-1],[-1,-1],[1.6,0],[-1.6,0],[0,1.6],[0,-1.6]]) {
        sum.addAssign(T.dot(display.sample(uv.add(t.mul(T.vec2(x!,y!)))).rgb,weights));
      }
      const l=T.dot(color,weights), hp=l.sub(sum.mul(.125));
      const mid=T.smoothstep(.02,.18,l).mul(T.float(1).sub(T.smoothstep(.72,1,l)));
      const gain=T.clamp(hp.mul(definition).mul(1.4),-.12,.12).mul(mid)
        .mul(T.float(1).sub(edge.mul(T.smoothstep(.06,.22,T.abs(hp)))));
      color.mulAssign(T.float(1).add(gain.div(T.max(l,.06))));
    });
    color.assign(T.clamp(color.sub(black).div(T.max(white.sub(black),.5)),0,1));
    color.assign(T.mix(color,color.mul(color).mul(T.vec3(3).sub(color.mul(2))),con));
    color.addAssign(T.smoothstep(.55,1,color).mul(T.vec3(1).sub(color)).mul(hi).mul(4));
    const l0=T.dot(color,weights), sh=T.float(1).sub(T.smoothstep(.10,.72,l0));
    color.addAssign(T.vec3(warm,warm.mul(.45),warm.mul(-.6)).mul(sh));
    color.addAssign(T.vec3(tint.mul(-.55),tint,tint.mul(-.4)).mul(T.float(.35).add(l0.mul(.65))));
    const l=T.dot(color,weights);
    color.assign(T.mix(T.vec3(l),color,sat));
    color.addAssign(T.vec3(.005,.006,.01).mul(T.float(1).sub(l)));
    color.mulAssign(T.float(1).sub(vig.mul(T.smoothstep(.35,.95,T.dot(radial,radial).mul(2.6)))));
    T.If(grain.greaterThan(.001),()=>{
      const noise=T.fract(T.sin(T.dot(uv.mul(1447).add(T.fract(time).mul(91.7)),T.vec2(12.9898,78.233))).mul(43758.5453)).sub(.5);
      const lg=T.dot(color,T.vec3(.299,.587,.114));
      const weight=T.float(.35).add(T.smoothstep(0,.35,lg).mul(T.float(1).sub(T.smoothstep(.6,1,lg))).mul(.65));
      color.addAssign(noise.mul(grain).mul(weight));
    });
    return T.vec4(color,1);
  })();
  const outputNode=lut3D(grade,T.texture3D(lut),authoredLut.size,lutAmount);
  return {
    outputNode,
    update(look: SourceLook,timeSeconds=0,reducedMotion=false) {
      const g=look.grade;
      vig.value=g.vignette;sat.value=g.saturation;con.value=g.contrast;warm.value=g.warmth;tint.value=g.tint;
      sharp.value=g.sharpness;definition.value=g.definition;grain.value=g.grain;ca.value=g.chromaticAberration;
      time.value=reducedMotion?0:timeSeconds;black.value=g.blackPoint;white.value=g.whitePoint;hi.value=g.highlightLift;edge.value=g.definitionEdge;
      if(g.lut!=='none'&&g.lut!=='teal_orange')throw new Error(`Unsupported authored display LUT: ${g.lut}`);
      lutAmount.value=g.lut==='teal_orange'?g.lutAmount:0;
    },
    dispose(){display.dispose();lut.dispose();},
  };
}
