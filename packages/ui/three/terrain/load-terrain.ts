import type { ThreeSetup } from '../types';
import type { TerrainOptions } from './terrain-config';

/** The terrain scene, loaded with three.js on first use. Module-level, so its identity is stable. */
export const loadTerrain = (): Promise<ThreeSetup<TerrainOptions>> => import('./terrain-scene').then((m) => m.createTerrainScene);
