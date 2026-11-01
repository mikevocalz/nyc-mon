// The gen lane's cell spec (Phase 3 slice 1): what one 128 m cell of procedural infill holds,
// derived from the dataset before a single vertex exists. Zero disk — the spec is the only
// authority; buildings.ts emits the same arrays from the same spec every time, so an evicted
// cell regenerates byte-identical instead of caching the city (gen.test.ts pins that).
//
// Two lot sources, both cheap enough for the main thread:
//   * marked areas (dataset.areas): a school's grounds get a school block, a pitch a low
//     grandstand, and the green and hard open kinds are recorded as park markers — no massing
//     today, but the use tag rides the spec so the later slices (district authority, the VGC1
//     kinds, spawn/pednet consumers) never re-derive it;
//   * block interiors: the record data leaves courtyards and back lots empty — a fixed lot
//     grid per cell, seeded by cell key, fills a share of them, keeping clear of every
//     footprint, road corridor and marked area the index knows.
//
// Determinism: one mulberry32 stream per cell off GEN_SEED, consumed in a fixed order (areas
// in dataset order, then the 3 x 3 lot grid row-major), so the spec depends on nothing but the
// cell key and the dataset. Neighbour cells never consult each other: an area that spans two
// cells gets an independent clipped share in each.
import type { AreaKind, BuildingClass, FlatPoints } from '../../city-dataset.ts';
import { CELL, cellKey, cellNum } from '../cells/cell-rules.ts';
import { hashUnit, mulberry32, pairs, pointInRing } from '../geometry.ts';

/**
 * The stream's seed: ASCII 'GEN', picked for Phase 3 and deliberately far from
 * LIVING_CITY_SEED (0x1c2026, bundled-host.ts) and the bake's mulberry32 seed
 * (0x4a9011, tooling/city/build.mjs) so gen content can alias neither.
 */
export const GEN_SEED = 0x47454e;

/**
 * The per-cell seed: hashUnit's FNV-1a returns a fraction of 2^32; scaling back gives the u32
 * exactly (the fraction is h / 2^32 with h a u32, and doubles hold u32s whole). GEN_SEED rides
 * in the key, so a re-roll of the constant reseeds every cell without touching the sequence.
 */
export function genSeedFor(key: string): number {
  return Math.floor(hashUnit(`${GEN_SEED}:${key}`) * 0x100000000) >>> 0;
}

/**
 * The building-use vocabulary the dataset does not carry (v3 has class and style but no
 * use-type). `park` is the open-ground marker: a lot of it emits no massing in this slice —
 * it records the cell's open coverage for the consumers that arrive later.
 */
export const GEN_USES = ['school', 'office', 'stadium', 'park', 'home', 'mixed'] as const;
export type GenUse = (typeof GEN_USES)[number];

/** Valdrada STYLE ids a use rolls over (tooling/city/valdrada/decode.mjs STYLE 0–15, kept verbatim like the v3 `vs` field). */
const USE_RULES: Readonly<Record<GenUse, { class: BuildingClass; styles: readonly number[]; floors: readonly [number, number] }>> = {
  school: { class: 'civic', styles: [8 /* CIVIC_STONE */], floors: [3, 5] },
  // a pitch's low stand: the industrial typology, never tall
  stadium: { class: 'plain', styles: [7 /* INDUSTRIAL */], floors: [1, 2] },
  office: { class: 'glass', styles: [3 /* MODERN_GLASS */, 2 /* POSTWAR_BRICK */, 15 /* CONDO_NEW */], floors: [6, 14] },
  home: { class: 'brick', styles: [0 /* TENEMENT */, 5 /* ROWHOUSE */, 2 /* POSTWAR_BRICK */, 12 /* PROJECT_BRICK */], floors: [2, 6] },
  mixed: { class: 'brownstone', styles: [1 /* PREWAR_APT */, 10 /* RETAIL_STRIP */, 15 /* CONDO_NEW */], floors: [3, 9] },
  park: { class: 'plain', styles: [7], floors: [0, 0] },
};

/** Area kinds mapped into the use vocabulary: two build, the rest are open ground. */
const AREA_USE: Readonly<Record<AreaKind, GenUse>> = {
  school: 'school', pitch: 'stadium',
  park: 'park', garden: 'park', grass: 'park', playground: 'park',
  plaza: 'park', parking: 'park', water: 'park',
};

