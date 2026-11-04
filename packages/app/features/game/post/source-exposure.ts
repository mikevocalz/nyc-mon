import type { Three } from '@acme/ui/three';
import type { WebGPURenderer } from 'three/webgpu';
import type { SourceLook } from '../world/source-look.ts';

/** Source engine's geometry-only 32² log-luminance meter; one bounded readback at a time. */
export function createSourceExposure(THREE: Three, renderer: WebGPURenderer,
  input: {color: InstanceType<Three['Texture']>;depth: InstanceType<Three['Texture']>}, wake: () => void) {
  const T=THREE.TSL, exposure=T.uniform(1);
  const target=new THREE.RenderTarget(32,32,{type:THREE.UnsignedByteType,depthBuffer:false});
  target.texture.name='Valdrada:exposure-meter';target.texture.colorSpace=THREE.NoColorSpace;
  const material=new THREE.NodeMaterial(); material.depthTest=false;material.depthWrite=false;material.toneMapped=false;
  const color=T.texture(input.color,T.uv()),depth=T.texture(input.depth,T.uv()).r;
  const counts=renderer.reversedDepthBuffer ? depth.greaterThan(.000005) : depth.lessThan(.999995);
  const weight=T.select(counts,1,0);
  const luma=T.dot(color.rgb,T.vec3(.2126,.7152,.0722));
  material.fragmentNode=T.vec4(T.clamp(T.log2(luma.add(.0001)).div(16).add(.5),0,1).mul(weight),weight,0,1);
  const quad=new THREE.QuadMesh(material);
  let look:SourceLook|undefined,auto=1,frames=0,closed=false,warned=false,pending:Promise<void>|undefined;
  const apply=()=>{if(look)exposure.value=look.exposure.base*(1+(auto-1)*look.exposure.strength);};
  const disposeResources=()=>{material.dispose();target.dispose();};
  return {
    exposure,
    update(value:SourceLook){look=value;apply();},
    /** Called while the render delegate is still in direct-render scope, after the real scene target is complete. */
    afterRender(){
      if(closed||!look||++frames%8!==3||pending)return;
      const previousTarget=renderer.getRenderTarget(),previousMrt=renderer.getMRT();
      const face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
      let pixels:ReturnType<WebGPURenderer['readRenderTargetPixelsAsync']>;
      try {
        renderer.setRenderTarget(target);renderer.setMRT(null);quad.render(renderer);
        pixels=renderer.readRenderTargetPixelsAsync(target,0,0,32,32);
      } catch(error){
        if(!warned){warned=true;console.warn('[NYC-Mon/exposure] source meter readback unavailable',error);}return;
      } finally {renderer.setRenderTarget(previousTarget,face,mip);renderer.setMRT(previousMrt);}
      pending=pixels.then(bytes=>{
        if(closed||!look)return;
        let sum=0,weightSum=0;
        for(let i=0;i<1024;i++){sum+=bytes[i*4]!;weightSum+=bytes[i*4+1]!/255;}
        if(weightSum<24)return;
        const average=2**((sum/weightSum/255-.5)*16);
        if(!Number.isFinite(average))throw new Error('Nonfinite source exposure meter');
        const e=look.exposure,want=Math.min(e.max,Math.max(e.min,e.target/Math.max(average,.0001)));
        const previous=auto;auto+=(want-auto)*e.rate;apply();
        if(Math.abs(auto-previous)>.0001)wake();
      }).catch(error=>{
        if(!closed&&!warned){warned=true;console.warn('[NYC-Mon/exposure] source meter readback unavailable',error);}
      }).finally(()=>{pending=undefined;});
    },
    dispose():void|Promise<void>{
      if(closed)return pending;closed=true;
      if(pending)return pending.then(disposeResources);
      disposeResources();
    },
  };
}
