// Valdrada world/materials.js CS34_GLSL @2724c79 (MIT).
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

export interface SourceCityReflectionInputs {
  height: Node<'float'>;
  radiance: Node<'vec3'>;
  iblIrradiance: Node<'vec3'>;
  cs34: Node<'vec4'>;
  cs34Col: Node<'vec4'>;
  /** pbrLib's own city-reflection edit excludes the generic specular half of CS34. */
  pbrCity: Node<'float'>;
}

/** Call before the installed physical model consumes its environment radiance and irradiance. */
export function sourceCityReflection(THREE: Three, input: SourceCityReflectionInputs) {
  const T = THREE.TSL;
  const horizon = T.float(0.55).mul(T.float(1).sub(T.smoothstep(2, 32, input.height)));
  const reflected = T.reflect(T.positionViewDirection.negate(), T.normalView);
  const direction = T.normalize(T.mix(reflected, T.normalView, T.pow(T.roughness, 4)));
  const worldDirection = T.normalize(T.vec4(direction, 0).mul(T.cameraViewMatrix).xyz);
  const width = T.float(0.1).add(T.roughness.mul(T.roughness).mul(0.55));
  const specularSky = T.smoothstep(horizon.sub(width), horizon.add(width), worldDirection.y);
  const luma = T.vec3(0.2126, 0.7152, 0.0722);
  const specularLuma = T.dot(input.radiance, luma);
  const sky = T.mix(input.radiance, T.vec3(specularLuma), input.cs34.z);
  const wall = input.cs34Col.rgb.mul(specularLuma).mul(input.cs34Col.a);
  const diffuseSky = T.smoothstep(horizon.sub(0.75), horizon.add(0.75), T.normalWorld.y);
  const diffuseLuma = T.dot(input.iblIrradiance, luma);
  const enabled = T.select(input.cs34.x.add(input.cs34.y).greaterThan(0), 1, 0);
  return {
    radiance: T.mix(input.radiance, T.mix(wall, sky, specularSky), input.cs34.x.mul(T.float(1).sub(input.pbrCity)).mul(enabled)),
    iblIrradiance: T.mix(input.iblIrradiance, T.mix(input.cs34Col.rgb.mul(diffuseLuma), input.iblIrradiance, diffuseSky), input.cs34.y.mul(enabled)),
  };
}

/** pbrLib CITY_GLSL/applyCityRefl; used by plain FK finishes as well as the PBR family. */
export function sourcePbrCityReflection(THREE: Three, radiance: Node<'vec3'>, height: Node<'float'>): Node<'vec3'> {
  const T = THREE.TSL;
  const horizon = T.float(0.55).mul(T.float(1).sub(T.smoothstep(2, 32, height)));
  const reflected = T.reflect(T.positionViewDirection.negate(), T.normalView);
  const direction = T.normalize(T.mix(reflected, T.normalView, T.pow(T.roughness, 4)));
  const worldDirection = T.normalize(T.vec4(direction, 0).mul(T.cameraViewMatrix).xyz);
  const width = T.float(0.1).add(T.roughness.mul(T.roughness).mul(0.55));
  const sky = T.smoothstep(horizon.sub(width), horizon.add(width), worldDirection.y);
  const gray = T.vec3(T.dot(radiance, T.vec3(0.2126, 0.7152, 0.0722))).mul(T.vec3(0.95, 1, 1.08));
  return T.mix(gray.mul(0.55), T.mix(radiance, gray, 0.35), sky) as Node<'vec3'>;
}