export interface GenLotSpec {
  readonly use: GenUse;
  /** Footprint rect, scene metres: [x0, z0, x1, z1], inside the cell's box. */
  readonly rect: readonly [number, number, number, number];
  readonly floors: number;
  readonly floorHeightMeters: number;
  readonly class: BuildingClass;
  readonly styleId: number;
  /** Per-lot draws in [0, 1) for the facade params (tone pick, tint jitter): salted, never re-rolled. */
  readonly salt: number;
  readonly salt2: number;
}

export interface GenSpec {
  readonly cx: number;
  readonly cz: number;
  /** cell-rules.ts `cx_cz`. */
  readonly key: string;
  /** cell-rules.ts cellNum. */
  readonly num: number;
  /** genSeedFor(key): the mulberry32 seed the emission would have consumed, kept for inspection. */
  readonly seed: number;
  readonly lots: readonly GenLotSpec[];
}

interface IndexedBox {
  /** [x0, z0, x1, z1]. */
  readonly box: readonly [number, number, number, number];
  /** The footprint as point pairs — rect-vs-ring keeps the gaps an L-shaped building's bbox would hide. */
  readonly ring: readonly (readonly [number, number])[];
}
interface IndexedArea extends IndexedBox {
  readonly kind: AreaKind;
  readonly ring: readonly (readonly [number, number])[];
}
interface IndexedRoad {
  readonly box: readonly [number, number, number, number];
  readonly points: FlatPoints;
  /** Half the corridor a lot must clear: carriageway/2 + sidewalk + the margin below. */
  readonly corridor: number;
}

export interface GenCellBucket {
  readonly buildings: readonly IndexedBox[];
  readonly areas: readonly IndexedArea[];
  readonly roads: readonly IndexedRoad[];
}

/** The dataset's keep-out geometry, bucketed by the 128 m cells it overlaps. Built once per world build. */
export interface GenIndex {
  readonly cells: ReadonlyMap<number, GenCellBucket>;
}

export interface GenSpecParams {
  readonly index: GenIndex;
  /** Share of eligible interior lots to fill, 0..1 (default GEN_FILL_SHARE). */
  readonly fillShare?: number;
  /**
   * Interior lot centres must pass this to build (the vd port hands its playable-bounds test,
   * so gen content stops with the tile). Default: everywhere.
   */
  readonly inside?: (x: number, z: number) => boolean;
}

/** A road's extra keep-out past its carriageway edge and sidewalk, metres. */
export const GEN_ROAD_MARGIN_M = 4;
/** An interior lot is offered a slot this share of the time (the rest stays the courtyard it is). */
export const GEN_FILL_SHARE = 0.5;
/** The interior lot grid: 4 x 4 slots of 28 m pitch centred in the cell's usable band — courtyard scale. */
export const GEN_LOT_SLOTS = 4;
const LOT_EDGE_M = 8;       // margin from the cell box to the usable band
const LOT_PITCH_M = 28;     // slot pitch: 4 slots x 28 m = 112 m, the band exactly
const LOT_MIN_M = 12;       // footprint short side range — a Manhattan courtyard is ~15-25 m
const LOT_SPAN_M = 10;
const LOT_JITTER_M = 2.5;   // centre jitter: a lot can never reach its neighbour's slot (half pitch 14 > 11 + 2.5)
const LOT_CLEAR_M = 1;      // clearance a lot keeps from a record footprint's edge
const AREA_MIN_M = 12;      // a clipped area thinner than this builds nothing in this cell
const SCHOOL_COVER = 0.7;   // a school block fills this share of its clipped box
const STAND_DEPTH_M = 12;   // a pitch's grandstand hugs the north edge
const FLOOR_HEIGHT_M = 3.4;

function ringBox(ring: FlatPoints): [number, number, number, number] {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i + 1 < ring.length; i += 2) {
    const x = ring[i]!, z = ring[i + 1]!;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return [x0, z0, x1, z1];
}

function roadBox(points: FlatPoints, pad: number): [number, number, number, number] {
  const b = ringBox(points);
  return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
}

/** The structural minimum the index reads — a v3 dataset satisfies it; tests pass less. */
export interface GenDataset {
  readonly buildings: readonly { readonly ring: FlatPoints }[];
  readonly areas: readonly { readonly kind: AreaKind; readonly ring: FlatPoints }[];
  readonly roads: readonly { readonly widthMeters: number; readonly sidewalkMeters: number; readonly points: FlatPoints }[];
}

