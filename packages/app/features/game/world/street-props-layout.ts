// Where the small street things go: hydrants, litter baskets, parked cars
// and taxis, subway entrances, bus shelters. Pure (no three), every base
// checked against the street clearance (walkability.ts); parked cars are the
// one thing that stands in the carriageway, in the parking lane, and never
// on a crossing, at an intersection or by a hydrant.
import type { CityDatasetV2, FlatPoints, RoadClass } from '../city-dataset.ts';
import { hashUnit } from './geometry.ts';
import { LIGHT_CLASSES, type LightPlacement, type SignPlacement } from './signage.ts';
import type { StreetClearance } from './walkability.ts';

type Point = [number, number];

export const HYDRANT_SPACING = 75;
/** Hydrants and baskets stand this far past the kerb (inside the sidewalk band). */
export const PROP_SETBACK = 1.1;
/** New York keeps 15 feet either side of a hydrant clear of parking. */
export const HYDRANT_CLEAR = 4.6;
export const CAR_SLOT = 6.4;
export const CAR_LENGTH = 4.6;
export const CAR_WIDTH = 1.9;
/** Parking lanes only on carriageways at least this wide. */
export const PARKING_MIN_WIDTH = 10;
/** A car's ends keep this far from any other carriageway (the cross street at an intersection). */
export const INTERSECTION_CLEAR = 3;
export const CAR_OCCUPANCY = 0.55;
export const TAXI_SHARE = 0.2;
const PARKING_CLASSES: ReadonlySet<RoadClass> = new Set(['primary', 'secondary', 'tertiary', 'residential', 'living']);
const BASKET_CLASSES: ReadonlySet<RoadClass> = new Set(['primary', 'secondary', 'trunk']);

export interface PropPlacement { x: number; z: number; /** Unit direction along the kerb. */ dir: Point; /** Unit direction from the kerb toward the road. */ toRoad: Point }
export interface CarPlacement { x: number; z: number; dir: Point; taxi: boolean; tone: number }

/** Walk a polyline every `spacing` metres from `phase`, calling back with the point and unit direction. */
function along(points: FlatPoints, spacing: number, phase: number, visit: (x: number, z: number, dx: number, dz: number, i: number) => void): void {
  let carried = phase;
  let n = 0;
  for (let k = 2; k < points.length; k += 2) {
    const ax = points[k - 2]!; const az = points[k - 1]!; const bx = points[k]!; const bz = points[k + 1]!;
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 1e-6) continue;
    const dx = (bx - ax) / length; const dz = (bz - az) / length;
    let t = carried;
    while (t <= length) { visit(ax + dx * t, az + dz * t, dx, dz, n++); t += spacing; }
    carried = t - length;
  }
}

/** Hydrants along the kerbs, sides alternating, clear of the streetlights. */
export function placeHydrants(dataset: CityDatasetV2, clearance: StreetClearance, lights: readonly LightPlacement[]): PropPlacement[] {
  const out: PropPlacement[] = [];
  for (const road of dataset.roads) {
    if (!LIGHT_CLASSES.has(road.class)) continue;
    const off = road.widthMeters / 2 + PROP_SETBACK;
    along(road.points, HYDRANT_SPACING, 20, (x, z, dx, dz, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const nx = dz * side; const nz = -dx * side;
      const px = x + nx * off; const pz = z + nz * off;
      if (!clearance.standable(px, pz)) return;
      if (lights.some((l) => Math.abs(l.x - px) < 2 && Math.abs(l.z - pz) < 2)) return;
      out.push({ x: px, z: pz, dir: [dx, dz], toRoad: [-nx, -nz] });
    });
  }
  return out;
}

/** A wire litter basket by each sign pole, and every 90 m along the commercial avenues. */
export function placeBaskets(dataset: CityDatasetV2, clearance: StreetClearance, signs: readonly SignPlacement[]): PropPlacement[] {
  const out: PropPlacement[] = [];
  for (const sign of signs) {
    const [dx, dz] = sign.blades[0].dir;
    for (const step of [1.2, -1.2]) {
      const x = sign.x + dx * step; const z = sign.z + dz * step;
      if (!clearance.standable(x, z)) continue;
      const road = clearance.nearest(x, z);
      out.push({ x, z, dir: [dx, dz], toRoad: road ? [-road.away[0], -road.away[1]] : [0, 1] });
      break;
    }
  }
  for (const road of dataset.roads) {
    if (!BASKET_CLASSES.has(road.class)) continue;
    const off = road.widthMeters / 2 + PROP_SETBACK;
    along(road.points, 90, 45, (x, z, dx, dz, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const nx = dz * side; const nz = -dx * side;
      const px = x + nx * off; const pz = z + nz * off;
      if (clearance.standable(px, pz)) out.push({ x: px, z: pz, dir: [dx, dz], toRoad: [-nx, -nz] });
    });
  }
  return out;
}

