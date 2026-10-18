// Harlem at street level: brownstone stoops with iron railings, cornices,
// tenement fire escapes, shop awnings, bodega signs and rooftop water
// towers, written into the merged city buffers from the building loop
// (city-mesh.ts). The share rules are pure functions so node tests pin
// them. Every piece that reaches the sidewalk is checked against the street
// clearance by the caller.
import { hashUnit, type VertexBuffer } from './geometry.ts';
import { box, cone, cylinder, frame, type Frame } from './parts.ts';
import { SURFACES } from './surfaces.ts';

type Point = readonly [number, number];
type Rgb = readonly number[];

export const FLOOR_HEIGHT = 3.2;
/** A parlour floor: the stoop climbs this high. */
export const STOOP_RISE = 1.5;
export const STOOP_STEPS = 6;
export const STOOP_RUN = 0.32;
export const STOOP_LANDING = 1.0;
export const STOOP_WIDTH = 1.8;
/** How far a stoop reaches from the wall, metres. */
export const STOOP_REACH = STOOP_LANDING + STOOP_STEPS * STOOP_RUN;

/** Brownstones facing a street get a stoop, most of them. */
export function hasStoop(id: string): boolean {
  return hashUnit(`${id}:stoop`) < 0.8;
}

/** Fire escapes: brick walk-ups of four to nine storeys, on a share of street faces. */
export function hasFireEscape(id: string, edge: number, heightMeters: number, class_: string): boolean {
  if (class_ !== 'brick' && class_ !== 'nycha') return false;
  if (heightMeters < 12 || heightMeters > 32) return false;
  return hashUnit(`${id}:${edge}:fire`) < 0.6;
}

/** Wooden water towers on 28 % of the buildings of five storeys and up (not glass towers). */
export function hasWaterTower(id: string, heightMeters: number, class_: string): boolean {
  if (class_ === 'glass' || heightMeters < 5 * FLOOR_HEIGHT + 1) return false;
  return hashUnit(`${id}:tank`) < 0.28;
}

/** Floors a fire escape serves: every floor above the ground floor, the top one included. */
export function fireEscapeFloors(heightMeters: number): number {
  return Math.max(0, Math.floor((heightMeters - 1) / FLOOR_HEIGHT) - 1);
}

/** Bays of `bay` metres an edge of `length` holds, centred: their local x centres from the edge's midpoint. */
export function bays(length: number, bay: number, inset = 0.6): number[] {
  const n = Math.floor((length - inset * 2) / bay);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((i - (n - 1) / 2) * bay);
  return out;
}

/**
 * A brownstone stoop at local x `at` of a wall frame: a landing against the
 * wall and six steps down to the sidewalk, iron railings and newel posts.
 */
export function emitStoop(buffer: VertexBuffer, f: Frame, at: number, stone: Rgb, iron: Rgb): void {
  const hw = STOOP_WIDTH / 2;
  const rise = STOOP_RISE / STOOP_STEPS;
  buffer.surface(...SURFACES.stone);
  box(buffer, f, [at - hw, 0, 0], [at + hw, STOOP_RISE, STOOP_LANDING], stone, { skip: ['back', 'bottom'] });
  for (let k = 0; k < STOOP_STEPS - 1; k++) {
    const reach = STOOP_LANDING + (STOOP_STEPS - 1 - k) * STOOP_RUN;
    box(buffer, f, [at - hw, k * rise, STOOP_LANDING], [at + hw, (k + 1) * rise, reach], stone, { skip: ['back', 'bottom'] });
  }
  buffer.surface(...SURFACES.iron);
  for (const side of [-1, 1]) {
    const x = at + side * (hw - 0.05);
    // Newel post at the foot, and the rail along the steps (a thin box tilted down the flight).
    box(buffer, f, [x - 0.05, 0, STOOP_REACH - 0.1], [x + 0.05, 1.0, STOOP_REACH], iron, { skip: ['bottom'] });
    railing(buffer, f, x, STOOP_REACH - 0.05, 0.95, STOOP_LANDING, STOOP_RISE + 0.9, iron);
    box(buffer, f, [x - 0.025, STOOP_RISE, 0.05], [x + 0.025, STOOP_RISE + 0.9, STOOP_LANDING], iron, { skip: ['bottom'] });
  }
}

