// isWalkable and cityGroundHeight bound to the bundled Harlem tile, built on
// first use. Kept apart from walkability.ts so node tests of the pure maths
// never import the tile JSON.
import { bundledCity } from '../city-data.ts';
import { buildObstacles } from './obstacles.ts';
import { createStreetClearance, createWalkQueries, type WalkQueries } from './walkability.ts';

let bundled: WalkQueries | null = null;
function queries(): WalkQueries {
  if (bundled) return bundled;
  const city = bundledCity();
  // A tile that failed to parse never mounts the world, so nothing is walkable.
  if (!city.ok) {
    bundled = { isWalkable: () => false, groundHeight: () => 0 };
    return bundled;
  }
  // Ground and buildings from the walk queries; poles, trunks, hydrants and parked cars block too.
  const walk = createWalkQueries(city.dataset);
  const obstacles = buildObstacles(city.dataset, createStreetClearance(city.dataset));
  bundled = { isWalkable: (x, z) => walk.isWalkable(x, z) && !obstacles.blocked(x, z), groundHeight: walk.groundHeight };
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
