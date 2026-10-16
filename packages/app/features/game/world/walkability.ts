// Where a Caller may stand, from the same tile the scene draws. Pure maths
// over the parsed dataset, no three import:
//   blocked  inside a building footprint (plus the body radius), or water
//   walkable on a road or its sidewalks, a footway, a park, garden, lawn,
//            pitch, playground, plaza, parking lot or school yard
//   blocked  everything else (back yards and unmapped lots inside blocks),
//            and anywhere outside the tile
// Ground is flat today: the tile carries no elevation, so height is 0.
import type { CityDatasetV2, FlatPoints } from '../city-dataset.ts';
import { pairs, pointInRing, segmentDistanceSq } from './geometry.ts';

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
