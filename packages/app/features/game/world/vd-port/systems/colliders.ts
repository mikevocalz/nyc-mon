// The per-cell collider package loader (VGC1 kind 1), the read half of
// tooling/city/vd-port/write-colliders.mjs. Building footprints arrive as prisms — footprint ring plus
// courtyard holes, extruded baseY to baseY + height — alongside the street pieces and furniture that share
// the cell. Everything comes back in absolute scene metres; `positionFrame` is the cell centre the pack's
// local coordinates were stored around, for consumers that would rather stay cell-local.
//
// A prism that straddles a cell seam is registered in every cell it touches (Valdrada's own addPrism rule,
// city/colliders.js) and carries `srcId` — (tile, record index) — so a consumer stitching cells can dedupe.
//
// Pure decoder + point queries: no three.js, no platform IO.
import { PACK_KIND, openPack, packString, type PositionFrame } from './cell-pack.ts';

/** A building footprint extruded from its base to its top — Valdrada's collision prism. */
export interface ColliderPrism {
  /** (tile, building index) — stable across cells for dedupe. */
  readonly srcId: number;
  /** Outer ring, absolute scene metres, [x, z] pairs. */
  readonly ring: readonly (readonly [number, number])[];
  /** Courtyard holes (interior rings a body may enter). */
  readonly holes: readonly (readonly (readonly [number, number])[])[];
  /** Bottom / top on Valdrada's height datum. */
  readonly y0: number;
  readonly y1: number;
  readonly style: number;
  readonly landmarkId: number;
  readonly flags: number;
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}

/** One street-network piece, verbatim Valdrada fields plus its centreline in absolute scene metres. */
export interface ColliderRoad {
  /** The emitter's registration key, `t<tx>_<tz>:<index>`. */
  readonly id: string;
  /** CSCL physicalid — the same street keeps it across pieces and tiles. */
  readonly segId: number;
  readonly name?: string;
  readonly rclass: number;
  readonly noTraffic: boolean;
  readonly oneway: -1 | 0 | 1;
  readonly lanes: number;
  readonly park: number;
  readonly level: number;
  readonly speed: number;
  readonly widthMeters: number;
  /** Junction-mouth distance at each end (compile-time junction box reach). */
  readonly mouthA: number;
  readonly mouthB: number;
  /** Centreline in stored order, [x, y, z]: x/z absolute scene, y the road's grade. */
  readonly points: readonly (readonly [number, number, number])[];
}

export interface ColliderFurniture {
  readonly k: number;
  readonly p0: number;
  readonly p1: number;
  readonly p2: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rot: number;
}

export interface ColliderCellPackage {
  readonly cx: number;
  readonly cz: number;
  readonly key: string;
  readonly positionFrame: PositionFrame;
  readonly prisms: readonly ColliderPrism[];
  readonly roads: readonly ColliderRoad[];
  readonly furniture: readonly ColliderFurniture[];
}

/** Decodes one `colliders/<cx>_<cz>` pack. Throws on a foreign or torn pack. */
export function decodeColliderCell(bytes: Uint8Array): ColliderCellPackage {
  const { head, r } = openPack(bytes, PACK_KIND.colliders);
  const { x: ox, z: oz } = head.positionFrame;

  const nPrisms = r.u32();
  const prisms: ColliderPrism[] = [];
  for (let i = 0; i < nPrisms; i++) {
    const srcId = r.u32();
    const ringLen = r.u16();
    const nHoles = r.u8();
    const style = r.u8();
    const landmarkId = r.i16();
    const flags = r.u8();
    const y0 = r.f32();
    const y1 = r.f32();
    const minX = r.f32() + ox;
    const minZ = r.f32() + oz;
    const maxX = r.f32() + ox;
    const maxZ = r.f32() + oz;
    const ring: [number, number][] = [];
    for (let v = 0; v < ringLen; v++) ring.push([r.f32() + ox, r.f32() + oz]);
    const holes: [number, number][][] = [];
    for (let h = 0; h < nHoles; h++) {
      const len = r.u16();
      const hole: [number, number][] = [];
      for (let v = 0; v < len; v++) hole.push([r.f32() + ox, r.f32() + oz]);
      holes.push(hole);
    }
    prisms.push({ srcId, ring, holes, y0, y1, style, landmarkId, flags, minX, minZ, maxX, maxZ });
  }

  const nRoads = r.u32();
  const roads: ColliderRoad[] = [];
  for (let i = 0; i < nRoads; i++) {
    const id = packString(head, r.u16()) ?? `?${i}`;
    const segId = r.u32();
    const name = packString(head, r.u16());
    const rclassByte = r.u8();
    const oneway = r.i8() as -1 | 0 | 1;
    const lanes = r.u8();
    const park = r.u8();
    const level = r.u8();
    const speed = r.u8();
    const widthMeters = r.f32();
    const mouthA = r.f32();
    const mouthB = r.f32();
    const npts = r.u16();
    const points: [number, number, number][] = [];
    for (let v = 0; v < npts; v++) points.push([r.f32() + ox, r.f32(), r.f32() + oz]);
    const road: ColliderRoad = {
      id,
      segId,
      rclass: rclassByte & 0x7f,
      noTraffic: (rclassByte & 0x80) !== 0,
      oneway,
      lanes,
      park,
      level,
      speed,
      widthMeters,
      mouthA,
      mouthB,
      points,
    };
    if (name !== undefined) roads.push({ ...road, name });
    else roads.push(road);
  }

  const nFurn = r.u32();
  const furniture: ColliderFurniture[] = [];
  for (let i = 0; i < nFurn; i++) {
    const k = r.u8();
    const p0 = r.u8();
    const p1 = r.u8();
    const p2 = r.u8();
    const x = r.f32() + ox;
    const z = r.f32() + oz;
    const y = r.f32();
    const rot = r.f32();
    furniture.push({ k, p0, p1, p2, x, y, z, rot });
  }
  if (!r.done) throw new Error('collider pack: trailing bytes');

  return { cx: head.cx, cz: head.cz, key: head.key, positionFrame: head.positionFrame, prisms, roads, furniture };
}

// --- Point queries -----------------------------------------------------------------------------------
// Same even-odd rule as decode.mjs inRing / walkability.ts pointInRing.

/** Even-odd point-in-ring. */
export function pointInRing(x: number, z: number, ring: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]!;
    const [xj, zj] = ring[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Inside the footprint but not a courtyard hole — where a body may not stand. */
export function pointInPrism(x: number, z: number, prism: ColliderPrism, pad = 0): boolean {
  if (x < prism.minX - pad || x > prism.maxX + pad || z < prism.minZ - pad || z > prism.maxZ + pad) return false;
  if (!pointInRing(x, z, prism.ring)) return false;
  return !prism.holes.some((hole) => pointInRing(x, z, hole));
}

/** The prism under a point, or null — a ground-level stand test (y range ignored; see walkability.ts). */
export function prismAt(cell: ColliderCellPackage, x: number, z: number, pad = 0): ColliderPrism | null {
  for (const p of cell.prisms) if (pointInPrism(x, z, p, pad)) return p;
  return null;
}
