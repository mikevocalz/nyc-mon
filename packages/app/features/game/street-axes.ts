// Street axes for the chase camera's block settle: which way the street the
// Caller stands on runs, as a camera yaw. Pure, no three.js, no tile import,
// so `node --test` covers it with hand-built roads.
//
// Yaw convention (city-scene.ts): the camera sits at target + (sin yaw,
// cos yaw) * distance and looks along (-sin yaw, -cos yaw). A street is an
// axis, not a direction, so its yaw is kept in [0, π): looking either way
// down the street is `axisYaw` or `axisYaw + π`.
//
// Manhattan's grid is rotated about 29° clockwise from true north. On the
// bundled tile West 125th Street measures 119.1° (compass, mod 180) and the
// crossings over it 29.9° (measured 2026-10-16 from data/harlem-apollo.json),
// so the grid fallback below matches the data.
import type { CityRoad, RoadClass } from './city-dataset.ts';

const TAU = Math.PI * 2;
const wrap = (radians: number) => ((radians % TAU) + TAU) % TAU;
const wrapHalf = (radians: number) => ((radians % Math.PI) + Math.PI) % Math.PI;
/** Signed shortest turn from `from` to `to`, in (-π, π]. */
export const shortestTurn = (from: number, to: number): number => {
  const d = wrap(to - from);
  return d > Math.PI ? d - TAU : d;
};

/**
 * Classes that mark a street's run. Crossings run across the street and
 * would turn the camera sideways; footways and cycleways wander through
 * parks; service roads are alleys and parking aisles at any angle.
 */
export const STREET_AXIS_CLASSES: ReadonlySet<RoadClass> = new Set<RoadClass>([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'living', 'pedestrian', 'sidewalk',
]);
/** Segments shorter than this are kinks at corners, not a street's run. */
export const MIN_SEGMENT_METRES = 4;
/** How far from the Caller a street still counts as theirs, metres. Half a Manhattan block's depth plus a wide avenue. */
export const STREET_AXIS_RADIUS = 30;
/** Bucket size of the lookup grid, metres. */
const CELL_METRES = 32;
/** Distance cost in the pick, radians at the edge of the radius: a street 30 m off costs as much as one 30° off the reference. */
const DISTANCE_PENALTY = Math.PI / 6;

/** Compass bearing of the avenues, degrees clockwise from true north. */
export const MANHATTAN_GRID_BEARING_DEG = 29;

interface Segment {
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly axisYaw: number;
}

export interface StreetAxisIndex {
  readonly buckets: ReadonlyMap<string, readonly Segment[]>;
  readonly segmentCount: number;
}

export interface StreetAxisHit {
  /** The street's axis as a camera yaw in [0, π). */
  readonly axisYaw: number;
  /** Metres from the query point to the segment. */
  readonly distance: number;
  /** Angle between the reference yaw and the axis, in [0, π/2]. */
  readonly misalignment: number;
}

/** Answers "which street axis near (x, z) best matches `referenceYaw`?"; null when no street is in reach. */
export type StreetAxisLookup = (x: number, z: number, referenceYaw: number) => StreetAxisHit | null;

/** A lookup that finds nothing, so callers fall back to the grid. */
export const NO_STREETS: StreetAxisLookup = () => null;

const key = (cx: number, cz: number) => `${cx},${cz}`;

/** The camera yaw that looks along a ground direction (dx, dz), wrapped to an axis in [0, π). */
export function axisYawFor(dx: number, dz: number): number {
  return wrapHalf(Math.atan2(-dx, -dz));
}

/** Angle between a yaw and an axis, ignoring which way down the axis, in [0, π/2]. */
export function axisMisalignment(yaw: number, axisYaw: number): number {
  const d = Math.abs(shortestTurn(wrapHalf(yaw), wrapHalf(axisYaw)));
  return Math.min(d, Math.PI - d);
}

