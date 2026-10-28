// Where the street furniture stands: NYC street-name signs at named
// intersections and streetlights along the carriageways. Pure (no three),
// so node tests pin the picks; street-furniture.ts turns them into meshes.
//
// Names come from the baked tile: tooling/city/build.mjs keeps the OSM
// `name` of every road as `n` (480 of 2 414 roads on the 2026-10-15 tile,
// 66 distinct carriageway names), so no bake change was needed.
import type { CityRoad, RoadClass } from '../city-dataset.ts';

type Point = readonly [number, number];

/** Roads that carry a street-name sign: carriageways with traffic, not footways, crossings or driveways. */
export const SIGNED_CLASSES: ReadonlySet<RoadClass> = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'living']);
/** Two crossings of the same pair of names closer than this are one intersection (divided avenues, split nodes). */
export const INTERSECTION_MERGE_METRES = 30;
export const SIGN_POLE_HEIGHT = 3.6;
/** Blade centre heights: the lower blade names the first street, the upper the cross street. */
export const BLADE_HEIGHTS = [3.12, 3.44] as const;
export const BLADE_HEIGHT = 0.28;
/** Lettering height on the blade, metres (7 pixels). */
export const LETTER_HEIGHT = 0.18;
/** Longest blade, metres; longer names are condensed to fit, down to 55 % width. */
export const MAX_BLADE_LENGTH = 2.3;
export const BLADE_PADDING = 0.12;
/** Narrowest the lettering gets, as a share of square pixels. */
export const MIN_CONDENSE = 0.55;

/**
 * Shorten a name that cannot fit `room` metres: middle words become
 * initials, longest first ("ADAM CLAYTON POWELL JR BLVD" -> "ADAM C POWELL
 * JR BLVD"). The first word and the street type stay whole.
 */
export function fitText(text: string, measure: (text: string) => number, room: number): string {
  const words = text.split(' ');
  while (measure(words.join(' ')) > room) {
    let longest = -1;
    for (let i = 1; i < words.length - 1; i++) if (words[i]!.length > 1 && (longest < 0 || words[i]!.length > words[longest]!.length)) longest = i;
    if (longest < 0) break;
    words[longest] = words[longest]![0]!;
  }
  return words.join(' ');
}
/** At most this many signs, nearest the play centre first. */
export const MAX_SIGNS = 400;

const WORDS: Readonly<Record<string, string>> = {
  WEST: 'W', EAST: 'E', NORTH: 'N', SOUTH: 'S',
  STREET: 'ST', AVENUE: 'AV', BOULEVARD: 'BLVD', PLACE: 'PL', TERRACE: 'TER', DRIVE: 'DR',
  ROAD: 'RD', PARKWAY: 'PKWY', SQUARE: 'SQ', SAINT: 'ST', MOUNT: 'MT', JUNIOR: 'JR',
};

/**
 * The name as a Manhattan blade prints it, in capitals: direction and type
 * abbreviated, ordinals as bare numbers ("West 125th Street" -> "W 125 ST",
 * "5th Avenue" -> "5 AV"), periods dropped.
 */
export function signText(name: string): string {
  return name
    .toUpperCase()
    .replace(/\./g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const ordinal = /^(\d+)(ST|ND|RD|TH)$/.exec(word);
      if (ordinal) return ordinal[1]!;
      return WORDS[word] ?? word;
    })
    .join(' ');
}

export interface StreetCross {
  x: number;
  z: number;
  /** The two streets, sorted by name. Direction is a unit vector along the road; width is the carriageway. */
  streets: readonly [CrossStreet, CrossStreet];
}
export interface CrossStreet { name: string; dir: Point; width: number }

interface Segment { ax: number; az: number; bx: number; bz: number; road: CityRoad }

