// Valdrada world/materials.js applyCityAO/RF13/LB14/N11 @2724c79 (MIT).
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

export interface SourceCityAoInputs {
  /** Absolute source-world coordinates, including the current render-origin translation. */
  position: Node<'vec3'>;
  normal: Node<'vec3'>;
  /** Authored visibility/terrain RG sample, sampled using (position.xz-rect.xy)*rect.zw. */
  sample: Node<'vec2'>;
  rect: Node<'vec4'>;
  amount: Node<'float'>;
  lb14Gao: Node<'float'>;
  night: Node<'float'>;
}

export function sourceCityAoFactors(THREE: Three, input: SourceCityAoInputs) {
  const T = THREE.TSL;
  const hasBake = input.rect.z.greaterThan(0);
  const height = input.position.y.sub(T.select(hasBake, input.sample.y.mul(127.5), 0));
  let ao = T.mix(input.sample.x, 1, T.smoothstep(6, 46, height));
  const roof = T.smoothstep(0.55, 0.8, input.normal.y)
    .mul(T.mix(1, T.smoothstep(1.2, 5, height), input.lb14Gao));
  ao = T.mix(ao, 1, roof);
  const nightUp = T.mix(1, 0.42, T.smoothstep(4, 34, height));
  ao = T.mix(ao, T.min(ao, nightUp), T.smoothstep(0.15, 0.60, input.night));
  // Source uses > 0, not >= 0: an unloaded AO bake must not darken the scene.
  const enabled = T.select(hasBake, 1, 0);
  const diffuse = T.mix(1, ao, input.amount.mul(enabled));
  return { height, diffuse, specular: T.mix(0.65, 1, diffuse) };
}
