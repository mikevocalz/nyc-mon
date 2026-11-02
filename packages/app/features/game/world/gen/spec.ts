// The gen lane's cell spec (Phase 3 slices 1 + 4): what one 128 m cell of procedural infill
// holds, derived before a single vertex exists. Zero disk — the spec is the only authority;
// buildings.ts emits the same arrays from the same spec every time, so an evicted cell
// regenerates byte-identical instead of caching the city (gen.test.ts pins that).
//
// Three lot sources, all cheap enough for the main thread:
//   * marked areas (dataset.areas): a school's grounds get a school block, a pitch a low
//     grandstand, and the green and hard open kinds are recorded as park markers — no massing
//     today, but the use tag rides the spec so the later slices (district authority, the VGC1
//     kinds, spawn/pednet consumers) never re-derive it;
//   * block interiors: the record data leaves courtyards and back lots empty — a fixed lot
//     grid per cell, seeded by cell key, fills a share of them, keeping clear of every
//     footprint, road corridor and marked area the index knows;
//   * the district profile (slice 4): a cell outside the records square that the index does
//     not know fills the same lot grid at its district's density and use mix — deterministic
//     from the cell key alone, no dataset needed (genDistrictForCell). The spec's `source`
//     field records which derivation ran.
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
  /** The marked area kind the lot derives from, when it does — interior fills carry none.
   * Lets places.ts name 'park' vs 'plaza' vs 'pitch' without re-deriving the AREA_USE fold. */
  readonly area?: AreaKind;
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
  /**
   * Which derivation produced the lots (Phase 3 slice 4): 'records' — the
   * dataset-aware path (marked areas + keep-out-gated interior fill), or
   * 'district' — the dataset-free path for cells outside the records square
   * (genDistrictForCell's profile fill). Consumers may treat them alike; the
   * tag exists so coverage audits can tell seeded infill from record-derived.
   */
  readonly source: 'records' | 'district';
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
  /** Share of eligible interior lots to fill, 0..1 (default GEN_FILL_SHARE / the district's `fill`). */
  readonly fillShare?: number;
  /**
   * Interior lot centres must pass this to build (the vd port hands its playable-bounds test,
   * so gen content stops with the tile). Records-branch lots only: a district-fill cell is
   * ungated — its whole cell box is the spec's claim, and the caller's enumeration is the bound.
   * Default: everywhere.
   */
  readonly inside?: (x: number, z: number) => boolean;
  /**
   * Half the dataset's coverage square, metres (the tile's `extentMeters`). When set, a cell
   * whose centre falls outside it AND that the index does not know takes the district profile
   * (genDistrictForCell) instead of the records path: no keep-outs exist for it, so its fill is
   * the district density and its use mix the district weights. Omitting it keeps every cell on
   * the records path — the pre-slice-4 behaviour, byte-identical.
   */
  readonly recordsExtentMeters?: number;
}

// ---- the district profile (Phase 3 slice 4) --------------------------------------------------
//
// The dataset-free density model: where there are no records, a cell's fill and use mix come
// from a plausible NYC-grade radial profile around the tile centre (125th St — x east, z south).
// The bands are deterministic geometry plus a per-cell wobble from
// `hashUnit('gen:district:'+key)`, so the district boundary is ragged like a real district's,
// not a clean circle — the procedural-modeling skill's seed rule (expose the seed, deterministic
// variation) applied at district scope.
//
//   core   the Manhattan spine: southerly cells within ~11 km (Midtown through Downtown) —
//          office-led, near-full blocks, taller massing.
//   mid    the near surroundings in every direction plus the spine continuing south —
//          home+mixed, the Upper Manhattan / inner-borough texture.
//   edge   the rest of the five-borough bbox scale (~19 km) — home-led, sparse, park share up.
//   open   beyond the borough scale — scattered low fill, mostly open ground.
//
// `fill` is the keep-roll threshold over the interior lot grid; `parkShare` of kept slots
// records open ground instead of massing; `weights` spreads the built uses; `floorsAdd`
// stretches the top of every built use's floor range (the core's towers).

