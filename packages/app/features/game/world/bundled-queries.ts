// isWalkable and cityGroundHeight bound to the bundled Harlem tile, built on
// first use. Kept apart from walkability.ts so node tests of the pure maths
// never import the tile JSON.
import { bundledCity } from '../city-data.ts';
import { createWalkQueries, type WalkQueries } from './walkability.ts';

let bundled: WalkQueries | null = null;
function queries(): WalkQueries {
  if (bundled) return bundled;
  const city = bundledCity();
  // A tile that failed to parse never mounts the world, so nothing is walkable.
  bundled = city.ok ? createWalkQueries(city.dataset) : { isWalkable: () => false, groundHeight: () => 0 };
  return bundled;
}

/** Whether a Caller may stand at scene (x, z) on the bundled tile. */
export function isWalkable(x: number, z: number): boolean {
  return queries().isWalkable(x, z);
}

/** Ground height at scene (x, z), metres. Flat 0 until the tile carries elevation; NaN for non-finite input. */
export function cityGroundHeight(x: number, z: number): number {
  return queries().groundHeight(x, z);
}
