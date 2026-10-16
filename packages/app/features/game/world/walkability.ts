// Where a Caller may stand, from the same tile the scene draws. Pure maths
// over the parsed dataset, no three import:
//   blocked  inside a building footprint (plus the body radius), or water
//   walkable on a road or its sidewalks, a footway, a park, garden, lawn,
//            pitch, playground, plaza, parking lot or school yard
//   blocked  everything else (back yards and unmapped lots inside blocks),
//            and anywhere outside the tile
// Ground is flat today: the tile carries no elevation, so height is 0.
import type { CityDatasetV2, FlatPoints, RoadClass } from '../city-dataset.ts';
import { pairs, pointInRing, segmentDistanceSq } from './geometry.ts';

/** Roads the road mesh draws as sidewalk, not carriageway (city-mesh.ts). Everything else, crossings included, is carriageway. */
export const WALKWAY_CLASSES: ReadonlySet<RoadClass> = new Set(['footway', 'sidewalk', 'cycleway', 'pedestrian']);

/** Half the Caller's shoulder width, metres: the figure stops this far from a wall. */
export const BODY_RADIUS = 0.3;
const CELL = 32;

export interface WalkQueries {
  readonly isWalkable: (x: number, z: number) => boolean;
  readonly groundHeight: (x: number, z: number) => number;
}

interface Polygon { ring: [number, number][]; holes: [number, number][][]; minX: number; maxX: number; minZ: number; maxZ: number }
interface Segment { ax: number; az: number; bx: number; bz: number; reach: number }

function polygon(ring: FlatPoints, holes: readonly FlatPoints[]): Polygon {
  const points = pairs(ring);
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  for (const [x, z] of points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { ring: points, holes: holes.map(pairs), minX, maxX, minZ, maxZ };
}

function contains(p: Polygon, x: number, z: number, pad = 0): boolean {
  if (x < p.minX - pad || x > p.maxX + pad || z < p.minZ - pad || z > p.maxZ + pad) return false;
  if (!pointInRing(x, z, p.ring)) return false;
  return !p.holes.some((hole) => pointInRing(x, z, hole));
}

/** A uniform grid of buckets keyed by cell, so each query tests only nearby features. */
class Grid<T> {
  private readonly cells = new Map<number, T[]>();
  add(item: T, minX: number, minZ: number, maxX: number, maxZ: number): void {
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const key = cx * 100_003 + cz;
        const list = this.cells.get(key);
        if (list) list.push(item); else this.cells.set(key, [item]);
      }
    }
  }
  at(x: number, z: number): readonly T[] {
    return this.cells.get(Math.floor(x / CELL) * 100_003 + Math.floor(z / CELL)) ?? [];
  }
}

export function createWalkQueries(dataset: CityDatasetV2): WalkQueries {
  const buildings = new Grid<Polygon>();
  const water = new Grid<Polygon>();
  const open = new Grid<Polygon>();
  const paths = new Grid<Segment>();
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  const grow = (p: Polygon) => {
    minX = Math.min(minX, p.minX); maxX = Math.max(maxX, p.maxX);
    minZ = Math.min(minZ, p.minZ); maxZ = Math.max(maxZ, p.maxZ);
  };
  for (const b of dataset.buildings) {
    const p = polygon(b.ring, b.holes);
    grow(p);
    buildings.add(p, p.minX - BODY_RADIUS, p.minZ - BODY_RADIUS, p.maxX + BODY_RADIUS, p.maxZ + BODY_RADIUS);
  }
  for (const a of dataset.areas) {
    const p = polygon(a.ring, a.holes);
    grow(p);
    (a.kind === 'water' ? water : open).add(p, p.minX, p.minZ, p.maxX, p.maxZ);
  }
  for (const r of dataset.roads) {
    const reach = r.widthMeters / 2 + r.sidewalkMeters;
    for (let i = 2; i < r.points.length; i += 2) {
      const s = { ax: r.points[i - 2]!, az: r.points[i - 1]!, bx: r.points[i]!, bz: r.points[i + 1]!, reach };
      minX = Math.min(minX, s.ax, s.bx); maxX = Math.max(maxX, s.ax, s.bx);
      minZ = Math.min(minZ, s.az, s.bz); maxZ = Math.max(maxZ, s.az, s.bz);
      paths.add(s, Math.min(s.ax, s.bx) - reach, Math.min(s.az, s.bz) - reach, Math.max(s.ax, s.bx) + reach, Math.max(s.az, s.bz) + reach);
    }
  }
  // The body is a circle: its centre and four rim points must clear every wall.
  const rim = [[0, 0], [BODY_RADIUS, 0], [-BODY_RADIUS, 0], [0, BODY_RADIUS], [0, -BODY_RADIUS]] as const;
  const isWalkable = (x: number, z: number): boolean => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (x < minX || x > maxX || z < minZ || z > maxZ) return false;
    for (const [ox, oz] of rim) {
      for (const b of buildings.at(x + ox, z + oz)) if (contains(b, x + ox, z + oz)) return false;
    }
    for (const w of water.at(x, z)) if (contains(w, x, z)) return false;
    for (const s of paths.at(x, z)) if (segmentDistanceSq(x, z, s.ax, s.az, s.bx, s.bz) <= s.reach * s.reach) return true;
    for (const a of open.at(x, z)) if (contains(a, x, z)) return true;
    return false;
  };
  const groundHeight = (x: number, z: number): number => (Number.isFinite(x) && Number.isFinite(z) ? 0 : Number.NaN);
  return { isWalkable, groundHeight };
}