/** The district vocabulary, lowest to highest density. */
export const GEN_DISTRICT_NAMES = ['open', 'edge', 'mid', 'core'] as const;
export type GenDistrictName = (typeof GEN_DISTRICT_NAMES)[number];

/** The uses a district roll can build — 'park' comes from `parkShare`, not the weights. */
const GEN_BUILT_USES = ['home', 'mixed', 'office', 'school', 'stadium'] as const;
export type GenBuiltUse = (typeof GEN_BUILT_USES)[number];

export interface GenDistrict {
  readonly name: GenDistrictName;
  /** Keep-roll threshold for the 15 non-anchor slots of the lot grid. */
  readonly fill: number;
  /** Share of kept slots recorded as open ground (a 'park' marker lot, no massing). */
  readonly parkShare: number;
  /** Built-use mix, sums to 1 over GEN_BUILT_USES. */
  readonly weights: Readonly<Record<GenBuiltUse, number>>;
  /** Added to the top of every built use's floor range — the district's skyline bias. */
  readonly floorsAdd: number;
}

export const GEN_DISTRICTS: Readonly<Record<GenDistrictName, GenDistrict>> = {
  core: {
    name: 'core',
    fill: 0.88,
    parkShare: 0.02,
    weights: { home: 0.11, mixed: 0.3, office: 0.55, school: 0.02, stadium: 0.02 },
    floorsAdd: 6,
  },
  mid: {
    name: 'mid',
    fill: 0.6,
    parkShare: 0.06,
    weights: { home: 0.45, mixed: 0.3, office: 0.15, school: 0.03, stadium: 0.02 },
    floorsAdd: 2,
  },
  edge: {
    name: 'edge',
    fill: 0.38,
    parkShare: 0.15,
    weights: { home: 0.55, mixed: 0.15, office: 0.05, school: 0.1, stadium: 0.15 },
    floorsAdd: 0,
  },
  open: {
    name: 'open',
    fill: 0.14,
    parkShare: 0.3,
    weights: { home: 0.5, mixed: 0.08, office: 0.02, school: 0.1, stadium: 0.3 },
    floorsAdd: 0,
  },
};

/** The Manhattan core's reach down the southerly spine, metres from the tile centre — the
 * office-led band runs between these radii (the nearer ground stays residential 'mid'). */
export const GEN_CORE_MIN_R_M = 5_000;
export const GEN_CORE_R_M = 11_000;
/** Southerly cone half-angle as z/r: the spine is where the cell sits mostly south of the tile. */
export const GEN_CORE_SOUTH = 0.45;
/** The mid band: a near disc in every direction, and further down the spine. */
export const GEN_MID_R_M = 3_200;
export const GEN_MID_SPINE_R_M = 14_000;
export const GEN_MID_SOUTH = 0.3;
/** Five-borough scale — beyond it the profile thins to 'open'. */
export const GEN_EDGE_R_M = 19_000;
/** The per-cell radial wobble's full width, metres — band edges fray by half of it each way. */
const GEN_DISTRICT_JITTER_M = 1_600;

/**
 * One cell's district, deterministic from its key alone: radial bands off the tile centre
 * wobbled by `hashUnit('gen:district:'+key)` so district edges fray instead of drawing a clean
 * circle. Cheap — one hash and a hypot — and pure: the same cell answers the same district on
 * every call, on every host, with no dataset in scope.
 */
