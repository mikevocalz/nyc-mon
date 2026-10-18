// Living City PR05 — the authored vertical slice at 125th Street & Adam
// Clayton Powell Jr. Boulevard, pure topology→spawn-spec logic kept separate
// from bundled-host.ts (which pulls the city JSON) so node tests exercise
// the exact spec the mounted path uses.

import type { LaneConnector, LaneEdge, LaneTopology } from './topology.ts';
import type { SpawnSpec } from './vehicle-sim.ts';

/** 125th & ACP — the junction the PR02 probe verified (docs/living-city/pr02-topology.md). */
export const LIVING_CITY_SLICE_NODE = 'node:s19169.s19170.s19212.s19213.s19399.s19400.s19401';

/** Spawn this far back from the stop line so the red-light phase is readable on approach. */
export const SLICE_APPROACH_METRES = 36;

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
