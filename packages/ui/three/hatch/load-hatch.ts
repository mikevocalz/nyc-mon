import type { ThreeSetup } from '../types';
import type { EggHatchSceneParams } from './hatch-scene';

/** The egg hatch scene, loaded with three.js on first use. Module-level, so its identity is stable. */
export const loadEggHatch = (): Promise<ThreeSetup<EggHatchSceneParams>> => import('./hatch-scene').then((m) => m.createEggHatchScene);

/** Starts fetching an egg's GLB bytes without loading three.js's renderer path into the caller's chunk. */
export const preloadEggHatch = (...args: Parameters<typeof import('./egg-hatch-rig').preloadEggHatch>): void => {
  void import('./egg-hatch-rig').then((m) => m.preloadEggHatch(...args));
};

/** The hatch sequence scene (the Alexa choreography on the shared renderer), loaded on first use. Module-level, so its identity is stable. */
export const loadHatchSequence = (): Promise<ThreeSetup<import('./hatch-sequence-scene').HatchSequenceSceneParams>> =>
  import('./hatch-sequence-scene').then((m) => m.createHatchSequenceScene);

/** A Baby on its own stage (the Alexa view's MonModel3D on the shared renderer), loaded on first use. Module-level, so its identity is stable. */
export const loadMonScene = (): Promise<ThreeSetup<import('../mon/mon-scene').MonSceneParams>> =>
  import('../mon/mon-scene').then((m) => m.createMonScene);

/** Starts fetching a Baby's GLB bytes (26-34 MB) without loading three.js into the caller's chunk. */
export const preloadMonModel = (...args: Parameters<typeof import('../mon/mon-rig').preloadMonRig>): void => {
  void import('../mon/mon-rig').then((m) => m.preloadMonRig(...args));
};
