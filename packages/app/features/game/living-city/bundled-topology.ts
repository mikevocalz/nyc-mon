// The Living City lane topology bound to the bundled Harlem tile, built on
// first use — the sidecar is derived at dataset-load time, never baked into
// the JSON. Kept apart from topology.ts so node tests of the pure maths
// never import the tile JSON (same split as world/bundled-queries.ts).
import { bundledCity } from '../city-data.ts';
import { buildLaneTopology, type LaneTopology } from './topology.ts';
import { createWalkQueries } from '../world/walkability.ts';
import { EXPERIMENTAL_WORLD_GEN } from '../world/gen/flag.ts';
import { appendGenWalks, genWalkEdgesFor } from '../world/gen/pednet.ts';

let bundled: LaneTopology | null = null;

/**
 * The lane + crosswalk graph for the bundled tile, or null when the tile
 * failed to parse (a parse failure never mounts the world anyway).
 * EXPO_PUBLIC_WORLD_GEN folds the gen lane's walk stubs into `walks`
 * (world/gen/pednet.ts — gates stitch to junctions in reach, loops stay
 * isolated); flag off, the built sidecar is byte-identical.
 */
export function bundledTopology(): LaneTopology | null {
  if (bundled) return bundled;
  const city = bundledCity();
  const topo = city.ok ? buildLaneTopology(city.dataset) : null;
  bundled =
    topo !== null && EXPERIMENTAL_WORLD_GEN && city.ok
      ? appendGenWalks(topo, genWalkEdgesFor(city.dataset, createWalkQueries(city.dataset).groundHeight))
      : topo;
  return bundled;
}