/** Where two differently named carriageways cross or meet, one entry per name pair and place. */
export function findIntersections(roads: readonly CityRoad[]): StreetCross[] {
  const CELL = 40;
  const grid = new Map<number, Segment[]>();
  const signed = roads.filter((r) => r.name && SIGNED_CLASSES.has(r.class));
  for (const road of signed) {
    const p = road.points;
    for (let k = 2; k < p.length; k += 2) {
      const seg: Segment = { ax: p[k - 2]!, az: p[k - 1]!, bx: p[k]!, bz: p[k + 1]!, road };
      const x0 = Math.floor(Math.min(seg.ax, seg.bx) / CELL); const x1 = Math.floor(Math.max(seg.ax, seg.bx) / CELL);
      const z0 = Math.floor(Math.min(seg.az, seg.bz) / CELL); const z1 = Math.floor(Math.max(seg.az, seg.bz) / CELL);
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
        const key = cx * 65_536 + cz;
        let cell = grid.get(key);
        if (!cell) { cell = []; grid.set(key, cell); }
        cell.push(seg);
      }
    }
  }
  const found: StreetCross[] = [];
  const seen = new Map<string, Point[]>();
  for (const cell of grid.values()) {
    for (let i = 0; i < cell.length; i++) {
      for (let j = i + 1; j < cell.length; j++) {
        const s = cell[i]!; const t = cell[j]!;
        if (s.road.name === t.road.name) continue;
        const hit = segmentHit(s, t);
        if (!hit) continue;
        const [first, second] = s.road.name! < t.road.name! ? [s, t] : [t, s];
        const key = `${first.road.name}|${second.road.name}`;
        const near = seen.get(key) ?? [];
        if (near.some(([x, z]) => Math.hypot(x - hit[0], z - hit[1]) < INTERSECTION_MERGE_METRES)) continue;
        near.push(hit);
        seen.set(key, near);
        found.push({ x: hit[0], z: hit[1], streets: [street(first), street(second)] });
      }
    }
  }
  // Grid iteration order depends on insertion; sort so the output is stable.
  return found.sort((a, b) => a.x - b.x || a.z - b.z);
}

function street(s: Segment): CrossStreet {
  const dx = s.bx - s.ax; const dz = s.bz - s.az;
  const l = Math.hypot(dx, dz) || 1;
  return { name: s.road.name!, dir: [dx / l, dz / l], width: s.road.widthMeters };
}

/** Proper crossing or shared endpoint of two segments (a T-junction or a node both roads share). */
function segmentHit(s: Segment, t: Segment): Point | null {
  const rx = s.bx - s.ax; const rz = s.bz - s.az;
  const qx = t.bx - t.ax; const qz = t.bz - t.az;
  const denom = rx * qz - rz * qx;
  const lr = Math.hypot(rx, rz); const lq = Math.hypot(qx, qz);
  if (lr < 1e-6 || lq < 1e-6) return null;
  // Nearly parallel: same road under two names, or a frontage road. No sign.
  if (Math.abs(denom) < 0.35 * lr * lq) return null;
  const wx = t.ax - s.ax; const wz = t.az - s.az;
  const u = (wx * qz - wz * qx) / denom;
  const v = (wx * rz - wz * rx) / denom;
  // A little slack past the ends catches T-junctions that stop at the kerb.
  const slackU = 1.5 / lr; const slackV = 1.5 / lq;
  if (u < -slackU || u > 1 + slackU || v < -slackV || v > 1 + slackV) return null;
  return [s.ax + rx * u, s.az + rz * u];
}

export interface SignBlade {
  text: string;
  /** Unit direction the blade runs along (the street it names). */
  dir: Point;
  /** Centre height, metres. */
  y: number;
  length: number;
  /** Horizontal scale of the lettering, 0.55..1 (1 = square pixels). */
  condense: number;
}
export interface SignPlacement { x: number; z: number; blades: readonly [SignBlade, SignBlade]; distance: number }

/** Corner setbacks tried in turn, metres past the kerb (the sidewalk band starts 0.5 m past it). */
export const CORNER_SETBACKS = [0.9, 1.4, 2.0, 2.8] as const;

/** Where a base may stand: clear of every carriageway and crossing and of buildings. Defaults to anywhere. */
export type Standable = (x: number, z: number) => boolean;

/**
 * One sign per intersection, nearest `centre` first, at most `cap`. The pole
 * stands on a sidewalk corner outside both carriageways: past each half
 * width by the setback (divided by sin on skewed corners), trying the
 * setbacks in turn and, at each, the clear corner nearest the centre. A
 * corner `standable` rejects (a crossing, a third street, a building) is
 * skipped; an intersection with no clear corner gets no sign. Each blade
 * runs along the street it names, so it reads face-on from the cross street.
 */
