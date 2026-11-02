// The gen lane's pednet seam (Phase 3 slice 3): the walk stubs places.ts
// emits joined into the LaneTopology PedSim consumes. Two attach rules:
//
//   'edge' loops   stay isolated — a closed circulate loop has no ends to
//                  join, and PedSim never ambient-spawns on a band whose
//                  nodeA === nodeB (its own spawn filter, ped-sim.ts).
//   'gate' paths   attach where an end lands within GEN_GATE_ATTACH_METRES of
//                  a record band end: the stub's node id takes that junction's
//                  id, and the sim's own corner-link rule (different roadId,
//                  under CORNER_LINK_MAX_METRES, no carriageway crossing —
//                  buildCornerLinks in ped-sim.ts) decides whether the hop is
//                  offered. With no junction in reach the path keeps its
//                  `node:gen:` ids — an isolated stub: spawnable, but a ped
//                  reaching its end only turns back (decideAtBandEnd's
//                  turnback option; the gen node simply isn't in nodeById).
//
// The append is additive and flag-gated at bundled-topology.ts: flag off, the
// built topology is untouched. Walks keep the collection's sorted-by-id
// invariant (topology.ts) and stats.walkEdges counts the appends.
import type { LaneTopology } from '../../living-city/topology.ts';
import { genPlacesForTile, type GenWalkEdge } from './places.ts';
import type { GenDataset } from './spec.ts';

/**
 * A gate end this close to a record band end takes that junction's node id,
 * metres. Kept well under the corner-link cap (28 m): the stub's claim is
 * "this path ends at the junction", honest only when the gate mouth is short
 * of the junction box — the sim's own distance and jaywalk checks still gate
 * the hop itself.
 */
export const GEN_GATE_ATTACH_METRES = 12;

/**
 * The whole tile's walk stubs — the same cell enumeration and playable-bounds
 * gate createGenBlockedFor uses (places.ts). Flag-off callers never build it.
 */
export function genWalkEdgesFor(
  dataset: GenDataset & { readonly extentMeters: number },
  groundY: (x: number, z: number) => number,
): GenWalkEdge[] {
  const half = dataset.extentMeters;
  return genPlacesForTile(dataset, groundY, (x, z) => Math.abs(x) <= half && Math.abs(z) <= half).flatMap((c) => c.walks);
}

interface BandEnd {
  readonly node: string;
  readonly x: number;
  readonly z: number;
}

/**
 * The gen stubs as topology walks: a gate end within GEN_GATE_ATTACH_METRES of
 * a record band end re-keys to that junction's node id (nearest wins); 'edge'
 * loops and out-of-reach gates keep their `node:gen:` ids. One pass over the
 * record band ends per end — O(ends × band ends), paid once at tile build.
 */
export function stitchGenWalks(topology: LaneTopology, gen: readonly GenWalkEdge[]): readonly GenWalkEdge[] {
  const ends: BandEnd[] = [];
  for (const w of topology.walks) {
    const n = w.points.length;
    if (n < 4) continue;
    ends.push({ node: w.nodeA, x: w.points[0]!, z: w.points[1]! });
    ends.push({ node: w.nodeB, x: w.points[n - 2]!, z: w.points[n - 1]! });
  }
  const nearestNode = (x: number, z: number): string | null => {
    let best = GEN_GATE_ATTACH_METRES;
    let node: string | null = null;
    for (const e of ends) {
      const d = Math.hypot(e.x - x, e.z - z);
      if (d <= best) {
        best = d;
        node = e.node;
      }
    }
    return node;
  };
  return gen.map((g) => {
    if (g.kind !== 'gate') return g;
    const n = g.points.length;
    const nodeA = nearestNode(g.points[0]!, g.points[1]!) ?? g.nodeA;
    const nodeB = nearestNode(g.points[n - 2]!, g.points[n - 1]!) ?? g.nodeB;
    return nodeA === g.nodeA && nodeB === g.nodeB ? g : { ...g, nodeA, nodeB };
  });
}

/**
 * The topology with the gen walks folded in: collections and maps keep their
 * shape, `walks` stays sorted by id, and `stats.walkEdges` counts the append.
 * A tile with no gen content returns the same object.
 */
export function appendGenWalks(topology: LaneTopology, gen: readonly GenWalkEdge[]): LaneTopology {
  const stitched = stitchGenWalks(topology, gen);
  if (stitched.length === 0) return topology;
  const walks = [...topology.walks, ...stitched].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { ...topology, walks, stats: { ...topology.stats, walkEdges: walks.length } };
}
