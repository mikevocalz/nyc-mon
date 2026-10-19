// The Living City lane topology bound to the bundled Harlem tile, built on
// first use — the sidecar is derived at dataset-load time, never baked into
// the JSON. Kept apart from topology.ts so node tests of the pure maths
// never import the tile JSON (same split as world/bundled-queries.ts).
import { bundledCity } from '../city-data.ts';
import { buildLaneTopology, type LaneTopology } from './topology.ts';

let bundled: LaneTopology | null = null;

/**
 * The lane + crosswalk graph for the bundled tile, or null when the tile
 * failed to parse (a parse failure never mounts the world anyway).
 */
export function bundledTopology(): LaneTopology | null {
  if (bundled) return bundled;
  const city = bundledCity();
  bundled = city.ok ? buildLaneTopology(city.dataset) : null;
  return bundled;
}
