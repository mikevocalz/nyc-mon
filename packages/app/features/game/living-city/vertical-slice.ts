// Living City PR05 — the authored vertical slice at 125th Street & Adam
// Clayton Powell Jr. Boulevard, pure topology→spawn-spec logic kept separate
// from bundled-host.ts (which pulls the city JSON) so node tests exercise
// the exact spec the mounted path uses.

import type { LaneConnector, LaneEdge, LaneTopology, XwalkLeg } from './topology.ts';
import type { PedSpawnSpec } from './ped-sim.ts';
import { cumulative, type PathGeom, type SpawnSpec } from './vehicle-sim.ts';

/** 125th & ACP — the junction the PR02 probe verified (docs/living-city/pr02-topology.md). */
export const LIVING_CITY_SLICE_NODE = 'node:s19169.s19170.s19212.s19213.s19399.s19400.s19401';

/** Spawn this far back from the stop line so the red-light phase is readable on approach. */
export const SLICE_APPROACH_METRES = 36;

/** PR06: the six-pedestrian slice — three peds per kerb, spaced this far apart on approach. */
export const PED_SLICE_PER_SIDE = 3;
export const PED_SLICE_SPACING_METRES = 7;
export const PED_SLICE_LEAD_METRES = 16;

export interface SliceSpawn extends SpawnSpec {
  /** Why this spawn exists — trace/tests, not runtime. */
  readonly street: string;
}

export interface LivingCitySlice {
  readonly nodeId: string;
  readonly spawns: readonly SliceSpawn[];
}

function streetNames(topology: LaneTopology): Map<string, string> {
  const names = new Map<string, string>();
  for (const seg of topology.segments) {
    if (seg.name !== undefined && !names.has(seg.roadId)) names.set(seg.roadId, seg.name);
  }
  return names;
}

/**
 * The authored two-car slice at 125th & ACP: one vehicle approaches on
 * 125th, one on ACP — perpendicular programs, so the 3-phase controller
 * necessarily holds one on red while the other runs green. Exits prefer a
 * `through` connector so both cross the box straight. Returns null when the
 * tile lacks the junction (a wrong bundle fails closed, not loudly).
 */
export function livingCityVerticalSlice(topology: LaneTopology): LivingCitySlice | null {
  if (!topology.nodeById.has(LIVING_CITY_SLICE_NODE)) return null;
  const names = streetNames(topology);
  const nameOf = (lane: LaneEdge): string => names.get(lane.roadId) ?? '';
  const connsFrom = new Map<string, LaneConnector[]>();
  for (const c of topology.connectors) {
    (connsFrom.get(c.in) ?? connsFrom.set(c.in, []).get(c.in)!).push(c);
  }
  const approaches = topology.lanesTo.get(LIVING_CITY_SLICE_NODE) ?? [];
  const is125 = (lane: LaneEdge) => /125|LUTHER KING/i.test(nameOf(lane));
  const isAcp = (lane: LaneEdge) => /ADAM CLAYTON|POWELL/i.test(nameOf(lane));
  const pick = (lanes: readonly LaneEdge[]): { lane: LaneEdge; conn: LaneConnector } | null => {
    // Prefer the rightmost lane with a through exit; any legal exit beats none.
    let fallback: { lane: LaneEdge; conn: LaneConnector } | null = null;
    for (const lane of [...lanes].sort((a, b) => a.laneIndex - b.laneIndex || (a.id < b.id ? -1 : 1))) {
      const conns = connsFrom.get(lane.id) ?? [];
      const through = conns.find((c) => c.turn === 'through');
      if (through) return { lane, conn: through };
      fallback ??= conns[0] !== undefined ? { lane, conn: conns[0] } : null;
    }
    return fallback;
  };
  const a = pick(approaches.filter(is125));
  const b = pick(approaches.filter(isAcp));
  if (!a || !b) return null;
  const spec = ({ lane, conn }: { lane: LaneEdge; conn: LaneConnector }, kind: SliceSpawn['kind']): SliceSpawn => ({
    kind,
    street: nameOf(lane),
    lane: lane.id,
    s: Math.max(0, lane.lengthMeters - SLICE_APPROACH_METRES),
    route: [conn.out],
  });
  return { nodeId: LIVING_CITY_SLICE_NODE, spawns: [spec(a, 'sedan'), spec(b, 'taxi')] };
}

