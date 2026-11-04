import type { Three } from '@acme/ui/three';
import type { Camera, Scene, WebGPURenderer } from 'three/webgpu';
import { LightProbeGenerator } from 'three/examples/jsm/lights/LightProbeGenerator.js';
import type { SourceLook } from './source-look.ts';

/** Scene-owned source SH-L2 capture. Caller invokes after the main render in the
 * post owner's direct-render scope. One real face per drawn frame, one readback
 * outstanding; no probe compensation until an authenticated finite capture lands. */
export function createSourceLightProbe(THREE:Three,renderer:WebGPURenderer,scene:Scene,changed:()=>void){
 const probe=new THREE.LightProbe();probe.name='city:source-irradiance-probe';probe.intensity=0;scene.add(probe);
 const target=new THREE.CubeRenderTarget(32,{type:THREE.HalfFloatType,generateMipmaps:false});
 const cube=new THREE.CubeCamera(2,350,target);(cube as unknown as {isCubeCamera:boolean}).isCubeCamera=true;
 type ShadowState={shadow:{autoUpdate:boolean;needsUpdate:boolean};auto:boolean;needs:boolean};
 const shadowStates:ShadowState[]=[];
 scene.traverse(object=>{
  const shadow=(object as unknown as {castShadow?:boolean;shadow?:ShadowState['shadow']}).shadow;
  if(shadow)shadowStates.push({shadow,auto:shadow.autoUpdate,needs:shadow.needsUpdate});
 });
 let closed=false,generation=0,frames=0,warm=0,face=-1,has=false,on=0;
 let drain:Promise<void>|undefined;
 let captureGeneration=0,pending:Promise<void>|null=null,look:SourceLook|null=null;
 function reset(){generation++;face=-1;warm=0;has=false;on=0;probe.intensity=0;changed();}
 function settle(){
  const epoch=captureGeneration;
  const operation=LightProbeGenerator.fromCubeRenderTarget(renderer,target).then(result=>{
   if(closed||epoch!==generation||!look)return;
   const coefficients=result.sh.coefficients;
   if(!coefficients.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z)))return;
   const c0=coefficients[0]!,luma=.2126*c0.x+.7152*c0.y+.0722*c0.z;
   const floor=look.probeFloor,fl=floor ? .2126*floor[0]+.7152*floor[1]+.0722*floor[2] : 0;
   if(luma>1e4||!(luma>.3||fl>1e-4))return;
   if(floor&&fl>1e-4){const k=3.5449077/.45;c0.x+=floor[0]*k;c0.y+=floor[1]*k;c0.z+=floor[2]*k;}
   if(has)probe.sh.lerp(result.sh,.4);else probe.sh.copy(result.sh);
   has=true;warm++;changed();
  }).catch(()=>{
   // Source rejects failed/dark captures without subtracting the authored hemi.
  }).finally(()=>{if(pending===operation)pending=null;});
  pending=operation;
 }
 return {
  get preparation(){
   if(cube.coordinateSystem!==renderer.coordinateSystem){cube.coordinateSystem=renderer.coordinateSystem;cube.updateCoordinateSystem();}
   cube.updateMatrixWorld(true);
   return {target,camera:cube.children[0] as Camera};
  },
  get probeOn(){return on;},
  get busy(){return face>=0||pending!==null;},
  setLook(next:SourceLook){const previous=look;look=next;if(previous&&previous.sourceMode!==next.sourceMode)reset();probe.intensity=next.probeIntensity;},
  afterRender(camera:Camera,dt:number){
   if(closed||!look)return;
   if(has){const previous=on;on=Math.min(1,on+Math.max(0,Math.min(dt,.25))*.7);if(on!==previous)changed();}
   if(warm<5||face>=0||pending)changed();
   frames++;
   if(face<0&&!pending&&(warm<5?frames%24===12:frames%150===40)){
    captureGeneration=generation;face=0;cube.position.copy(camera.position);
    cube.layers.mask=camera.layers.mask;
    if(cube.coordinateSystem!==renderer.coordinateSystem){cube.coordinateSystem=renderer.coordinateSystem;cube.updateCoordinateSystem();}
    cube.updateMatrixWorld(true);
   }
   if(face<0||pending)return;
   const oldTarget=renderer.getRenderTarget(),oldFace=renderer.getActiveCubeFace(),oldMip=renderer.getActiveMipmapLevel(),xr=renderer.xr.enabled;
   const oldMrt=renderer.getMRT();
   for(const saved of shadowStates){saved.auto=saved.shadow.autoUpdate;saved.needs=saved.shadow.needsUpdate;saved.shadow.autoUpdate=false;saved.shadow.needsUpdate=false;}
   try{
    renderer.xr.enabled=false;renderer.setMRT(null);renderer.setRenderTarget(target,face,0);
    renderer.render(scene,cube.children[face] as Camera);
    face++;if(face===6){face=-1;settle();}
   }finally{
    for(const saved of shadowStates){saved.shadow.autoUpdate=saved.auto;saved.shadow.needsUpdate=saved.needs;}
    renderer.setRenderTarget(oldTarget,oldFace,oldMip);renderer.setMRT(oldMrt);renderer.xr.enabled=xr;
   }
  },
  reset,
  dispose():void|Promise<void>{
   if(closed)return drain;closed=true;generation++;face=-1;probe.intensity=0;probe.removeFromParent();
   const release=()=>{target.dispose();probe.dispose();};
   if(pending){drain=pending.then(release);return drain;}release();
  },
 };
}