/** Buckets every street segment of the tile once. Built lazily by the runtime, about 2 400 roads on the bundled tile. */
export function createStreetAxisIndex(roads: readonly Pick<CityRoad, 'class' | 'points'>[]): StreetAxisIndex {
  const buckets = new Map<string, Segment[]>();
  let segmentCount = 0;
  for (const road of roads) {
    if (!STREET_AXIS_CLASSES.has(road.class)) continue;
    const p = road.points;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i]!, az = p[i + 1]!, bx = p[i + 2]!, bz = p[i + 3]!;
      if (![ax, az, bx, bz].every(Number.isFinite)) continue;
      if (Math.hypot(bx - ax, bz - az) < MIN_SEGMENT_METRES) continue;
      const segment: Segment = { ax, az, bx, bz, axisYaw: axisYawFor(bx - ax, bz - az) };
      segmentCount++;
      const x0 = Math.floor(Math.min(ax, bx) / CELL_METRES), x1 = Math.floor(Math.max(ax, bx) / CELL_METRES);
      const z0 = Math.floor(Math.min(az, bz) / CELL_METRES), z1 = Math.floor(Math.max(az, bz) / CELL_METRES);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const k = key(cx, cz);
          const list = buckets.get(k);
          if (list) list.push(segment);
          else buckets.set(k, [segment]);
        }
      }
    }
  }
  return { buckets, segmentCount };
}

function distanceToSegment(x: number, z: number, s: Segment): number {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / lengthSq)) : 0;
  return Math.hypot(x - (s.ax + t * dx), z - (s.az + t * dz));
}

/**
 * The street axis near (x, z) that best matches `referenceYaw`. Each
 * segment within `radius` scores its misalignment to the reference plus a
 * distance term, so at a corner the street the Caller (or the view) points
 * down wins over the one that is a metre closer.
 */
export function streetAxisNear(index: StreetAxisIndex, x: number, z: number, referenceYaw: number, radius = STREET_AXIS_RADIUS): StreetAxisHit | null {
  if (![x, z, referenceYaw, radius].every(Number.isFinite) || radius <= 0) return null;
  const reach = Math.ceil(radius / CELL_METRES);
  const cx = Math.floor(x / CELL_METRES), cz = Math.floor(z / CELL_METRES);
  const seen = new Set<Segment>();
  let best: StreetAxisHit | null = null;
  let bestScore = Infinity;
  for (let ix = cx - reach; ix <= cx + reach; ix++) {
    for (let iz = cz - reach; iz <= cz + reach; iz++) {
      const list = index.buckets.get(key(ix, iz));
      if (!list) continue;
      for (const segment of list) {
        if (seen.has(segment)) continue;
        seen.add(segment);
        const distance = distanceToSegment(x, z, segment);
        if (distance > radius) continue;
        const misalignment = axisMisalignment(referenceYaw, segment.axisYaw);
        const score = misalignment + DISTANCE_PENALTY * (distance / radius);
        if (score < bestScore) {
          bestScore = score;
          best = { axisYaw: segment.axisYaw, distance, misalignment };
        }
      }
    }
  }
  return best;
}

/** A lookup bound to one index. */
export function streetAxisLookupFor(index: StreetAxisIndex): StreetAxisLookup {
  return (x, z, referenceYaw) => streetAxisNear(index, x, z, referenceYaw);
}

/**
 * The Manhattan grid axis (avenues at 29°, streets at 119°) closest to
 * `referenceYaw`, for when no mapped street is in reach. Bearing b looks
 * along yaw -b (camera-input.ts headingDegrees).
 */
export function gridAxisYaw(referenceYaw: number): number {
  const avenue = wrapHalf((-MANHATTAN_GRID_BEARING_DEG * Math.PI) / 180);
  const street = wrapHalf(avenue + Math.PI / 2);
  return axisMisalignment(referenceYaw, avenue) <= axisMisalignment(referenceYaw, street) ? avenue : street;
}

/**
 * Of the two ways down an axis, the yaw closest to `currentYaw`. When
 * `preferYaw` is given, the way that looks along it wins ties and near ties
 * within `bias` radians (a right-angle corner is a tie: both ways are 90°
 * from the old view, and looking where the Caller walks is the useful one).
 */
export function yawAlongAxis(currentYaw: number, axisYaw: number, preferYaw?: number, bias = 0): number {
  const a = wrap(axisYaw);
  const b = wrap(axisYaw + Math.PI);
  let costA = Math.abs(shortestTurn(currentYaw, a));
  let costB = Math.abs(shortestTurn(currentYaw, b));
  if (preferYaw !== undefined && Number.isFinite(preferYaw) && bias > 0) {
    if (Math.abs(shortestTurn(preferYaw, a)) <= Math.PI / 2) costA -= bias;
    else costB -= bias;
  }
  return costA <= costB ? a : b;
}
