// Polygon offsets under a reversed depth buffer.
//
// The ground layers lift themselves toward the camera with a negative
// polygon offset (roads -3/-6, sidewalks -2/-4, contact shadows and lamp pools
// -4/-8): three's convention for a standard depth buffer, where nearer is
// smaller. The physical stack builds its renderer with reversedDepthBuffer
// (physical-look.ts physicalRendererParams), where nearer is larger and the
// depth compare is greater-equal. three@0.186.1 flips the compare for that
// (WebGPUPipelineUtils `ReversedDepthFuncs`) but copies polygonOffsetUnits and
// polygonOffsetFactor into the pipeline's depthBias / depthBiasSlopeScale
// unchanged (WebGPUPipelineUtils.js, `depthStencil.depthBias =
// material.polygonOffsetUnits`). So every offset pushed its layer away from
// the camera, behind the surface it was meant to sit on: the contact-shadow
// strips at the foot of the walls, the curbs, the sidewalks and the lamp
// pools fought the ground and flickered as the Caller walked.
//
// This negates each offset once, on the materials under `root`, when the
// renderer runs reversed depth. A material is marked so a shared one is not
// flipped back by a second scene.
import type { Three } from '@acme/ui/three';

type Object3D = InstanceType<Three['Object3D']>;
interface OffsetMaterial {
  polygonOffset: boolean;
  polygonOffsetFactor: number;
  polygonOffsetUnits: number;
  userData: Record<string, unknown>;
  needsUpdate?: boolean;
}

const FLIPPED = 'reversedDepthOffset';

/** Negates the polygon offsets under `root` for a reversed depth buffer. Returns how many materials changed. */
export function applyReversedDepthOffsets(root: Object3D, renderer: { reversedDepthBuffer?: boolean } | null | undefined): number {
  if (renderer?.reversedDepthBuffer !== true) return 0;
  let changed = 0;
  root.traverse((object) => {
    const m = (object as unknown as { material?: OffsetMaterial | OffsetMaterial[] }).material;
    for (const material of Array.isArray(m) ? m : m ? [m] : []) {
      if (!material.polygonOffset || material.userData[FLIPPED] === true) continue;
      material.polygonOffsetFactor = -material.polygonOffsetFactor;
      material.polygonOffsetUnits = -material.polygonOffsetUnits;
      material.userData[FLIPPED] = true;
      material.needsUpdate = true;
      changed++;
    }
  });
  return changed;
}
