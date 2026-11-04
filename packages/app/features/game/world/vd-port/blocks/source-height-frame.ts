import { VD_BLOCKS } from './data/manifest.ts';

/** The native pavement is flat; recover the nearest authored structure's
 * source height datum for atmosphere, independently of its render LOD. */
export function createSourceHeightFrame() {
  let lastX=NaN,lastZ=NaN,offset=0;
  return (x:number,z:number):number => {
    if(x===lastX&&z===lastZ)return offset;
    lastX=x;lastZ=z;
    let nearest=Infinity;
    for(const structure of VD_BLOCKS.structures){
      const b=structure.box,dx=Math.max(b[0]-x,0,x-b[3]),dz=Math.max(b[2]-z,0,z-b[5]);
      const distance=dx*dx+dz*dz;
      if(distance<nearest){nearest=distance;offset=VD_BLOCKS.curb-structure.base;}
    }
    return offset;
  };
}
