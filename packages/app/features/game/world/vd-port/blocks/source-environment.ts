// Valdrada sky.js CS34/ST34 preset update (736–745) and world/materials.js ENV @2724c79.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

/** Shared dynamic source bindings; census construction-time ENV values must not be frozen into material rows. */
export function sourceEnvironmentNodes(THREE: Three, night: Node<'float'>) {
  const T = THREE.TSL;
  const day = T.float(1).sub(T.smoothstep(0, 0.05, night));
  return {
    night,
    st34: T.vec4(T.float(1).sub(day.mul(0.5)), 0, 0, 0),
    cs34: T.vec4(day, day, day.mul(0.35), 0),
    cs34Col: T.vec4(1, 1, 0.97, 0.8),
    cityAOAmt: T.float(0.85),
    // Both LB14_DAY and LB14_R13 ship gao=0. The shader's parameter remains explicit.
    lb14Gao: T.float(0),
  };
}