/**
 * Parked cars and taxis in the parking lane of carriageways 10 m and wider:
 * a slot every 6.4 m on both sides, filled by a stable hash. A slot is left
 * empty when either end of the car is on a crossing, within 3 m of another
 * carriageway (an intersection), or within 4.6 m of a hydrant.
 */
export function placeParkedCars(dataset: CityDatasetV2, clearance: StreetClearance, hydrants: readonly PropPlacement[]): CarPlacement[] {
  const out: CarPlacement[] = [];
  // Hydrants in 10 m cells, so each slot checks its own cell and the eight around it.
  const cells = new Map<number, PropPlacement[]>();
  const cellKey = (cx: number, cz: number) => cx * 100_003 + cz;
  for (const h of hydrants) {
    const key = cellKey(Math.floor(h.x / 10), Math.floor(h.z / 10));
    const list = cells.get(key);
    if (list) list.push(h); else cells.set(key, [h]);
  }
  const nearHydrant = (x: number, z: number) => {
    const cx = Math.floor(x / 10); const cz = Math.floor(z / 10);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const h of cells.get(cellKey(cx + i, cz + j)) ?? []) if (Math.hypot(h.x - x, h.z - z) < HYDRANT_CLEAR) return true;
    }
    return false;
  };
  for (const road of dataset.roads) {
    if (!PARKING_CLASSES.has(road.class) || road.widthMeters < PARKING_MIN_WIDTH) continue;
    const lane = road.widthMeters / 2 - CAR_WIDTH / 2 - 0.35;
    for (const side of [1, -1]) {
      along(road.points, CAR_SLOT, CAR_SLOT, (x, z, dx, dz, i) => {
        const key = `${road.id}:${side}:${i}`;
        if (hashUnit(key) > CAR_OCCUPANCY) return;
        const nx = dz * side; const nz = -dx * side;
        const cx = x + nx * lane; const cz = z + nz * lane;
        const half = CAR_LENGTH / 2;
        const ends: Point[] = [[cx + dx * half, cz + dz * half], [cx - dx * half, cz - dz * half], [cx, cz]];
        for (const [ex, ez] of ends) {
          if (clearance.inCrossing(ex, ez, 1) || !clearance.clearOfOthers(ex, ez, road.id, INTERSECTION_CLEAR) || clearance.inBuilding(ex, ez)) return;
        }
        if (nearHydrant(cx, cz)) return;
        // Cars face the way traffic runs on their side.
        const facing: Point = side > 0 ? [-dx, -dz] : [dx, dz];
        out.push({ x: cx, z: cz, dir: facing, taxi: hashUnit(`${key}:taxi`) < TAXI_SHARE, tone: hashUnit(`${key}:tone`) });
      });
    }
  }
  return out;
}

/**
 * OSM points (subway entrances, bus shelters) placed against the nearest
 * street: moved onto the sidewalk band when they fall in the carriageway
 * (within 3 m), dropped otherwise, turned to run along the kerb.
 */
export function placeAtKerb(points: FlatPoints, clearance: StreetClearance): { placed: PropPlacement[]; moved: number; dropped: number } {
  const placed: PropPlacement[] = [];
  let moved = 0;
  let dropped = 0;
  for (let i = 0; i + 1 < points.length; i += 2) {
    const sx = points[i]!; const sz = points[i + 1]!;
    const spot = clearance.toSidewalk(sx, sz, 3);
    if (!spot) { dropped++; continue; }
    if (spot[0] !== sx || spot[1] !== sz) moved++;
    const road = clearance.nearest(spot[0], spot[1]);
    const dir: Point = road ? road.dir : [1, 0];
    const toRoad: Point = road ? [-road.away[0], -road.away[1]] : [0, 1];
    placed.push({ x: spot[0], z: spot[1], dir, toRoad });
  }
  return { placed, moved, dropped };
}
