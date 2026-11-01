// The per-cell traffic graph loader (VGC1 kind 3), the read half of
// tooling/city/vd-port/write-traffic.mjs — lane-level edges cut from Valdrada's street records in the
// LaneEdge/TopologyNode/LaneConnector shape living-city's vehicle-sim consumes (topology.ts), plus the
// cell's share of the CAR_TARGET fleet budget. A lane that crosses a cell seam lives in the cell of its
// centreline's centroid and references its junction nodes by id, so neighbouring cells stitch by id.
//
// Pure decoder: no three.js, no platform IO.
import { PACK_KIND, openPack, packString, type PositionFrame } from './cell-pack.ts';

export type TrafficNodeKind = 'junction' | 'link' | 'deadEnd' | 'boundary';
const NODE_KIND: readonly TrafficNodeKind[] = ['junction', 'link', 'deadEnd', 'boundary'];
export type Turn = 'through' | 'left' | 'right' | 'uturn';
const TURN: readonly Turn[] = ['through', 'left', 'right', 'uturn'];

/** One directed lane — the LaneEdge shape (topology.ts) with Valdrada's fields alongside. */
export interface TrafficLane {
  /** `l:t<tx>_<tz>:<road index>:<f|b>:<lane index>` — f travels along the stored polyline, b against it. */
  readonly id: string;
  /** Junction node ids the lane runs between (`n:` ids); absent at an unmatched end. */
  readonly from?: string;
  readonly to?: string;
  /** CSCL physicalid of the street piece. */
  readonly segId: number;
  readonly name?: string;
  /** 'forward' travels along the stored polyline, 'backward' against it (topology.ts). */
  readonly dir: 'forward' | 'backward';
  /** 0 = rightmost lane in travel direction. */
  readonly laneIndex: number;
  /** Lanes travelling this direction on this piece. */
  readonly laneCount: number;
  readonly oneway: -1 | 0 | 1;
  readonly rclass: number;
  /** Recorded speed, mph, and the sim's m/s (traffic.js: max(6, mph * 0.44704)). */
  readonly speedMph: number;
  readonly speedMps: number;
  /** Parking lane coding: 0 none, 1 single side (driving band shifted), 2 both sides. */
  readonly park: number;
  /** Signed offset from the road centreline, metres: + = left of travel (LaneEdge contract). */
  readonly lateral: number;
  /** Lane width, metres (traffic.js's min(3.4, usable/lanes)). */
  readonly laneWidthMeters: number;
  /** The piece's full carriageway width, metres. */
  readonly widthMeters: number;
  /** Junction-mouth reach at the lane's own ends, in travel order. */
  readonly mouthFrom: number;
  readonly mouthTo: number;
  /** Lane centreline in travel direction, [x, y, z] absolute; y is the road grade. */
  readonly points: readonly (readonly [number, number, number])[];
  readonly lengthMeters: number;
  /** Ends at an edge of the mapped square — traffic enters/leaves the world here. */
  readonly boundary: boolean;
  /** Both ends on one junction: a junction-box interior piece (topology.ts `internal`). No connector uses it. */
  readonly internal: boolean;
}

export interface TrafficNode {
  /** `n:<x*10>_<z*10>` on absolute scene metres — stable across cells and tiles. */
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly kind: TrafficNodeKind;
  /** Compiler's signalized-junction flag. */
  readonly signal: 0 | 1;
}

export interface TrafficConnector {
  /** In-lane / out-lane / node ids, the LaneConnector fields (topology.ts). */
  readonly in: string;
  readonly out: string;
  readonly node: string;
  readonly turn: Turn;
}

export interface TrafficCellPackage {
  readonly cx: number;
  readonly cz: number;
  readonly key: string;
  readonly positionFrame: PositionFrame;
  readonly lanes: readonly TrafficLane[];
  readonly nodes: readonly TrafficNode[];
  readonly connectors: readonly TrafficConnector[];
  /** The cell's share of Valdrada's CAR_TARGET fleet, split by lane metres. */
  readonly carBudget: number;
  /** The lane metres behind `carBudget`. */
  readonly laneWeight: number;
}

function lengthOf(pts: readonly (readonly [number, number, number])[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![2] - pts[i - 1]![2]);
  return l;
}

/** Decodes one `traffic/<cx>_<cz>` pack. Throws on a foreign or torn pack. */
export function decodeTrafficCell(bytes: Uint8Array): TrafficCellPackage {
  const { head, r } = openPack(bytes, PACK_KIND.traffic);
  const { x: ox, z: oz } = head.positionFrame;

  const nLanes = r.u32();
  const lanes: TrafficLane[] = [];
  for (let i = 0; i < nLanes; i++) {
    const id = packString(head, r.u16()) ?? `?${i}`;
    const from = packString(head, r.u16());
    const to = packString(head, r.u16());
    const segId = r.u32();
    const name = packString(head, r.u16());
    const dirB = r.u8();
    const rclass = r.u8();
    const oneway = r.i8() as -1 | 0 | 1;
    const laneIndex = r.u8();
    const laneCount = r.u8();
    const speedMph = r.u8();
    const park = r.u8();
    const flags = r.u8();
    const lateral = r.f32();
    const laneWidthMeters = r.f32();
    const widthMeters = r.f32();
    const mouthFrom = r.f32();
    const mouthTo = r.f32();
    const npts = r.u16();
    const points: [number, number, number][] = [];
    for (let v = 0; v < npts; v++) points.push([r.f32() + ox, r.f32(), r.f32() + oz]);
    const lane: TrafficLane = {
      id,
      segId,
      dir: dirB === 0 ? 'forward' : 'backward',
      laneIndex,
      laneCount,
      oneway,
      rclass,
      speedMph,
      // traffic.js's default when a piece records no speed (write-traffic.mjs applies the same)
      speedMps: Math.max(6, (speedMph || 25) * 0.44704),
      park,
      lateral,
      laneWidthMeters,
      widthMeters,
      mouthFrom,
      mouthTo,
      points,
      lengthMeters: lengthOf(points),
      boundary: (flags & 1) !== 0,
      internal: (flags & 2) !== 0,
    };
    lanes.push({ ...lane, ...(from ? { from } : {}), ...(to ? { to } : {}), ...(name ? { name } : {}) });
  }

  const nNodes = r.u32();
  const nodes: TrafficNode[] = [];
  for (let i = 0; i < nNodes; i++) {
    const id = packString(head, r.u16()) ?? `?${i}`;
    const x = r.f32() + ox;
    const z = r.f32() + oz;
    const kind = NODE_KIND[r.u8()] ?? 'junction';
    const signal = (r.u8() ? 1 : 0) as 0 | 1;
    nodes.push({ id, x, z, kind, signal });
  }

  const nConns = r.u32();
  const connectors: TrafficConnector[] = [];
  for (let i = 0; i < nConns; i++) {
    const inId = packString(head, r.u16()) ?? '';
    const outId = packString(head, r.u16()) ?? '';
    const node = packString(head, r.u16()) ?? '';
    const turn = TURN[r.u8()] ?? 'through';
    r.u8();
    connectors.push({ in: inId, out: outId, node, turn });
  }

  const carBudget = r.u16();
  const laneWeight = r.f32();
  if (!r.done) throw new Error('traffic pack: trailing bytes');

  return { cx: head.cx, cz: head.cz, key: head.key, positionFrame: head.positionFrame, lanes, nodes, connectors, carBudget, laneWeight };
}
