import type { WalkableTest } from './locomotion.ts';

/** LOD replacement can introduce centimetres of overlap at an otherwise valid
 * saved position. This correction never enlarges the body or invokes the broad
 * spawn search: at most half a metre, once per collision revision. */
export const DEPENETRATION_RADIUS = .5;
const RING_STEP = .025;
const DIRECTIONS = Array.from({length:32},(_,i)=>{
 const angle=i*Math.PI*2/32;return {x:Math.sin(angle),z:Math.cos(angle)};
});

/** Nearest safe point on a bounded radial stencil, refined to <0.1 mm along
 * each successful ray. Null means no safe local correction was established;
 * the controller keeps the old position rather than teleporting elsewhere. */
export function findLocalSeparation(x:number,z:number,walkable:WalkableTest):{x:number;z:number}|null{
 if(!Number.isFinite(x)||!Number.isFinite(z))return null;
 if(walkable(x,z))return {x,z};
 for(let ring=1;ring<=Math.round(DEPENETRATION_RADIUS/RING_STEP);ring++){
  const radius=ring*RING_STEP;
  let nearest:{x:number;z:number}|null=null,nearestDistance=Infinity;
  for(const direction of DIRECTIONS){
   if(!walkable(x+direction.x*radius,z+direction.z*radius))continue;
   let blocked=(ring-1)*RING_STEP,safe=radius;
   for(let iteration=0;iteration<9;iteration++){
    const mid=(blocked+safe)/2;
    if(walkable(x+direction.x*mid,z+direction.z*mid))safe=mid;else blocked=mid;
   }
   if(safe<nearestDistance){nearestDistance=safe;nearest={x:x+direction.x*safe,z:z+direction.z*safe};}
  }
  if(nearest)return nearest;
 }
 return null;
}
