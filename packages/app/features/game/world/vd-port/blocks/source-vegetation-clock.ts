import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
/** Source weather.js wind policy and cpFloraKit DITH14, owned by one scene's source surface part. */
export function createSourceVegetationClock(THREE:Three,wet:Node<'float'>,snow:Node<'float'>){
 const T=THREE.TSL,windTime=T.uniform(0),fadeFrame=T.uniform(0);
 let previous:number|undefined,paused=false;
 return {dynamics:{windTime,fadeFrame,snow,windAmplitude:T.float(0.35).add(wet.mul(1.3)).add(snow.mul(0.3)),renderTargetHeight:T.screenSize.y},
  update(timeS:number,reducedMotion=false){
   if(!Number.isFinite(timeS)){previous=undefined;return;}
   if(reducedMotion){previous=timeS;paused=true;return;}
   if(previous!==undefined&&!paused)windTime.value+=Math.max(0,timeS-previous);
   previous=timeS;paused=false;fadeFrame.value=(fadeFrame.value+1)%64;
  }};
}
