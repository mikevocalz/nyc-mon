// Valdrada city/fk/custom/{bid2.js,bid3Util.js} @2724c79 (MIT).
// Source maps, normals, render state and common city lighting belong to the family factory.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

export type CustomBuildingProgram = 'wall-weathered' | 'wall-clean' | 'victoria' | 'lattice' | 'night-lit' | 'tower-glass';
export function sourceCustomBuildingProgram(key: string, hash: string): CustomBuildingProgram {
  if (key === 'b3wall|0.2|0.05|cityaon|cs34|lighttrim1,1,1|st34' && hash === '2950ad8e') return 'wall-weathered';
  if (key === 'b3wall|0|0|cityaon|cs34|lighttrim1,1,1|st34' && hash === 'f659510e') return 'wall-clean';
  if (key === 'b2vic' && hash === '403da1e') return 'victoria';
  if (key.endsWith('|b2lat') && hash === 'bd0b81b2') return 'lattice';
  if (key.endsWith('|b3lit') && hash === '5c12b66a') return 'night-lit';
  if (key.startsWith('b3tg|') && hash === '16df4371') return 'tower-glass';
  throw new Error(`Unsupported authored custom building program: ${key} (${hash})`);
}

/** Apply to material×vertex×map RGB, before common light trim. Coordinates are source world metres. */
export function customWallColorNode(THREE: Three, input: {
  color: Node<'vec3'>; world: Node<'vec3'>; night: Node<'float'>; weathered: boolean;
}): Node<'vec3'> {
  const T = THREE.TSL, { world, night } = input;
  const calibrated = T.pow(T.max(input.color, T.vec3(0)), T.vec3(1.22)).mul(0.88).div(T.mix(0.30, 0.88, night));
  if (!input.weathered) return calibrated;
  const h = world.y.sub(3.5);
  const column = T.fract(T.sin(T.dot(T.floor(T.vec2(world.x.add(world.z), world.x.sub(world.z)).mul(2.8)), T.vec2(12.9898, 78.233))).mul(43758.5453));
  const run = T.smoothstep(0, 1, column).mul(T.smoothstep(0, 6, h)).mul(T.float(1).sub(T.smoothstep(6, 40, h)));
  return calibrated.mul(T.float(1).sub(T.float(0.2).mul(T.float(1).sub(T.smoothstep(0, 14, h))))).mul(T.float(1).sub(run.mul(0.05)));
}

/** The multiplier follows any earlier emission hook, matching source onBeforeCompile composition. */
export function customBuildingEmissionNode(THREE: Three, program: Exclude<CustomBuildingProgram, 'wall-weathered' | 'wall-clean'>,
  emission: Node<'vec3'>, night: Node<'float'>): Node<'vec3'> {
  const T = THREE.TSL;
  if (program === 'victoria') return emission.mul(T.mix(0.12, 1.3, night));
  if (program === 'lattice') return emission.mul(T.float(1).sub(night));
  return emission.mul(night);
}

/** Source b3self adds the already trimmed diffuse, with coefficients rounded by source toFixed(3). */
export function customSelfLitEmissionNode(THREE: Three, emission: Node<'vec3'>, diffuseAfterLT: Node<'vec3'>,
  sourceDayNight: Node<'vec2'>, night: Node<'float'>): Node<'vec3'> {
  return emission.add(diffuseAfterLT.mul(THREE.TSL.mix(sourceDayNight.x, sourceDayNight.y, night))) as Node<'vec3'>;
}

/** Source b3mr runs after pbcity's radiance edit; reflectedWorldY is the normalized reflected ray's world Y. */
export function customMonumentRadianceNode(THREE: Three, radianceAfterPbcity: Node<'vec3'>,
  reflectedWorldY: Node<'float'>): Node<'vec3'> {
  const T = THREE.TSL;
  const luma = T.dot(radianceAfterPbcity, T.vec3(0.2126, 0.7152, 0.0722));
  const horizon = T.float(1).sub(T.float(0.6).mul(T.float(1).sub(T.smoothstep(-0.35, 0.02, reflectedWorldY))));
  return T.mix(T.vec3(luma), radianceAfterPbcity, 0.35).mul(horizon) as Node<'vec3'>;
}
