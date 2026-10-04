import type { ThreeSetup } from '../types';
import type { TideOptions } from './tide-config';

/** The tide scene, loaded with three.js on first use. Module-level, so its identity is stable. */
export const loadTide = (): Promise<ThreeSetup<TideOptions>> => import('./tide-scene').then((m) => m.createTideScene);
