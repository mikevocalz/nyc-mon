import type { ThreeSetup } from '../types';
import type { EggHatchSceneParams } from './hatch-scene';

/** The egg hatch scene, loaded with three.js on first use. Module-level, so its identity is stable. */
export const loadEggHatch = (): Promise<ThreeSetup<EggHatchSceneParams>> => import('./hatch-scene').then((m) => m.createEggHatchScene);

/** Starts fetching an egg's GLB bytes without loading three.js's renderer path into the caller's chunk. */
export const preloadEggHatch = (...args: Parameters<typeof import('./egg-hatch-rig').preloadEggHatch>): void => {
  void import('./egg-hatch-rig').then((m) => m.preloadEggHatch(...args));
};
