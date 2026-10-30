// The per-cell pedestrian network loader (VGC1 kind 2), the read half of
// tooling/city/vd-port/write-pednet.mjs — Valdrada's procedural-walker spec (client/src/sim/peds.js) in data:
// sidewalk walk lines offset from the real street graph, kerb-to-kerb crosswalk legs at junctions, and the
// cell's share of the PED_TARGET crowd budget. This is the cell-keyed equivalent of living-city's
// WalkEdge/XwalkLeg sidecar (topology.ts): ped-sim.ts walks `walk:` bands and crosses on `xwalk:` legs, and
// this pack hands a cell the same shapes with the node ids to stitch its neighbours' packs to.
//
// Procedural walkers only — Valdrada's rig/animation side is not part of the data (the app's ped-actor.ts
// owns rendering). Pure decoder: no three.js, no platform IO.
import { PACK_KIND, openPack, packString, type PositionFrame } from './cell-pack.ts';

/** peds.js edge kinds: 'street' / 'narrow' sidewalk lines and 'path' footway runs. */
export type PedEdgeKind = 'street' | 'narrow' | 'path';
const EDGE_KIND: readonly PedEdgeKind[] = ['street', 'narrow', 'path'];
export type PedNodeKind = 'junction' | 'link' | 'deadEnd' | 'boundary';
const NODE_KIND: readonly PedNodeKind[] = ['junction', 'link', 'deadEnd', 'boundary'];

/** One sidewalk band or footway run — the WalkEdge shape (topology.ts) plus Valdrada's footfall weight. */
export interface PedWalkEdge {
  /** `w:t<tx>_<tz>:<road index>:<l|r|p<run>>` — l/r is the band's side of the stored polyline. */
  readonly id: string;
  /** Junction node ids at each end (`n:` ids, shared with the traffic pack); undefined on footway runs. */
  readonly nodeA?: string;
  readonly nodeB?: string;
  /** CSCL physicalid of the street it runs beside. */
  readonly segId: number;
  /** -1 right of the stored polyline, +1 left, 0 for centre-line footway runs. */
  readonly side: -1 | 0 | 1;
  readonly kind: PedEdgeKind;
  /** peds.js `busy`: 5 pedestrianised, 4 avenues, 1 locals, 0.6 paths — a spawn-density weight. */
  readonly busy: number;
  /** Signed centreline offset used to place the line, metres (+ = left of the stored polyline). */
  readonly offsetMeters: number;
  /** Centreline, [x, y, z] absolute scene metres; y is the road grade. */
  readonly points: readonly (readonly [number, number, number])[];
  readonly lengthMeters: number;
}

export interface PedNode {
  /** `n:<x*10>_<z*10>` on absolute scene metres — stable across cells and tiles. */
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly kind: PedNodeKind;
  /** Compiler's signalized-junction flag (1 = signal heads + crossings are controlled). */
  readonly signal: 0 | 1;
}

/** A kerb-to-kerb crossing over one approach of a junction — the XwalkLeg shape. */
export interface PedXwalk {
  /** `x:<site id>:<approach index>`: the streetNYC attach site the crossing hangs off (approaches sorted by azimuth). */
  readonly id: string;
  readonly node: string;
  /** CSCL physicalid of the street it crosses. */
  readonly segId: number;
  /** Centreline endpoints on the two sidewalk bands, [x, z] absolute. */
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  /** Half the carriageway it spans (kerb to kerb), metres. */
  readonly kerbHalfMeters: number;
  /** Crossing depth along the street (XW_DEPTH: 7.62 m on wide avenues, 4.57 m elsewhere). */
  readonly depthMeters: number;
  /** Crossing direction, radians (atan2 of the lateral). */
  readonly angle: number;
  readonly signal: 0 | 1;
  readonly lengthMeters: number;
}

export interface PedCellPackage {
  readonly cx: number;
  readonly cz: number;
  readonly key: string;
  readonly positionFrame: PositionFrame;
  readonly edges: readonly PedWalkEdge[];
  /** Junction nodes that fall inside this cell (edges may reference nodes living in neighbouring cells). */
  readonly nodes: readonly PedNode[];
  readonly xwalks: readonly PedXwalk[];
  /** The cell's share of Valdrada's PED_TARGET crowd, split by busy-weighted walk metres. */
  readonly pedBudget: number;
  /** The busy-weighted walk metres behind `pedBudget` (per 0.1 of a busy unit). */
  readonly walkWeight: number;
}

function lengthOf(pts: readonly (readonly [number, number, number])[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![2] - pts[i - 1]![2]);
  return l;
}

/** Decodes one `pednet/<cx>_<cz>` pack. Throws on a foreign or torn pack. */
export function decodePedCell(bytes: Uint8Array): PedCellPackage {
  const { head, r } = openPack(bytes, PACK_KIND.pednet);
  const { x: ox, z: oz } = head.positionFrame;

  const nEdges = r.u32();
  const edges: PedWalkEdge[] = [];
  for (let i = 0; i < nEdges; i++) {
    const id = packString(head, r.u16()) ?? `?${i}`;
    const nodeA = packString(head, r.u16());
    const nodeB = packString(head, r.u16());
    const segId = r.u32();
    const sideB = r.u8();
    const kind = EDGE_KIND[r.u8()] ?? 'street';
    const busy = r.u8() / 10;
    r.u8();
    const offsetMeters = r.f32();
    const npts = r.u16();
    const points: [number, number, number][] = [];
    for (let v = 0; v < npts; v++) points.push([r.f32() + ox, r.f32(), r.f32() + oz]);
    const edge: PedWalkEdge = {
      id,
      segId,
      side: (sideB === 1 ? -1 : sideB === 2 ? 1 : 0) as -1 | 0 | 1,
      kind,
      busy,
      offsetMeters,
      points,
      lengthMeters: lengthOf(points),
    };
    edges.push({ ...edge, ...(nodeA ? { nodeA } : {}), ...(nodeB ? { nodeB } : {}) });
  }

  const nNodes = r.u32();
  const nodes: PedNode[] = [];
  for (let i = 0; i < nNodes; i++) {
    const id = packString(head, r.u16()) ?? `?${i}`;
    const x = r.f32() + ox;
    const z = r.f32() + oz;
    const kind = NODE_KIND[r.u8()] ?? 'junction';
    const signal = (r.u8() ? 1 : 0) as 0 | 1;
    nodes.push({ id, x, z, kind, signal });
  }

  const nXwalks = r.u32();
  const xwalks: PedXwalk[] = [];
  for (let i = 0; i < nXwalks; i++) {
    const id = packString(head, r.u16()) ?? `?${i}`;
    const node = packString(head, r.u16()) ?? '';
    const segId = r.u32();
    const a: [number, number] = [r.f32() + ox, r.f32() + oz];
    const b: [number, number] = [r.f32() + ox, r.f32() + oz];
    const kerbHalfMeters = r.f32();
    const depthMeters = r.f32();
    const angle = r.f32();
    const signal = (r.u8() ? 1 : 0) as 0 | 1;
    r.u8();
    xwalks.push({
      id, node, segId, a, b, kerbHalfMeters, depthMeters, angle, signal,
      lengthMeters: Math.hypot(b[0] - a[0], b[1] - a[1]),
    });
  }

  const pedBudget = r.u16();
  const walkWeight = r.f32();
  if (!r.done) throw new Error('pednet pack: trailing bytes');

  return { cx: head.cx, cz: head.cz, key: head.key, positionFrame: head.positionFrame, edges, nodes, xwalks, pedBudget, walkWeight };
}