/** A sloping rail in the local y-z plane at local x, from (z0, y0) to (z1, y1): a thin bar seen from both sides. */
function railing(buffer: VertexBuffer, f: Frame, x: number, z0: number, y0: number, z1: number, y1: number, color: Rgb): void {
  const p = (lx: number, ly: number, lz: number) => [f.x + f.oz * lx + f.ox * lz, f.y + ly, f.z - f.ox * lx + f.oz * lz] as const;
  const t = 0.05;
  const left = [-f.oz, 0, f.ox] as const;
  const right = [f.oz, 0, -f.ox] as const;
  // Outer face (+x) and inner face (-x) of a bar 5 cm tall, plus its top.
  buffer.quad(p(x + t, y0 - t, z0), p(x + t, y1 - t, z1), p(x + t, y1, z1), p(x + t, y0, z0), right, color);
  buffer.quad(p(x - t, y1 - t, z1), p(x - t, y0 - t, z0), p(x - t, y0, z0), p(x - t, y1, z1), left, color);
  buffer.quad(p(x - t, y0, z0), p(x + t, y0, z0), p(x + t, y1, z1), p(x - t, y1, z1), [0, 1, 0], color);
}

/** A cornice along a street face: a projecting band under the roof line, its soffit and top. */
export function emitCornice(buffer: VertexBuffer, f: Frame, length: number, top: number, color: Rgb): void {
  const hl = length / 2 + 0.25;
  // Front and soffit only: the top hides under the roof line from the street.
  box(buffer, f, [-hl, top - 0.75, 0], [hl, top - 0.15, 0.45], color, { skip: ['back', 'left', 'right', 'top'] });
}

/**
 * The brick parapet the cornice crowns: the wall continued a few courses
 * past the roof line, a touch proud of the facade — the roofline lip a New
 * York block reads on from the street. Front and top faces only; the ends
 * meet the neighbours' parapets.
 */
export function emitParapet(buffer: VertexBuffer, f: Frame, length: number, top: number, color: Rgb): void {
  const hl = length / 2;
  box(buffer, f, [-hl, top - 0.08, -0.02], [hl, top + 0.34, 0.12], color, { skip: ['bottom', 'back', 'left', 'right'] });
}

/** One floor of a zig-zag fire escape: balcony, front rail, posts and the ladder down to the floor below. */
export function emitFireEscapeFloor(buffer: VertexBuffer, f: Frame, at: number, floorY: number, iron: Rgb, flip: boolean): void {
  const w = 3.0; const d = 0.85;
  buffer.surface(...SURFACES.iron);
  const x0 = at - w / 2; const x1 = at + w / 2;
  box(buffer, f, [x0, floorY - 0.06, 0], [x1, floorY, d], iron, { skip: ['back'] });
  box(buffer, f, [x0, floorY + 0.95, d - 0.04], [x1, floorY + 1.0, d], iron, { skip: ['back', 'bottom', 'left', 'right'] });
  // End posts as flat bars facing the street.
  for (const x of [x0, x1]) box(buffer, f, [x - 0.025, floorY, d - 0.05], [x + 0.025, floorY + 1.0, d], iron, { skip: ['bottom', 'top', 'back', 'left', 'right'] });
  // The ladder runs down across the balcony to the floor below, alternating direction (the zig-zag).
  const rise = FLOOR_HEIGHT - 0.1;
  const run = w * 0.7;
  const roll = Math.atan2(rise, run) * (flip ? -1 : 1);
  const length = Math.hypot(rise, run);
  box(buffer, f, [at - length / 2, floorY - rise / 2 - 0.04, d * 0.45], [at + length / 2, floorY - rise / 2 + 0.04, d * 0.85], iron, { roll, skip: ['back'] });
}