/** Buckets every footprint, marked area and road corridor under the 128 m cells its box overlaps. */
export function buildGenIndex(dataset: GenDataset): GenIndex {
  const cells = new Map<number, { buildings: IndexedBox[]; areas: IndexedArea[]; roads: IndexedRoad[] }>();
  const bucketOf = (num: number) => {
    let b = cells.get(num);
    if (!b) cells.set(num, (b = { buildings: [], areas: [], roads: [] }));
    return b;
  };
  const each = (box: readonly [number, number, number, number], put: (num: number) => void) => {
    for (let cx = Math.floor(box[0] / CELL); cx <= Math.floor(box[2] / CELL); cx++) {
      for (let cz = Math.floor(box[1] / CELL); cz <= Math.floor(box[3] / CELL); cz++) put(cellNum(cx, cz));
    }
  };
  for (const b of dataset.buildings) {
    const box = ringBox(b.ring);
    each(box, (num) => bucketOf(num).buildings.push({ box, ring: pairs(b.ring) }));
  }
  for (const a of dataset.areas) {
    const box = ringBox(a.ring);
    each(box, (num) => bucketOf(num).areas.push({ kind: a.kind, box, ring: pairs(a.ring) }));
  }
  for (const r of dataset.roads) {
    const corridor = r.widthMeters / 2 + r.sidewalkMeters + GEN_ROAD_MARGIN_M;
    const box = roadBox(r.points, corridor);
    each(box, (num) => bucketOf(num).roads.push({ points: r.points, box, corridor }));
  }
  return { cells };
}

/**
 * A lot clears a building when its rect (plus LOT_CLEAR_M) stays off the footprint: the bbox is
 * the fast reject, then the ring's edges against the rect and the centre inside the ring — the
 * rect-vs-ring form, so an L-shaped or diagonal footprint keeps the gaps its bbox would hide.
 */
function buildingClears(rect: readonly [number, number, number, number], b: IndexedBox): boolean {
  const [x0, z0, x1, z1] = [rect[0] - LOT_CLEAR_M, rect[1] - LOT_CLEAR_M, rect[2] + LOT_CLEAR_M, rect[3] + LOT_CLEAR_M];
  if (x1 <= b.box[0] || x0 >= b.box[2] || z1 <= b.box[1] || z0 >= b.box[3]) return true;
  const r = b.ring, cx = (rect[0] + rect[2]) / 2, cz = (rect[1] + rect[3]) / 2;
  if (pointInRing(cx, cz, r)) return false;
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!, c = r[(i + 1) % r.length]!;
    if (segmentHitsBox(a[0], a[1], c[0], c[1], x0, z0, x1, z1)) return false;
  }
  return true;
}

/**
 * Whether a segment crosses an axis-aligned box (slab test: the t range where the segment is
 * inside the box on x, intersected with the same on z). Used for road corridors — a lot is
 * rejected when the corridor reaches its footprint, not when it passes near its centre, so
 * mid-block lots a corridor's width off the street survive.
 */
