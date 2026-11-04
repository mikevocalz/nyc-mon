// Valdrada world/materials.js applyLightTrim/ST34 @2724c79 (MIT).
// Called only by authored building families; furniture retains its existing calibration.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

export interface SourceLightTrim {
  night: Node<'float'>;
  /** Original applyLightTrim RGB scale (already rounded to the source shader's three decimals). */
  scale: Node<'vec3'>;
  /** Captured ENV.st34; x is the dielectric daytime specular scale. */
  st34: Node<'vec4'>;
}

export function sourceDiffuseTrim(THREE: Three, inputs: SourceLightTrim): Node<'vec3'> {
  return THREE.TSL.mix(0.30, 0.88, inputs.night).mul(inputs.scale) as Node<'vec3'>;
}

/** Run before PhysicalLightingModel.start(), after material properties have been initialized. */
export function applySourceSpecularTrim(THREE: Three, inputs: SourceLightTrim): void {
  const T = THREE.TSL;
  const factor = T.mix(T.mix(inputs.st34.x, 1, inputs.night), 1,
    T.float(1).sub(T.smoothstep(0.12, 0.28, T.roughness)));
  T.specularColor.assign(T.specularColor.mul(factor));
  T.specularF90.mulAssign(factor);
  T.specularColorBlended.assign(T.mix(T.specularColor, T.diffuseColor.rgb, T.metalness));
}