// ---- Street clearance: where furniture may stand ---------------------------
//
// One check for every tree, pole and sign. A carriageway is each road
// segment's centreline buffered by the half width the road mesh draws
// (`widthMeters / 2`; crossings are strips of their own width), plus a
// kerb margin. Sidewalk furniture stands in the band from KERB + 0.5 m to
// KERB + sidewalk width - 0.3 m. Most Harlem streets map their sidewalks as
// separate ways (`sidewalkMeters` 0), so the band then assumes
// ASSUMED_SIDEWALK.

/** Margin past the painted carriageway edge that still counts as street. */
export const KERB_MARGIN = 0.3;
/** Sidewalk band, metres past the kerb: inner edge, and the gap kept from the band's outer edge. */
export const BAND_INNER = 0.5;
export const BAND_OUTER_GAP = 0.3;
/** Sidewalk width assumed where OSM maps the sidewalk as its own way. */
export const ASSUMED_SIDEWALK = 3;
/** How far past a carriageway the clearance grid looks (crown overhang queries reach this far). */
const LOOK = 6;

interface Carriageway { ax: number; az: number; bx: number; bz: number; half: number; sidewalk: number }

export interface StreetClearance {
  /**
   * Distance from (x, z) to the nearest carriageway edge, metres: negative
   * inside the painted carriageway, Infinity when none is within 6 m.
   */
  kerbGap(x: number, z: number): number;
  /** Inside a carriageway or crossing buffer (half width + `margin`). */
  inCarriageway(x: number, z: number, margin?: number): boolean;
  /** Inside a building footprint grown by `pad`. */
  inBuilding(x: number, z: number, pad?: number): boolean;
  /** Clear of every carriageway buffer and every building: a base may stand here. */
  standable(x: number, z: number): boolean;
  /**
   * For a base inside a carriageway: the nearest point in a sidewalk band
   * (just past BAND_INNER) that is standable and within `maxMove` metres,
   * else null. A standable base comes back unchanged.
   */
  toSidewalk(x: number, z: number, maxMove: number): [number, number] | null;
}

export function createStreetClearance(dataset: CityDatasetV2): StreetClearance {
  const roads = new Grid<Carriageway>();
  const buildings = new Grid<Polygon>();
  for (const b of dataset.buildings) {
    const p = polygon(b.ring, b.holes);
    buildings.add(p, p.minX - 1, p.minZ - 1, p.maxX + 1, p.maxZ + 1);
  }
  for (const r of dataset.roads) {
    if (WALKWAY_CLASSES.has(r.class)) continue;
    const half = r.widthMeters / 2;
    const sidewalk = r.sidewalkMeters > 0 ? r.sidewalkMeters : ASSUMED_SIDEWALK;
    for (let i = 2; i < r.points.length; i += 2) {
      const c = { ax: r.points[i - 2]!, az: r.points[i - 1]!, bx: r.points[i]!, bz: r.points[i + 1]!, half, sidewalk };
      const pad = half + LOOK;
      roads.add(c, Math.min(c.ax, c.bx) - pad, Math.min(c.az, c.bz) - pad, Math.max(c.ax, c.bx) + pad, Math.max(c.az, c.bz) + pad);
    }
  }
  const kerbGap = (x: number, z: number) => {
    let gap = Infinity;
    for (const c of roads.at(x, z)) {
      const g = Math.sqrt(segmentDistanceSq(x, z, c.ax, c.az, c.bx, c.bz)) - c.half;
      if (g < gap) gap = g;
    }
    return gap;
  };
  const inCarriageway = (x: number, z: number, margin = KERB_MARGIN) => kerbGap(x, z) < margin;
  const inBuilding = (x: number, z: number, pad = 0.2) => {
    for (const b of buildings.at(x, z)) if (contains(b, x, z, pad)) return true;
    // `contains` takes the pad on the bounding box only; test the rim too.
    if (pad > 0) {
      for (const [ox, oz] of [[pad, 0], [-pad, 0], [0, pad], [0, -pad]] as const) {
        for (const b of buildings.at(x + ox, z + oz)) if (contains(b, x + ox, z + oz)) return true;
      }
    }
    return false;
  };
  const standable = (x: number, z: number) => Number.isFinite(x) && Number.isFinite(z) && !inCarriageway(x, z) && !inBuilding(x, z);
  const toSidewalk = (x: number, z: number, maxMove: number): [number, number] | null => {
    if (standable(x, z)) return [x, z];
    // Candidates: off every nearby carriageway the point is in, to either side, just inside its sidewalk band.
    let best: [number, number] | null = null;
    let bestMove = Infinity;
    for (const c of roads.at(x, z)) {
      const dx = c.bx - c.ax; const dz = c.bz - c.az;
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((x - c.ax) * dx + (z - c.az) * dz) / len2));
      const fx = c.ax + dx * t; const fz = c.az + dz * t;
      const len = Math.sqrt(len2);
      let nx = x - fx; let nz = z - fz;
      const nl = Math.hypot(nx, nz);
      if (nl < 1e-6) { nx = -dz / len; nz = dx / len; } else { nx /= nl; nz /= nl; }
      if (nl >= c.half + KERB_MARGIN) continue;
      const reach = c.half + BAND_INNER + 0.2;
      if (reach > c.half + c.sidewalk - BAND_OUTER_GAP) continue;
      for (const side of [1, -1]) {
        const px = fx + nx * side * reach; const pz = fz + nz * side * reach;
        const move = Math.hypot(px - x, pz - z);
        if (move > maxMove || move >= bestMove || !standable(px, pz)) continue;
        best = [px, pz];
        bestMove = move;
      }
    }
    return best;
  };
  return { kerbGap, inCarriageway, inBuilding, standable, toSidewalk };
}