function segmentHitsBox(ax: number, az: number, bx: number, bz: number, x0: number, z0: number, x1: number, z1: number): boolean {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, x0, x1], [az, dz, z0, z1]] as const) {
    if (d === 0) {
      if (p < lo || p > hi) return false;
    } else {
      let ta = (lo - p) / d, tb = (hi - p) / d;
      if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** A lot survives when no road corridor (carriageway/2 + sidewalk + margin) reaches its rect. */
function roadClears(rect: readonly [number, number, number, number], roads: readonly IndexedRoad[]): boolean {
  for (const r of roads) {
    // the corridor reaches the lot if the centreline crosses the rect inflated by it
    const x0 = rect[0] - r.corridor, z0 = rect[1] - r.corridor;
    const x1 = rect[2] + r.corridor, z1 = rect[3] + r.corridor;
    if (x1 < r.box[0] || x0 > r.box[2] || z1 < r.box[1] || z0 > r.box[3]) continue;
    const p = r.points;
    for (let i = 0; i + 3 < p.length; i += 2) {
      if (segmentHitsBox(p[i]!, p[i + 1]!, p[i + 2]!, p[i + 3]!, x0, z0, x1, z1)) return false;
    }
  }
  return true;
}

/**
 * One cell's spec. `index` is buildGenIndex's output; every lot is inside the cell's box and
 * clear of the keep-out geometry the index knows. The draw order is fixed: areas in dataset
 * order (two draws each), then the lot grid row-major (nine draws each — every candidate
 * consumes its full share whether or not it survives, so a rejected slot never shifts a
 * later one's roll).
 */
export function genSpecForCell(cx: number, cz: number, params: GenSpecParams): GenSpec {
  const key = cellKey(cx, cz);
  const seed = genSeedFor(key);
  const rng = mulberry32(seed);
  const x0 = cx * CELL, z0 = cz * CELL;
  const bucket = params.index.cells.get(cellNum(cx, cz));
  const lots: GenLotSpec[] = [];

  // Marked areas. A school builds on the bulk of its clipped box; a pitch gets a low stand on
  // its north edge; the open kinds record their coverage with no massing (floors 0).
  if (bucket) {
    for (const area of bucket.areas) {
      const r1 = rng(), salt = rng();
      const ax0 = Math.max(area.box[0], x0), az0 = Math.max(area.box[1], z0);
      const ax1 = Math.min(area.box[2], x0 + CELL), az1 = Math.min(area.box[3], z0 + CELL);
      const w = ax1 - ax0, d = az1 - az0;
      if (w < AREA_MIN_M || d < AREA_MIN_M) continue;
      const use = AREA_USE[area.kind];
      const rule = USE_RULES[use];
      let rect: readonly [number, number, number, number];
      if (use === 'school') {
        const iw = (w * (1 - SCHOOL_COVER)) / 2, id = (d * (1 - SCHOOL_COVER)) / 2;
        rect = [ax0 + iw, az0 + id, ax1 - iw, az1 - id];
      } else if (use === 'stadium') {
        rect = [ax0 + 4, az0 + 4, ax1 - 4, Math.min(az0 + 4 + STAND_DEPTH_M, az0 + d * 0.4)];
      } else {
        rect = [ax0, az0, ax1, az1];
      }
      const [f0, f1] = rule.floors;
      const floors = f0 === f1 ? f0 : f0 + Math.floor(r1 * (f1 - f0 + 1));
      lots.push({
        use, rect, floors, floorHeightMeters: FLOOR_HEIGHT_M, class: rule.class,
        styleId: rule.styles[Math.floor(salt * rule.styles.length) % rule.styles.length]!,
        salt, salt2: 1 - salt,
      });
    }
  }

  // Block interiors. A candidate occupies one 38 m slot of the 3 x 3 grid; it is rejected by
  // the keep roll, a record footprint (its box — conservative, a triangular footprint keeps a
  // little extra clearance), a road corridor, or a marked area's ring.
  const fill = params.fillShare ?? GEN_FILL_SHARE;
  const band = LOT_EDGE_M;
  for (let i = 0; i < GEN_LOT_SLOTS; i++) {
    for (let j = 0; j < GEN_LOT_SLOTS; j++) {
      const jx = (rng() - 0.5) * LOT_JITTER_M;
      const jz = (rng() - 0.5) * LOT_JITTER_M;
      const w = LOT_MIN_M + rng() * LOT_SPAN_M;
      const d = LOT_MIN_M + rng() * LOT_SPAN_M;
      const keep = rng();
      const useR = rng();
      const styleR = rng();
      const floorR = rng();
      const salt = rng();
      if (keep >= fill) continue;
      const gx = x0 + band + LOT_PITCH_M / 2 + i * LOT_PITCH_M + jx;
      const gz = z0 + band + LOT_PITCH_M / 2 + j * LOT_PITCH_M + jz;
      const lx = Math.min(Math.max(gx, x0 + band + w / 2), x0 + CELL - band - w / 2);
      const lz = Math.min(Math.max(gz, z0 + band + d / 2), z0 + CELL - band - d / 2);
      const rect: readonly [number, number, number, number] = [lx - w / 2, lz - d / 2, lx + w / 2, lz + d / 2];
      if (params.inside && !params.inside(lx, lz)) continue;
      if (bucket) {
        if (!bucket.buildings.every((b) => buildingClears(rect, b))) continue;
        if (!roadClears(rect, bucket.roads)) continue;
        if (bucket.areas.some((a) => pointInRing(lx, lz, a.ring))) continue;
      }
      const use: GenUse = useR < 0.55 ? 'home' : useR < 0.85 ? 'mixed' : 'office';
      const rule = USE_RULES[use];
      const [f0, f1] = rule.floors;
      lots.push({
        use, rect, floors: f0 + Math.floor(floorR * (f1 - f0 + 1)), floorHeightMeters: FLOOR_HEIGHT_M,
        class: rule.class,
        styleId: rule.styles[Math.floor(styleR * rule.styles.length) % rule.styles.length]!,
        salt, salt2: styleR,
      });
    }
  }

  return { cx, cz, key, num: cellNum(cx, cz), seed, lots };
}
