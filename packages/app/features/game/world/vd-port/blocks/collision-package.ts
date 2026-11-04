import type { Three } from '@acme/ui/three';
import type { CellPackage } from '../../cells/cell-rules.ts';
import { prepareTriangleCollision, type TriangleCollision } from '../../../triangle-collision.ts';
import type { createResidentCollisionScene } from '../../../resident-collision.ts';

/** Shares the decoder's prepared arrays, then owns only compact collision data.
 * BVH construction follows the streamer's same deadline before GPU attachment. */
export function collisionPackage(THREE: Three, pkg: CellPackage, scene: ReturnType<typeof createResidentCollisionScene>,
  region: readonly [number, number, number, number, number, number], policy = { camera: true, body: true }): CellPackage {
  let steps: ReturnType<typeof prepareTriangleCollision> | undefined, proxy: TriangleCollision | undefined;
  let remove: (() => void) | undefined;
  const wrapped = Object.create(Object.getPrototypeOf(pkg), Object.getOwnPropertyDescriptors(pkg)) as CellPackage;
  wrapped.prepare = (deadline, now) => {
    if (proxy) return true;
    if (pkg.prepare && !pkg.prepare(deadline, now)) return false;
    if (!steps) {
      const position = pkg.attributes.position;
      if (!position || position.itemSize !== 3 || position.normalized) throw new Error('Building collision needs exact scene positions');
      const frame = pkg.positionFrame;
      steps = prepareTriangleCollision(THREE, { position: position.array, index: pkg.index,
        ...(frame ? { origin: frame.origin, ...(frame.scale ? { scale: frame.scale } : {}) } : {}), region });
    }
    while (now() < deadline) {
      const next = steps.next();
      if (next.done) { proxy = next.value; steps = undefined; return true; }
    }
    return false;
  };
  wrapped.onAttach = mesh => {
    if (!proxy) throw new Error('Collision proxy must be prepared before building attachment');
    remove?.(); remove = scene.add(proxy, policy, () => mesh.visible);
    pkg.onAttach?.(mesh);
  };
  wrapped.releaseResources = () => {
    remove?.(); remove = undefined; proxy = undefined;
    steps?.return(undefined as never); steps = undefined;
    pkg.releaseResources?.();
  };
  return wrapped;
}