export function placeSigns(
  crosses: readonly StreetCross[], centre: Point, measure: (text: string) => number, cap = MAX_SIGNS, standable: Standable = () => true,
): SignPlacement[] {
  const out: SignPlacement[] = [];
  for (const cross of crosses) {
    const [a, b] = cross.streets;
    const sin = Math.max(0.35, Math.abs(a.dir[0] * b.dir[1] - a.dir[1] * b.dir[0]));
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const setback of CORNER_SETBACKS) {
      // Along a by (b's half width + setback) and along b by (a's).
      const alongA = (b.width / 2 + setback) / sin;
      const alongB = (a.width / 2 + setback) / sin;
      for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
        const x = cross.x + a.dir[0] * alongA * sa + b.dir[0] * alongB * sb;
        const z = cross.z + a.dir[1] * alongA * sa + b.dir[1] * alongB * sb;
        const d = Math.hypot(x - centre[0], z - centre[1]);
        if (d < bestD && standable(x, z)) { bestD = d; best = [x, z]; }
      }
      if (best) break;
    }
    if (!best) continue;
    const blade = (s: CrossStreet, y: number): SignBlade => {
      const room = MAX_BLADE_LENGTH - BLADE_PADDING * 2;
      const text = fitText(signText(s.name), measure, room / MIN_CONDENSE);
      const natural = measure(text);
      const condense = Math.max(MIN_CONDENSE, Math.min(1, room / Math.max(natural, 1e-6)));
      return { text, dir: s.dir, y, length: natural * condense + BLADE_PADDING * 2, condense };
    };
    out.push({ x: best[0], z: best[1], blades: [blade(a, BLADE_HEIGHTS[0]), blade(b, BLADE_HEIGHTS[1])], distance: bestD });
  }
  out.sort((p, q) => p.distance - q.distance);
  return out.slice(0, Math.max(0, cap));
}

/** Streetlights along the carriageways. */
export const LIGHT_CLASSES: ReadonlySet<RoadClass> = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'residential', 'living']);
export const LIGHT_SPACING = 32;
/** Poles this far past the kerb: inside the sidewalk band (0.5 m past the kerb, clear of the 0.3 m kerb margin). */
export const LIGHT_SETBACK = 0.8;
export const LIGHT_POLE_HEIGHT = 7.6;
export const MAX_LIGHTS = 900;
/** No streetlight within this many metres of an intersection: the corner belongs to the signal mast and the sign. */
export const LIGHT_CORNER_CLEAR = 12;

export interface LightPlacement { x: number; z: number; /** Unit vector from the pole toward the carriageway centre. */ face: Point; distance: number }

/**
 * A pole every LIGHT_SPACING metres along each carriageway, sides
 * alternating, in the sidewalk band, its head reaching over the road.
 * Positions `standable` rejects are skipped. Nearest the centre first, at
 * most `cap`.
 */
export function placeStreetlights(
  roads: readonly CityRoad[], centre: Point, cap = MAX_LIGHTS, standable: Standable = () => true,
  corners: readonly { x: number; z: number }[] = [],
): LightPlacement[] {
  const out: LightPlacement[] = [];
  const nearCorner = (x: number, z: number) => corners.some((c) => Math.hypot(x - c.x, z - c.z) < LIGHT_CORNER_CLEAR);
  for (const road of roads) {
    if (!LIGHT_CLASSES.has(road.class)) continue;
    const p = road.points;
    let carried = LIGHT_SPACING / 2;
    let side = 1;
    for (let k = 2; k < p.length; k += 2) {
      const ax = p[k - 2]!; const az = p[k - 1]!; const bx = p[k]!; const bz = p[k + 1]!;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 1e-6) continue;
      const dx = (bx - ax) / length; const dz = (bz - az) / length;
      let t = carried;
      while (t <= length) {
        const off = road.widthMeters / 2 + LIGHT_SETBACK;
        // Left of travel is (dz, -dx).
        const nx = dz * side; const nz = -dx * side;
        const x = ax + dx * t + nx * off; const z = az + dz * t + nz * off;
        // A pole that would land in a crossing, a cross street or a building is left out.
        if (standable(x, z) && !nearCorner(x, z)) out.push({ x, z, face: [-nx, -nz], distance: Math.hypot(x - centre[0], z - centre[1]) });
        side = -side;
        t += LIGHT_SPACING;
      }
      carried = t - length;
    }
  }
  out.sort((a, b) => a.distance - b.distance);
  return out.slice(0, Math.max(0, cap));
}