/** A shop awning at local x `at`: a sloping canopy, its valance and two side cheeks. */
export function emitAwning(buffer: VertexBuffer, f: Frame, at: number, width: number, color: Rgb, top = 3.05, reach = 1.3): void {
  buffer.surface(...SURFACES.fabric);
  const p = (lx: number, ly: number, lz: number) => [f.x + f.oz * lx + f.ox * lz, f.y + ly, f.z - f.ox * lx + f.oz * lz] as const;
  const x0 = at - width / 2; const x1 = at + width / 2;
  const low = top - 0.5 * (reach / 1.3); const valance = 0.28;
  const slope = Math.atan2(top - low, reach);
  const n = [f.ox * Math.sin(slope), Math.cos(slope), f.oz * Math.sin(slope)] as const;
  buffer.quad(p(x0, low, reach), p(x1, low, reach), p(x1, top, 0), p(x0, top, 0), n, color);
  buffer.quad(p(x0, low - valance, reach), p(x1, low - valance, reach), p(x1, low, reach), p(x0, low, reach), [f.ox, 0, f.oz], color);
  const shade = color.map((v) => v * 0.8);
  const left = [-f.oz, 0, f.ox] as const;
  const right = [f.oz, 0, -f.ox] as const;
  for (const vx of [x0, x1]) {
    const a = p(vx, top, 0); const b = p(vx, low, reach); const c = p(vx, low - valance, reach);
    // Counter-clockwise seen from outside each cheek.
    const order = vx === x0 ? [c, b, a] : [a, b, c];
    const nn = vx === x0 ? left : right;
    for (const q of order) buffer.vertex(q[0], q[1], q[2], nn[0], nn[1], nn[2], shade, 0, -10);
  }
}

/** A wooden water tower on a roof at height `roof`: four legs, a deck, the staved tank and its conical roof. */
export function emitWaterTower(buffer: VertexBuffer, x: number, z: number, roof: number, scale: number, wood: Rgb, steel: Rgb, roofColor: Rgb): void {
  const f = frame(x, z, [0, 1], roof);
  const r = 1.5 * scale;
  const legs = 2.2 * scale;
  buffer.surface(...SURFACES.iron);
  for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const cx = lx * r * 0.7; const cz = lz * r * 0.7;
    box(buffer, f, [cx - 0.09, 0, cz - 0.09], [cx + 0.09, legs, cz + 0.09], steel, { skip: ['bottom', 'top'] });
  }
  box(buffer, f, [-r * 1.05, legs - 0.12, -r * 1.05], [r * 1.05, legs, r * 1.05], steel, {});
  const tank = 3.0 * scale;
  buffer.surface(...SURFACES.wood);
  cylinder(buffer, f, 0, 0, r, legs, legs + tank, 8, wood);
  buffer.surface(...SURFACES.tarRoof);
  cone(buffer, f, 0, 0, r * 1.08, legs + tank, legs + tank + r * 0.75, 8, roofColor);
}

/** The point to stand a tower on: the footprint centroid when it lies inside the ring and a tank fits. */
export function towerSpot(ring: readonly Point[], inside: (x: number, z: number) => boolean, radius: number): Point | null {
  let x = 0; let z = 0;
  for (const [px, pz] of ring) { x += px; z += pz; }
  x /= ring.length; z /= ring.length;
  for (const [ox, oz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]] as const) if (!inside(x + ox, z + oz)) return null;
  return [x, z];
}

/** Bodega and corner-shop sign words: generic trades, no brand names. */
export const SHOP_WORDS = [
  'DELI GROCERY', 'BODEGA', '24 HR DELI', 'LAUNDROMAT', 'PIZZA', 'BARBER SHOP', 'FRUIT & VEG', 'CAFE', 'HARDWARE',
  'BEAUTY SUPPLY', 'SOUL FOOD', 'PHARMACY', 'WINES & LIQUORS', '99 CENTS', 'TAILOR', 'NAILS', 'SHOES', 'RECORDS',
] as const;

export function shopWords(id: string, edge: number): string {
  return SHOP_WORDS[Math.floor(hashUnit(`${id}:${edge}:words`) * SHOP_WORDS.length) % SHOP_WORDS.length]!;
}

/** Whether this storefront edge carries a lit shop sign instead of the plain fascia band. */
export function hasShopSign(id: string, edge: number): boolean {
  return hashUnit(`${id}:${edge}:sign`) < 0.35;
}

/** The local frame of a wall edge, at its midpoint, looking out of the building. */
export function wallFrame(a: Point, b: Point, out: Point): Frame {
  return frame((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, out);
}