// --- PR06: the six-pedestrian crosswalk slice ---------------------------------------------

export interface PedSliceSpawn extends PedSpawnSpec {
  /** Which kerb of the slice crosswalk this ped approaches from ('a' = points head side). */
  readonly side: 'a' | 'b';
}

export interface LivingCityPedSlice {
  readonly nodeId: string;
  /** The crosswalk leg the six peds ping-pong on — an osm-crossing-backed zebra with both kerbs on real walk bands. */
  readonly xwalk: string;
  readonly spawns: readonly PedSliceSpawn[];
}

/** Arc s of the walk-band point nearest (x, z) — same maths as the sim's kerb lookup. */
function bandKerbS(geom: PathGeom, x: number, z: number): number {
  let best = Infinity;
  let bestS = 0;
  const p = geom.points;
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2]!;
    const az = p[i - 1]!;
    const bx = p[i]!;
    const bz = p[i + 1]!;
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    const d2 = (ax + dx * t - x) ** 2 + (az + dz * t - z) ** 2;
    if (d2 < best) {
      best = d2;
      bestS = geom.cum[i / 2 - 1]! + Math.sqrt(l2) * t;
    }
  }
  return bestS;
}

/**
 * The spec §9 headline slice: six pedestrians on opposite kerbs of a real
 * zebra at 125th & ACP — three per side, walking in, waiting for WALK,
 * crossing, strolling out, and coming back to wait again. The leg is chosen
 * deterministically: among the node's OSM-crossing legs with both kerbs
 * matched to walk bands, the one whose smaller approach band is longest
 * (the most room to queue on). Returns null when the tile lacks the junction.
 */
export function livingCityPedSlice(topology: LaneTopology): LivingCityPedSlice | null {
  const node = topology.nodeById.get(LIVING_CITY_SLICE_NODE);
  if (!node) return null;
  const geomCache = new Map<string, PathGeom>();
  const bandGeom = (id: string): PathGeom | null => {
    let g = geomCache.get(id);
    if (g === undefined) {
      const w = topology.walks.find((e) => e.id === id);
      if (!w) return null;
      g = { points: w.points, ...cumulative(w.points) };
      geomCache.set(id, g);
    }
    return g;
  };
  const candidates = topology.xwalks
    .filter((x) => x.node === node.id && x.backing === 'osm-crossing' && x.walks[0] !== null && x.walks[1] !== null)
    .map((x) => {
      const ga = bandGeom(x.walks[0]!);
      const gb = bandGeom(x.walks[1]!);
      const room = Math.min(ga?.length ?? 0, gb?.length ?? 0);
      return { x, room };
    })
    .filter((c) => c.room > 0)
    .sort((a, b) => b.room - a.room || (a.x.id < b.x.id ? -1 : 1));
  const chosen = candidates[0];
  if (!chosen) return null;
  const xwalk: XwalkLeg = chosen.x;
  const n = xwalk.points.length;
  const spawns: PedSliceSpawn[] = [];
  const kinds: PedSliceSpawn['kind'][] = ['adult', 'kid', 'adult'];
  for (const end of [0, 1] as const) {
    const bandId = xwalk.walks[end]!;
    const geom = bandGeom(bandId)!;
    const kerb = bandKerbS(geom, xwalk.points[end === 0 ? 0 : n - 2]!, xwalk.points[end === 0 ? 1 : n - 1]!);
    // Spread three peds behind the kerb on the side that has the room.
    const back: 1 | -1 = kerb > geom.length / 2 ? -1 : 1;
    for (let i = 0; i < PED_SLICE_PER_SIDE; i++) {
      const offset = PED_SLICE_LEAD_METRES + i * PED_SLICE_SPACING_METRES;
      const s = Math.max(0.3, Math.min(geom.length - 0.3, kerb + back * offset));
      spawns.push({
        kind: kinds[i],
        side: end === 0 ? 'a' : 'b',
        walk: bandId,
        s,
        plan: 'loop',
        xwalk: xwalk.id,
      });
    }
  }
  return { nodeId: node.id, xwalk: xwalk.id, spawns };
}
