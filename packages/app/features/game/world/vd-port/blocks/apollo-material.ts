// Valdrada city/w125cKit.js at the source pin below (MIT).
// These are authored emission/output modifiers, not a substitute for the source maps.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

export const APOLLO_SOURCE_PIN = '2724c7938f20e068748ad1fd66e907d2bc662e3e';
export const APOLLO_SOURCE_SHA256 = 'bd3b4b07001e31d22bf0d8369892721f3b46ba166c4dd38b548e2410b87a5633';
export const APOLLO_SOURCE_PROGRAMS = {
  a34back: 'c41e8ba6', a34tube: 'dd09ee08', a32sign: 'd40dac0', a33led2: 'e3c25378',
  'a32tube0.62,0.68,0.760.22,0.48,1.35': '960010e1',
  'a32tube0.86,0.88,0.920.85,0.92,1.4': '404df233',
  a34cream: 'e9e54125', a34field: 'da9e0c8c',
} as const;
export type ApolloProgram = keyof typeof APOLLO_SOURCE_PROGRAMS;
export function sourceApolloProgram(key: string, hash: string): ApolloProgram {
  const suffix = key.slice(key.lastIndexOf('|') + 1) as ApolloProgram;
  if (!Object.hasOwn(APOLLO_SOURCE_PROGRAMS, suffix) || APOLLO_SOURCE_PROGRAMS[suffix] !== hash) throw new Error(`Unsupported authored Apollo program: ${key} (${hash})`);
  return suffix;
}

const EMISSION = {
  a34back: [0, 0.5], a34tube: [0.04, 3], a32sign: [0, 1.1],
  a33led2: [0.5, 0.8], a34cream: [0, 0.6], a34field: [0, 0.7],
} as const;
const TUBES = {
  'a32tube0.62,0.68,0.760.22,0.48,1.35': [[0.62, 0.68, 0.76], [0.22, 0.48, 1.35]],
  'a32tube0.86,0.88,0.920.85,0.92,1.4': [[0.86, 0.88, 0.92], [0.85, 0.92, 1.4]],
} as const;

/** Apply after source map/emissive-intensity and preceding LT/ST34 emission terms, as in onBeforeCompile. */
export function apolloSurfaceNodes(THREE: Three, program: ApolloProgram, input: { emission: Node<'vec3'>; night: Node<'float'> }): {
  emission?: Node<'vec3'>;
  output?: (linearHdr: Node<'vec4'>) => Node<'vec4'>;
} {
  const T = THREE.TSL;
  if (Object.hasOwn(EMISSION, program)) {
    const [day, night] = EMISSION[program as keyof typeof EMISSION];
    return { emission: input.emission.mul(T.mix(day, night, input.night)) };
  }
  const colors = TUBES[program as keyof typeof TUBES];
  if (!colors) throw new Error(`Unsupported authored Apollo modifier: ${program}`);
  // Source tubeMat replaces RGB immediately before fog; retain the incoming alpha.
  return { output: (rgba) => T.vec4(T.mix(T.vec3(...colors[0]), T.vec3(...colors[1]), input.night), rgba.a) };
}
