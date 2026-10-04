import type { ThreeSetup } from '../types';
import type { TerrainOptions } from './terrain-config';

/** The city-blocks scene, loaded with three.js on first use. Module-level, so its identity is stable. */
export const loadCity = (): Promise<ThreeSetup<TerrainOptions>> => import('./terrain-scene').then((m) => m.createTerrainScene);