export function genDistrictForCell(cx: number, cz: number): GenDistrict {
  const x = cx * CELL + CELL / 2, z = cz * CELL + CELL / 2;
  const d = Math.hypot(x, z);
  const r = d + (hashUnit(`gen:district:${cellKey(cx, cz)}`) - 0.5) * GEN_DISTRICT_JITTER_M;
  const south = d > 1 ? z / d : 0;
  if (south > GEN_CORE_SOUTH && r > GEN_CORE_MIN_R_M && r <= GEN_CORE_R_M) return GEN_DISTRICTS.core;
  if (r <= GEN_MID_R_M || (south > GEN_MID_SOUTH && r <= GEN_MID_SPINE_R_M)) return GEN_DISTRICTS.mid;
  if (r <= GEN_EDGE_R_M) return GEN_DISTRICTS.edge;
  return GEN_DISTRICTS.open;
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

/** The tallest thing a district cell can raise: office's top range plus the core's floorsAdd. */
export const GEN_MAX_HEIGHT_M = (USE_RULES.office.floors[1] + GEN_DISTRICTS.core.floorsAdd) * FLOOR_HEIGHT_M;

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
  // The slice-4 branch: a cell the index does not know and whose centre sits outside the
  // records square fills from its district profile — no records exist for it, so nothing is
  // kept out of and the `inside` gate does not apply. Every other cell takes the records path
  // verbatim (a bucket-less cell inside the square included), which is what keeps covered-cell
  // specs byte-identical to before the district path existed.
  const district = bucket === undefined && params.recordsExtentMeters !== undefined &&
    (Math.abs(x0 + CELL / 2) > params.recordsExtentMeters || Math.abs(z0 + CELL / 2) > params.recordsExtentMeters)
    ? genDistrictForCell(cx, cz)
    : null;
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
        use, area: area.kind, rect, floors, floorHeightMeters: FLOOR_HEIGHT_M, class: rule.class,
        styleId: rule.styles[Math.floor(salt * rule.styles.length) % rule.styles.length]!,
        salt, salt2: 1 - salt,
      });
    }
  }

  // Block interiors. A candidate occupies one 38 m slot of the 3 x 3 grid; it is rejected by
  // the keep roll, a record footprint (its box — conservative, a triangular footprint keeps a
  // little extra clearance), a road corridor, or a marked area's ring. Records cells only —
  // a district cell's grid runs below, off its profile.
  const fill = params.fillShare ?? GEN_FILL_SHARE;
  const band = LOT_EDGE_M;
  if (!district) for (let i = 0; i < GEN_LOT_SLOTS; i++) {
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

  // The district profile fill (Phase 3 slice 4): the same 4 x 4 slot grid and the same nine
  // draws per candidate — the seeded-slot contract holds across both branches — but the keep
  // roll answers the district's density, the use roll walks its weights after the park share,
  // and slot (0, 0) is the anchor: always built, never park, so every district cell raises at
  // least one massing box. No keep-outs run (the index knows nothing here) and `inside` is not
  // consulted — the caller's enumeration bounds where district content may stand.
  if (district) {
    const fill = params.fillShare ?? district.fill;
    const openTop = 1 - district.parkShare;
    const pickUse = (useR: number, built: boolean): GenUse => {
      if (built && useR >= openTop) return 'park';
      const t = built ? useR / openTop : useR;
      let acc = 0;
      for (const u of GEN_BUILT_USES) {
        acc += district.weights[u];
        if (t < acc) return u;
      }
      return 'home';
    };
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
        const anchor = i === 0 && j === 0;
        if (!anchor && keep >= fill) continue;
        const gx = x0 + band + LOT_PITCH_M / 2 + i * LOT_PITCH_M + jx;
        const gz = z0 + band + LOT_PITCH_M / 2 + j * LOT_PITCH_M + jz;
        const lx = Math.min(Math.max(gx, x0 + band + w / 2), x0 + CELL - band - w / 2);
        const lz = Math.min(Math.max(gz, z0 + band + d / 2), z0 + CELL - band - d / 2);
        const rect: readonly [number, number, number, number] = [lx - w / 2, lz - d / 2, lx + w / 2, lz + d / 2];
        const use = pickUse(useR, !anchor);
        const rule = USE_RULES[use];
        const [f0, f1] = rule.floors;
        const top = use === 'park' ? f1 : f1 + district.floorsAdd;
        lots.push({
          use, rect, floors: f0 === top ? f0 : f0 + Math.floor(floorR * (top - f0 + 1)), floorHeightMeters: FLOOR_HEIGHT_M,
          class: rule.class,
          styleId: rule.styles[Math.floor(styleR * rule.styles.length) % rule.styles.length]!,
          salt, salt2: styleR,
        });
      }
    }
  }

  return { cx, cz, key, num: cellNum(cx, cz), seed, source: district ? 'district' : 'records', lots };
}
