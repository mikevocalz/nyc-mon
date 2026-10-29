// The storefront mesh writer: Valdrada's storefront builders, translated line for line into one set of growing vertex
// buffers per material slot (no three.js here, so the tests run it in Node).
//
//   storeBay      fk/facadeKit.js L809-L947   (a spec'd store: bulkhead, mullions, panes, transom, recessed door, the
//                                              shop room, the roll-down gate's box, guides and curtain)
//   entranceBay   fk/facadeKit.js L1124-L1166 (a spec'd entrance: frame, transom glass, leaves, the step)
//   awning        fk/facadeKit.js L2050-L2093 (sloped cloth in 0.7 m panels, valance, side panels; dome; retractable arms)
//   buildShop     city/namedShops.js L441-L545, buildAwning L547-L585 (the Amsterdam Ave shopfront systems)
//   K.storefront  src/kit.js L824-L971        (the dresser's storefront unit, nycDress.js L737-L796)
//
// Left out, and why: shopContents / windowDisplay / mannequins (facadeKit L993-L1122: several thousand triangles a shop,
// seen through 16 %-opaque glass; the room keeps its tone and lights); the gate's graffiti painter (kitTex graffitiTex, a
// canvas painter) and its bottom bar (the curtain moves in the shader, a bar would need to move with it); namedShops'
// lamps, pediment, planters, sheds, the light-court infill and the 1233 base (props and massing, not storefront);
// namedShops' painted interior canvases (interiorArt) and awning art, kept as their wall and awning colours.
//
// Depth: w is metres out from the wall face (Valdrada's frame), y metres over the sidewalk under the front.
// A spec'd store stands where Valdrada stands it, sr (0.22) behind the pier face: the blocks' walls must open the bay
// (holes(), facadeKit's `holes`). The dresser's units stand behind a punched wall in Valdrada (kit.js rd 0.18); the
// city's shell walls are not punched, so units are brought forward by UNIT_FORWARD to sit on the face.
import type { AwningPlan, EntranceBay, Front, Rgb, SignPlan, StoreBay, StorefrontPlan } from './plan-types.ts';

/**
 * Three meshes, as Valdrada merges its kit per material and per level (facadeKit.js Cell.sink: the far level per 256 m
 * square, the near level's fine parts within 120 m):
 *   paint   the far level's opaque pieces: kick plates, rails, soffits, gate boxes and curtains, sign boards and faces,
 *           awnings (roughness per vertex, the cloth drawn both ways), the named shopfronts, and the self-lit shop
 *           rooms and their light panels (written as 'lit': emission per vertex, aLit)
 *   detail  the near level, the same material: facadeKit's `near` sinks (mullions, stiles, door leaves and hardware,
 *           gate guides) and the whole of every dresser storefront unit, which Valdrada builds only for the buildings
 *           nearest the camera (nycDress.js MAX_DRESS, DRESS_R)
 *   glass   shop, door and transom glass
 */
export const SLOTS = ['paint', 'detail', 'glass'] as const;
export type Slot = (typeof SLOTS)[number];
/** What the builders write to: 'lit' is the paint mesh with the room's roughness and its emission. */
type WSlot = Slot | 'lit';

/** Per-slot extra attributes beyond position, normal and colour (colour carries roughness in w). */
export const EXTRA: Record<Slot, Record<string, number>> = {
  paint: { aGate: 3, uv: 2, aBg: 4, aLit: 2 }, detail: { aGate: 3, uv: 2, aBg: 4, aLit: 2 }, glass: { aGlass: 1 },
};
/**
 * What a vertex without the attribute carries: no gate (its foot far below the street), the atlas's solid cell under
 * a solid ground (so the face is the vertex colour), no emission.
 */
const EXTRA_DEFAULT: Record<string, number[]> = { aGate: [-1000, -1000, 0], aGlass: [0], aBg: [0, 0, 0, 1], aLit: [0, 0] };
/** Roughness by default (kitMats.js: frames and paint ~0.5, the shop room 0.8, the shutter 0.48, the cloth 0.85). */
const ROUGH: Record<WSlot, number> = { paint: 0.5, detail: 0.45, glass: 0.04, lit: 0.8 };

type V3 = [number, number, number];

class Frame {
  readonly f: Front; readonly y0: number; readonly forward: number;
  readonly ux: number; readonly uz: number; readonly nx: number; readonly nz: number;
  constructor(f: Front, y0: number, forward = 0) {
    this.f = f; this.y0 = y0; this.forward = forward;
    this.ux = f.u[0]!; this.uz = f.u[1]!; this.nx = f.n[0]!; this.nz = f.n[1]!;
  }
  /** Valdrada's Frame.world(u, y, w) in scene metres. */
  p(u: number, y: number, w: number): V3 {
    const s = u * this.f.k, ww = w + this.forward;
    return [this.f.p0[0]! + s * this.ux + ww * this.nx, this.y0 + y, this.f.p0[1]! + s * this.uz + ww * this.nz];
  }
  /** A frame-local direction (along, up, out) to world. */
  d(a: number, b: number, c: number): V3 {
    return [a * this.ux + c * this.nx, b, a * this.uz + c * this.nz];
  }
}

/** Metres over the sidewalk under which a downward face is never in view (eye height 1.6 m, less a margin). */
const EYE_FLOOR = 1.2;

const rgb = (c: Rgb | null | undefined, d: V3): V3 => (c ? [c[0]!, c[1]!, c[2]!] : d);

/** kit.js storefront units stand this far forward of where Valdrada puts them (its rd 0.18 plus 2 cm): see unit(). */
export const UNIT_FORWARD = 0.2;

/** Gate closed share for a measured day position and the night factor; the shader mirrors this (materials.ts). */
export function gateDrop(dayDown: number, night: number): number {
  return night >= 0.5 ? 1 : dayDown;
}

export interface Buffers {
  position: number[];
  normal: number[];
  color: number[];
  extra: Record<string, number[]>;
}

/** What the tests and the report count: doors, gates and signs where they were placed, in scene metres. */
export interface Feature {
  kind: 'door' | 'gate' | 'sign' | 'awning' | 'unit';
  front: string;
  x: number; y: number; z: number;
  /** The feature's frame coordinate u (Valdrada metres along the face). */
  u: number;
  text?: string;
  dayDown?: number;
}

export interface EmitResult {
  buffers: Record<Slot, Buffers>;
  features: Feature[];
  /** Openings the blocks' walls must leave (facadeKit `holes`): front id, u0, u1 (Valdrada metres along it), y0, y1. */
  holes: { front: string; u0: number; u1: number; y0: number; y1: number }[];
}

export class Writer {
  readonly buffers = {} as Record<Slot, Buffers>;
  /** Roughness written into colour.w; null takes the slot's. */
  rough: number | null = null;
  /** Emit every triangle a second time, reversed (the awning cloth, seen from under it). */
  twoSided = false;
  /** Write the far level's pieces into the near level (a dresser unit is all near level: nycDress builds it within reach). */
  near = false;
  /** The fascia atlas's solid cell, for lit surfaces that are not lettering (uv into a coverage of 1). */
  solidUv: [number, number] = [0, 0];
  constructor() {
    for (const s of SLOTS) {
      const extra: Record<string, number[]> = {};
      for (const k of Object.keys(EXTRA[s])) extra[k] = [];
      this.buffers[s] = { position: [], normal: [], color: [], extra };
    }
  }
  /** A quad a-b-c-d (counter-clockwise seen from the normal's side). */
  quad(slot: WSlot, a: V3, b: V3, c: V3, d: V3, n: V3, col: V3, ex: Record<string, number[][]> = {}): void {
    this.tri(slot, [a, b, c], n, col, pick(ex, [0, 1, 2]));
    this.tri(slot, [a, c, d], n, col, pick(ex, [0, 2, 3]));
  }
  tri(slot: WSlot, p: V3[], n: V3, col: V3, ex: Record<string, number[][]> = {}): void {
    this.put(slot, p, n, col, ex, [0, 1, 2]);
    if (this.twoSided) this.put(slot, p, [-n[0], -n[1], -n[2]], col, ex, [0, 2, 1]);
  }
  private put(ws: WSlot, p: V3[], n: V3, col: V3, ex: Record<string, number[][]>, order: number[]): void {
    const slot: Slot = ws === 'glass' ? 'glass' : ws === 'detail' || this.near ? 'detail' : 'paint';
    const B = this.buffers[slot];
    const r = this.rough ?? ROUGH[ws];
    for (const i of order) {
      B.position.push(p[i]![0], p[i]![1], p[i]![2]);
      B.normal.push(n[0], n[1], n[2]);
      B.color.push(col[0], col[1], col[2], r);
      for (const [k, size] of Object.entries(EXTRA[slot])) {
        const v = ex[k]?.[i] ?? ex[k]?.[0] ?? (k === 'uv' ? this.solidUv : EXTRA_DEFAULT[k]!);
        for (let j = 0; j < size; j++) B.extra[k]!.push(v[j] ?? 0);
      }
    }
  }
  /** Frame-aligned box [u0, u1] x [y0, y1] x [w0, w1]; the back face (w0) is never seen and is left out. */
  /**
   * `skipTop`: the top is buried under a member laid on it (a mullion under its head or transom bar). `skipEnds`: the
   * ends face panes on both sides, behind glass (an inner mullion; facadeKit's muntins skip theirs, SK.NU | SK.PU).
   */
  box(slot: WSlot, F: Frame, u0: number, u1: number, y0: number, y1: number, w0: number, w1: number, col: V3, ex: Record<string, number[][]> = {}, skipBottom = false, skipTop = false, skipEnds = false): void {
    if (!(u1 > u0) || !(y1 > y0) || !(w1 > w0)) return;
    const P = (u: number, y: number, w: number) => F.p(u, y, w);
    this.quad(slot, P(u0, y0, w1), P(u1, y0, w1), P(u1, y1, w1), P(u0, y1, w1), F.d(0, 0, 1), col, ex);    // front
    if (!skipTop) this.quad(slot, P(u0, y1, w1), P(u1, y1, w1), P(u1, y1, w0), P(u0, y1, w0), F.d(0, 1, 0), col, ex);    // top
    // a face turned down under eye height is never seen from the street or the chase camera (both stand above
    // EYE_FLOOR), so it is culled here as the GPU would cull it; higher soffits (sign boxes, gate hoods) stay
    if (!skipBottom && y0 >= EYE_FLOOR) this.quad(slot, P(u0, y0, w0), P(u1, y0, w0), P(u1, y0, w1), P(u0, y0, w1), F.d(0, -1, 0), col, ex);
    if (skipEnds) return;
    this.quad(slot, P(u0, y0, w0), P(u0, y0, w1), P(u0, y1, w1), P(u0, y1, w0), F.d(-1, 0, 0), col, ex);   // left end
    this.quad(slot, P(u1, y0, w1), P(u1, y0, w0), P(u1, y1, w0), P(u1, y1, w1), F.d(1, 0, 0), col, ex);    // right end
  }
  /** facing +w (quadW) or -w when `back`. */
  wall(slot: WSlot, F: Frame, u0: number, u1: number, y0: number, y1: number, w: number, col: V3, ex: Record<string, number[][]> = {}, back = false): void {
    if (!(u1 > u0) || !(y1 > y0)) return;
    if (back) this.quad(slot, F.p(u1, y0, w), F.p(u0, y0, w), F.p(u0, y1, w), F.p(u1, y1, w), F.d(0, 0, -1), col, ex);
    else this.quad(slot, F.p(u0, y0, w), F.p(u1, y0, w), F.p(u1, y1, w), F.p(u0, y1, w), F.d(0, 0, 1), col, ex);
  }
  /** A horizontal quad at y between w0 and w1 facing up (s = 1) or down (s = -1). */
  flat(slot: WSlot, F: Frame, u0: number, u1: number, y: number, w0: number, w1: number, s: 1 | -1, col: V3, ex: Record<string, number[][]> = {}): void {
    if (s > 0) this.quad(slot, F.p(u0, y, w1), F.p(u1, y, w1), F.p(u1, y, w0), F.p(u0, y, w0), F.d(0, 1, 0), col, ex);
    else this.quad(slot, F.p(u0, y, w0), F.p(u1, y, w0), F.p(u1, y, w1), F.p(u0, y, w1), F.d(0, -1, 0), col, ex);
  }
  /** A vertical quad across the depth at u, facing along +u (s = 1) or -u. */
  side(slot: WSlot, F: Frame, u: number, y0: number, y1: number, w0: number, w1: number, s: 1 | -1, col: V3, ex: Record<string, number[][]> = {}): void {
    if (s > 0) this.quad(slot, F.p(u, y0, w1), F.p(u, y0, w0), F.p(u, y1, w0), F.p(u, y1, w1), F.d(1, 0, 0), col, ex);
    else this.quad(slot, F.p(u, y0, w0), F.p(u, y0, w1), F.p(u, y1, w1), F.p(u, y1, w0), F.d(-1, 0, 0), col, ex);
  }
}

function pick(ex: Record<string, number[][]>, idx: number[]): Record<string, number[][]> {
  const out: Record<string, number[][]> = {};
  for (const [k, v] of Object.entries(ex)) out[k] = v.length === 1 ? v : idx.map((i) => v[i] ?? v[0]!);
  return out;
}

// ------------------------------------------------------------------ colours Valdrada names in the builders
const GRANITE: V3 = [0.365, 0.361, 0.353];        // granite_grey tint #5d5c5a (storeBay's vestibule floor)
const SOFFIT: V3 = [0.227, 0.231, 0.239];         // panel_alu tint #3a3b3d (storeBay's soffit)
const ALU: V3 = [0.769, 0.78, 0.792];             // alu_clear #c4c7ca (push bars, closers, threshold)
const GATE_DEF: V3 = [0.557, 0.576, 0.588];       // #8e9396 (storeBay's gate default)
const SHOP_LIGHT: V3 = [0.965, 0.957, 0.933];     // int_shopLight #f6f4ee
const DARK_ROOM: V3 = [0.04, 0.04, 0.045];        // int_dark (an entrance's dark hall)

// int_shop@lvl (kitMats.js L778): emission 0.13 by day to 1.3 after dark, times the level; int_shopLight (L779, the
// ceiling panels) emits after dark (nightEmit, intensity 1.3)
const lit = (v: number) => ({ aLit: [[0.13 * v, 1.3 * v]] });
const SHOP_LIGHT_LIT = (v: number) => ({ aLit: [[0, 1.3 * v]] });
const glassEx = (frosted: boolean) => ({ aGlass: [[frosted ? 1 : 0]] });

// ------------------------------------------------------------------ storeBay (facadeKit.js L809-L947)
function storeBay(W: Writer, F: Frame, bay: StoreBay, front: Front, out: EmitResult): void {
  const u0 = bay.u0, u1 = bay.u1, H = bay.h, g = bay.glazing;
  const sr = bay.setback;
  const fr = rgb(g.frame, [0.561, 0.576, 0.588]);
  const kick = rgb(g.kick, ALU);
  const bh = g.bulkhead, tr = g.transom, fw = g.frameW, fd = 0.12;
  const zf = -sr, zb = -sr - fd;
  const hasDoor = bay.door !== null;
  const D = bay.door ?? { u: 0.5, w: 1, double: false, solid: false, recess: 1.2 };
  const dw = Math.min(D.w * (D.double ? 2 : 1), u1 - u0 - 0.4);
  const du = u0 + (u1 - u0) * D.u;
  const d0 = Math.max(u0 + fw, du - dw / 2 - 0.06), d1 = Math.min(u1 - fw, du + dw / 2 + 0.06);
  const rec = hasDoor ? Math.max(0, D.recess) : 0;
  const ty = H - tr, doorTop = Math.min(ty, 2.35);
  out.holes.push({ front: front.id, u0, u1, y0: 0, y1: H });
  // the returns of the opening back to the storefront plane (reveal, in the pier material: a dark frame tone here)
  W.side('paint', F, u0, 0, H, zf, 0, 1, fr);
  W.side('paint', F, u1, 0, H, zf, 0, -1, fr);
  W.flat('paint', F, u0, u1, H, zf, 0, -1, fr);
  const spans: [number, number][] = hasDoor ? [[u0, d0], [d1, u1]] : [[u0, u1]];
  for (const [a, c] of spans) {
    if (c - a < 0.08) continue;
    W.box('paint', F, a, c, 0, bh, zb, zf, kick, {}, true);
    if (bh > 0.22 && c - a > 0.5) {
      const pn = Math.max(1, Math.round((c - a) / 1.1)), pwid = (c - a) / pn;
      for (let q = 0; q < pn; q++) W.box('paint', F, a + q * pwid + 0.07, a + (q + 1) * pwid - 0.07, 0.07, bh - 0.06, zf - 0.004, zf + 0.012, kick);
    }
    const nm = Math.max(0, Math.round(((c - a) / (u1 - u0)) * g.mullions));
    const cuts = [a];
    for (let m = 1; m <= nm; m++) cuts.push(a + ((c - a) * m) / (nm + 1));
    cuts.push(c);
    cuts.forEach((u, m) => W.box('detail', F, Math.max(a, u - fw / 2), Math.min(c, u + fw / 2), bh, ty, zb, zf + 0.004, fr, {}, true, true, m > 0 && m < cuts.length - 1));
    for (let m = 1; m + 1 < cuts.length; m++) W.box('detail', F, cuts[m]! - fw / 2 - 0.008, cuts[m]! + fw / 2 + 0.008, bh + fw, ty - fw / 2, zf + 0.004, zf + 0.015, fr);
    W.box('paint', F, a, c, bh, bh + fw, zb, zf + 0.012, fr);
    for (let m = 0; m + 1 < cuts.length; m++) W.wall('glass', F, cuts[m]! + fw / 2, cuts[m + 1]! - fw / 2, bh + fw, ty - fw / 2, zf - fd / 2, [1, 1, 1], glassEx(g.frosted));
  }
  W.box('paint', F, u0, u1, ty - fw / 2, ty + fw / 2, zb, zf + 0.004, fr);
  W.box('paint', F, u0, u1, H - fw, H, zb, zf + 0.004, fr);
  if (tr > 0.12) {
    const nt = Math.max(1, Math.round((u1 - u0) / 1.6));
    for (let m = 1; m < nt; m++) { const u = u0 + ((u1 - u0) * m) / nt; W.box('detail', F, u - fw / 2, u + fw / 2, ty + fw / 2, H - fw, zb, zf + 0.004, fr); }
    W.wall('glass', F, u0 + fw, u1 - fw, ty + fw / 2, H - fw, zf - fd / 2, [1, 1, 1], glassEx(g.frosted));
  }
  if (hasDoor) {
    const zd = zf - rec;
    for (const [u, sg] of [[d0, 1], [d1, -1]] as const) {
      W.box('detail', F, u - fw / 2, u + fw / 2, 0, doorTop, zd, zf, fr);
      if (rec > 0.3) {
        W.box('paint', F, u - fw / 2, u + fw / 2, 0, bh, zd, zf, kick);
        W.side('glass', F, u, bh, doorTop, zd + 0.05, zf - 0.05, sg, [1, 1, 1], glassEx(false));
      }
    }
    if (rec > 0.05) {
      W.flat('paint', F, d0, d1, doorTop, zd, zf, -1, SOFFIT);
      W.flat('paint', F, d0, d1, 0.012, zd, zf, 1, GRANITE);
      if (ty - doorTop > 0.02) W.wall('paint', F, d0, d1, doorTop, ty - fw / 2, zd, fr);
    }
    const leaves = D.double ? 2 : 1, lw = (d1 - d0 - 0.12) / leaves;
    for (let l = 0; l < leaves; l++) {
      const a = d0 + 0.06 + l * lw, c = a + lw, st = 0.11;
      W.box('detail', F, a, a + st, 0, doorTop - 0.05, zd - 0.05, zd, fr);
      W.box('detail', F, c - st, c, 0, doorTop - 0.05, zd - 0.05, zd, fr);
      W.box('detail', F, a + st, c - st, doorTop - 0.16, doorTop - 0.05, zd - 0.05, zd, fr);
      W.box('detail', F, a + st, c - st, 0, 0.25, zd - 0.05, zd, fr);
      if (D.solid) W.box('detail', F, a + st, c - st, 0.25, doorTop - 0.16, zd - 0.04, zd - 0.01, fr);
      else W.wall('glass', F, a + st, c - st, 0.25, doorTop - 0.16, zd - 0.025, [1, 1, 1], glassEx(false));
      W.box('detail', F, a + 0.12, c - 0.12, 0.98, 1.02, zd, zd + 0.06, ALU);
      W.box('detail', F, c - 0.5, c - 0.14, doorTop - 0.2, doorTop - 0.145, zd, zd + 0.06, ALU);
      W.box('detail', F, c - 0.1, c - 0.075, 0.82, 1.22, zd + 0.045, zd + 0.075, ALU);
    }
    if (rec > 0.3) {
      W.box('detail', F, d0, d1, 0, 0.02, zd - 0.04, zd + 0.04, ALU);
      const nq = Math.max(1, Math.round((d1 - d0) / 0.9));
      for (let q = 0; q < nq; q++) { const uq = d0 + ((q + 0.5) * (d1 - d0)) / nq; W.flat('lit', F, uq - 0.07, uq + 0.07, doorTop - 0.004, zd + rec * 0.4 - 0.07, zd + rec * 0.4 + 0.07, -1, SHOP_LIGHT, SHOP_LIGHT_LIT(1)); }
    }
    W.box('detail', F, d0, d1, doorTop - 0.05, doorTop, zd - 0.06, zd, fr);
    const c = F.p((d0 + d1) / 2, 0, zd);
    out.features.push({ kind: 'door', front: front.id, x: c[0], y: c[1], z: c[2], u: (d0 + d1) / 2 });
  }
  // the shop behind the glass (shopRoom L952-L990: the room box, its ceiling light panels)
  if (!g.frosted) {
    const tone = rgb(bay.tone, [0.6, 0.58, 0.55]);
    const zr = zf - fd, depth = 6.5, zbk = zr - depth, top = H + 0.25;
    const ceil: V3 = [Math.min(1, tone[0] * 1.08), Math.min(1, tone[1] * 1.08), Math.min(1, tone[2] * 1.08)];
    const floor: V3 = [tone[0] * 0.45, tone[1] * 0.43, tone[2] * 0.4];
    const L = lit(bay.lit);
    W.wall('lit', F, u0, u1, 0, top, zbk, tone, L);
    W.side('lit', F, u0 + 0.01, 0, top, zbk, zr, 1, [tone[0] * 0.9, tone[1] * 0.9, tone[2] * 0.9], L);
    W.side('lit', F, u1 - 0.01, 0, top, zbk, zr, -1, [tone[0] * 0.9, tone[1] * 0.9, tone[2] * 0.9], L);
    W.flat('lit', F, u0, u1, top, zbk, zr, -1, ceil, L);
    W.flat('lit', F, u0, u1, 0.01, zbk, zr, 1, floor, L);
    for (let zz = zr - 1.2; zz > zbk + 0.6; zz -= 1.8) {
      for (let u = u0 + 1.0; u < u1 - 0.6; u += 2.2) W.flat('lit', F, u - 0.3, u + 0.3, top - 0.01, zz - 0.3, zz + 0.3, -1, SHOP_LIGHT, SHOP_LIGHT_LIT(bay.lit));
    }
  }
  // the security gate (L915-L946): box over the opening, guides at the jambs, the curtain
  if (bay.gate) {
    const gc = rgb(bay.gate.color, GATE_DEF);
    const gy0 = H - 0.34;
    W.box('paint', F, u0 - 0.04, u1 + 0.04, gy0, H + 0.02, -0.01, 0.34, gc);
    W.box('detail', F, u0 - 0.02, u0 + 0.05, 0, gy0, -0.01, 0.07, gc);
    W.box('detail', F, u1 - 0.05, u1 + 0.02, 0, gy0, -0.01, 0.07, gc);
    const yTop = F.y0 + gy0, yBot = F.y0;
    W.rough = 0.48;   // kitShutterMat
    W.wall('paint', F, u0 + 0.02, u1 - 0.02, 0, gy0, 0.03, gc, { aGate: [[yTop, yBot, bay.gate.down]] });
    W.rough = null;
    const c = F.p((u0 + u1) / 2, gy0, 0.03);
    out.features.push({ kind: 'gate', front: front.id, x: c[0], y: c[1], z: c[2], u: (u0 + u1) / 2, dayDown: bay.gate.down });
  }
}

// ------------------------------------------------------------------ entranceBay (facadeKit.js L1124-L1166)
function entranceBay(W: Writer, F: Frame, bay: EntranceBay, front: Front, out: EmitResult): void {
  const D = bay.door, H = bay.h;
  const dh = Math.min(H - 0.1, D.h);
  const w = Math.min(bay.u1 - bay.u0 - 0.1, D.w * (D.kind === 'double' ? 2 : 1) + 0.12);
  const a = (bay.u0 + bay.u1) / 2 - w / 2 + D.du, c = a + w;
  const top = Math.min(H, dh + D.transom);
  const rec = D.recess, zd = -rec;
  out.holes.push({ front: front.id, u0: a, u1: c, y0: 0, y1: top });
  const fm = rgb(D.frame, [0.294, 0.227, 0.165]);
  const leaf = rgb(D.leaf, [0.231, 0.204, 0.188]);
  W.side('paint', F, a, 0, top, zd, 0, 1, fm);
  W.side('paint', F, c, 0, top, zd, 0, -1, fm);
  W.flat('paint', F, a, c, top, zd, 0, -1, fm);
  W.box('detail', F, a, a + 0.06, 0, top, zd - 0.08, zd, fm); W.box('detail', F, c - 0.06, c, 0, top, zd - 0.08, zd, fm);
  W.box('detail', F, a + 0.06, c - 0.06, dh, dh + 0.06, zd - 0.08, zd, fm); W.box('detail', F, a + 0.06, c - 0.06, top - 0.06, top, zd - 0.08, zd, fm);
  if (top - dh > 0.2) W.wall('glass', F, a + 0.06, c - 0.06, dh + 0.06, top - 0.06, zd - 0.04, [1, 1, 1], glassEx(false));
  const leaves = D.kind === 'double' ? 2 : 1, lw = (c - a - 0.12) / leaves;
  for (let l = 0; l < leaves; l++) {
    const x0 = a + 0.06 + l * lw, x1 = x0 + lw;
    if (D.kind === 'glass') {
      W.box('detail', F, x0, x0 + 0.1, 0, dh, zd - 0.06, zd - 0.01, fm); W.box('detail', F, x1 - 0.1, x1, 0, dh, zd - 0.06, zd - 0.01, fm);
      W.box('detail', F, x0 + 0.1, x1 - 0.1, dh - 0.1, dh, zd - 0.06, zd - 0.01, fm); W.box('detail', F, x0 + 0.1, x1 - 0.1, 0, 0.22, zd - 0.06, zd - 0.01, fm);
      W.wall('glass', F, x0 + 0.1, x1 - 0.1, 0.22, dh - 0.1, zd - 0.035, [1, 1, 1], glassEx(false));
      W.wall('lit', F, x0, x1, 0, dh, zd - 1.5, DARK_ROOM, lit(0));
    } else {
      W.box('paint', F, x0, x1, 0, dh, zd - 0.05, zd - 0.005, leaf);
      W.box('detail', F, x0 + 0.12, x1 - 0.12, 0.25, dh * 0.45, zd - 0.005, zd + 0.012, leaf);
      W.box('detail', F, x0 + 0.12, x1 - 0.12, dh * 0.5, dh - 0.15, zd - 0.005, zd + 0.012, leaf);
      W.box('detail', F, x1 - 0.14, x1 - 0.1, 0.95, 1.1, zd, zd + 0.06, ALU);
    }
  }
  W.box('paint', F, a - 0.05, c + 0.05, 0, 0.12, zd, 0.25, GRANITE, {}, true);
  const p = F.p((a + c) / 2, 0, zd);
  out.features.push({ kind: 'door', front: front.id, x: p[0], y: p[1], z: p[2], u: (a + c) / 2 });
}

// ------------------------------------------------------------------ signs: one atlas cell on the sign's face
function sign(W: Writer, F: Frame, s: SignPlan, plan: StorefrontPlan, front: Front, out: EmitResult, level?: [number, number]): void {
  const A = plan.atlas;
  const col = s.slot % A.cols, row = Math.floor(s.slot / A.cols);
  const tu0 = (col * A.cellW) / A.width, tu1 = ((col + 1) * A.cellW) / A.width;
  // DataTexture rows run from v = 0 at the first row of the array (flipY false)
  const tv0 = (row * A.cellH) / A.height, tv1 = ((row + 1) * A.cellH) / A.height;
  const fg = rgb(s.fg, [1, 1, 1]);
  const bg: number[] = s.bg ? [s.bg[0]!, s.bg[1]!, s.bg[2]!, 1] : [0, 0, 0, 0];
  // the board behind a panel / lightbox (signKit's box depth), in the sign's ground colour
  const depth = s.kind === 'lightbox' ? 0.24 : s.kind === 'channel' ? 0.06 : s.kind === 'painted' || s.kind === 'kit' ? 0.005 : 0.1;
  if (s.bg && s.kind !== 'painted' && s.kind !== 'kit') W.box('paint', F, s.u0, s.u1, s.y, s.y + s.h, s.z, s.z + depth - 0.004, rgb(s.bg, [0, 0, 0]));
  const w = s.z + depth;
  W.rough = 0.52;   // the sign faces (shopSigns.js FAC_rough 0.52)
  W.quad('lit', F.p(s.u0, s.y, w), F.p(s.u1, s.y, w), F.p(s.u1, s.y + s.h, w), F.p(s.u0, s.y + s.h, w), F.d(0, 0, 1), fg,
    { uv: [[tu0, tv1], [tu1, tv1], [tu1, tv0], [tu0, tv0]], aBg: [bg], aLit: [level ?? [0.1 * s.lit, 1.2 * s.lit]] });
  W.rough = null;
  const c = F.p((s.u0 + s.u1) / 2, s.y + s.h / 2, w);
  out.features.push({ kind: 'sign', front: front.id, x: c[0], y: c[1], z: c[2], u: (s.u0 + s.u1) / 2, text: plan.slots[s.slot] });
}

// ------------------------------------------------------------------ awnings
function awning(W: Writer, F: Frame, A: AwningPlan, plan: StorefrontPlan, front: Front, out: EmitResult): void {
  const col = rgb(A.color, [0.541, 0.11, 0.11]);
  W.rough = 0.85; W.twoSided = true;   // fab_awning, THREE.DoubleSide
  const { a, c, top, low, proj, drop } = A;
  if (A.kind === 'barrel') {
    // namedShops buildAwning: a quarter barrel of 10 segments
    const R = proj, P = (t: number): [number, number] => [Math.sin(t) * R, low + Math.cos(t) * (top - low)];
    for (let i = 0; i < 10; i++) {
      const [z0, y0] = P((i / 10) * Math.PI / 2), [z1, y1] = P(((i + 1) / 10) * Math.PI / 2);
      const ny = z1 - z0, nw = y0 - y1, L = Math.hypot(ny, nw) || 1;
      W.quad('paint', F.p(a, y1, z1 + 0.02), F.p(c, y1, z1 + 0.02), F.p(c, y0, z0 + 0.02), F.p(a, y0, z0 + 0.02), F.d(0, ny / L, nw / L), col);
    }
  } else if (A.kind === 'dome') {
    // facadeKit L2058-L2064: a quarter round of radius proj from top, then the drop
    const R = proj, cy = top - R;
    const prof: [number, number][] = [];
    for (let t = 0; t <= 8; t++) { const th = (t / 8) * Math.PI / 2; prof.push([R * Math.sin(th), cy + R * Math.cos(th)]); }
    prof.push([R, cy - drop]);
    for (let i = 0; i + 1 < prof.length; i++) {
      const [w0, y0] = prof[i]!, [w1, y1] = prof[i + 1]!;
      const nw = y0 - y1, ny = w1 - w0, L = Math.hypot(nw, ny) || 1;
      W.quad('paint', F.p(a, y1, w1), F.p(c, y1, w1), F.p(c, y0, w0), F.p(a, y0, w0), F.d(0, ny / L, nw / L), col);
    }
  } else {
    // the sloped cloth in panels about 0.7 m wide, each pillowed (facadeKit L2067-L2081)
    const np = Math.max(1, Math.round((c - a) / 0.7)), pw = (c - a) / np;
    const w0 = A.kind === 'named' ? 0.03 : 0.02;
    const sl = Math.hypot(proj - w0, top - low), sny = (proj - w0) / sl, snw = (top - low) / sl;
    for (let q = 0; q < np; q++) {
      const ua = a + q * pw, ub = ua + pw, lift = A.kind === 'named' ? 0 : 0.027;
      const A0 = F.p(ua, top, w0), B0 = F.p(ub, top, w0), C0 = F.p(ub, low, proj), D0 = F.p(ua, low, proj);
      const M = F.p((ua + ub) / 2, (top + low) / 2 + sny * lift, (w0 + proj) / 2 + snw * lift);
      const n = F.d(0, sny, snw);
      for (const [p, p2] of [[A0, B0], [B0, C0], [C0, D0], [D0, A0]] as const) W.tri('paint', [p, M, p2], n, col);
    }
    W.wall('paint', F, a, c, low - drop, low, proj, col);
    W.twoSided = false;
    if (A.kind !== 'retractable') {
      W.twoSided = true;
      W.tri('paint', [F.p(a, top, w0), F.p(a, low, proj), F.p(a, low - drop, proj)], F.d(-1, 0, 0), col);
      W.tri('paint', [F.p(a, top, w0), F.p(a, low - drop, proj), F.p(a, low - drop, w0)], F.d(-1, 0, 0), col);
      W.tri('paint', [F.p(c, top, w0), F.p(c, low - drop, w0), F.p(c, low - drop, proj)], F.d(1, 0, 0), col);
      W.tri('paint', [F.p(c, top, w0), F.p(c, low - drop, proj), F.p(c, low, proj)], F.d(1, 0, 0), col);
      W.twoSided = false;
    } else {
      for (const u of [a + 0.1, c - 0.1]) W.box('detail', F, u - 0.02, u + 0.02, low - 0.02, low + 0.02, 0.02, proj, ALU);
    }
    W.rough = null;
    if (A.kind === 'named') W.box('paint', F, a, c, low - 0.02, low + 0.02, proj - 0.02, proj + 0.02, [0.169, 0.18, 0.196]);
  }
  W.rough = null; W.twoSided = false;
  if (A.slot >= 0) {
    // the valance lettering (awningSign: painted, fg, a drop * 0.9 band on the valance face)
    sign(W, F, { text: plan.slots[A.slot] ?? '', u0: a + 0.1, u1: c - 0.1, y: low - drop * 0.95, h: drop * 0.9, z: proj + 0.006, kind: 'painted', lit: 0, fg: A.fg, bg: null, slot: A.slot }, plan, front, out);
  }
  const p = F.p((a + c) / 2, low, proj);
  out.features.push({ kind: 'awning', front: front.id, x: p[0], y: p[1], z: p[2], u: (a + c) / 2 });
}

// ------------------------------------------------------------------ namedShops.js buildShop (L441-L545)
function namedFront(W: Writer, F: Frame, front: Front, plan: StorefrontPlan, out: EmitResult): void {
  const sys = front.system!;
  const PIL = 0.36, PZ = 0.3, MUL = 0.09;
  const bulk = sys.bulk, head = sys.head, fasc0 = sys.fascia[0]!, fasc1 = sys.fascia[1]!;
  const dark: V3 = [0.114, 0.125, 0.141];   // 0x1d2024
  for (const S of front.shops ?? []) {
    const frame = rgb(S.frame ?? sys.color, [0.278, 0.302, 0.333]);
    for (const u of [S.from + PIL / 2, S.to - PIL / 2]) {
      W.box('paint', F, u - PIL / 2, u + PIL / 2, 0, fasc1 + 0.04, 0, PZ, frame);
      W.box('paint', F, u - PIL / 2 - 0.03, u + PIL / 2 + 0.03, 0, 0.16, 0, PZ + 0.03, frame, {}, true);
      W.box('paint', F, u - PIL / 2 + 0.07, u + PIL / 2 - 0.07, 0.5, fasc0 - 0.3, PZ, PZ + 0.012, dark);
    }
    const inner0 = S.from + PIL, inner1 = S.to - PIL, iw = inner1 - inner0;
    const weights = S.bays.map((k) => (k === 'door' ? 1.15 : k === 'blank' ? 1.2 : 2.0));
    const wsum = weights.reduce((x, y) => x + y, 0);
    const tone = rgb(S.tone, [0.667, 0.667, 0.667]);
    let u = inner0;
    S.bays.forEach((k, i) => {
      const w = (iw * weights[i]!) / wsum, a = u, b = u + w;
      u = b;
      W.box('paint', F, a - MUL / 2, a + MUL / 2, 0, head + 0.05, 0.02, 0.2, frame);
      if (i === S.bays.length - 1) W.box('paint', F, b - MUL / 2, b + MUL / 2, 0, head + 0.05, 0.02, 0.2, frame);
      const ga = a + MUL / 2, gb = b - MUL / 2;
      if (k === 'blank') { W.box('paint', F, ga, gb, 0, head, 0.02, 0.16, frame); return; }
      const y0 = k === 'door' ? 0.04 : bulk;
      if (k !== 'door') {
        W.box('paint', F, ga, gb, 0.02, bulk, 0.02, 0.18, frame);
        W.box('paint', F, ga + 0.12, gb - 0.12, 0.14, bulk - 0.14, 0.18, 0.21, frame);
        W.box('paint', F, ga - 0.02, gb + 0.02, bulk - 0.03, bulk + 0.03, 0.02, 0.22, frame);
      }
      W.wall('lit', F, ga, gb, y0, head, 0.012, tone, lit(1));
      W.wall('glass', F, ga, gb, y0, head, 0.12, [1, 1, 1], glassEx(false));
      if (k === 'door') {
        W.box('paint', F, ga, ga + 0.07, y0, head - 0.55, 0.1, 0.16, dark); W.box('paint', F, gb - 0.07, gb, y0, head - 0.55, 0.1, 0.16, dark);
        W.box('paint', F, (ga + gb) / 2 - 0.035, (ga + gb) / 2 + 0.035, y0, head - 0.55, 0.1, 0.16, dark);
        W.box('paint', F, ga, gb, head - 0.6, head - 0.52, 0.1, 0.16, dark);
        W.box('paint', F, ga, gb, y0, y0 + 0.2, 0.1, 0.16, dark);
        W.box('paint', F, ga + 0.12, (ga + gb) / 2 - 0.12, 1.02, 1.06, 0.16, 0.2, [0.722, 0.737, 0.761]);
        const p = F.p((ga + gb) / 2, 0, 0.1);
        out.features.push({ kind: 'door', front: front.id, x: p[0], y: p[1], z: p[2], u: (ga + gb) / 2 });
      } else W.box('paint', F, ga, gb, head - 0.62, head - 0.55, 0.1, 0.16, frame);
    });
    W.box('paint', F, inner0, inner1, head, fasc0, 0.02, 0.2, frame);
    if (S.slot >= 0) W.box('paint', F, inner0, inner1, fasc0, fasc1, 0.02, 0.22, frame);
  }
}

// ------------------------------------------------------------------ kit.js K.storefront (L824-L971)
// Anchored at the unit's centre on the wall face, +w out. In Valdrada it stands in a punched wall (rd = 0.18 behind the
// face); the city's shell walls are solid, so the unit comes forward by UNIT_FORWARD and the shop fill that stood 1.1 m
// behind the glass is drawn on the wall face behind it.
function unit(W: Writer, F: Frame, U: NonNullable<Front['units']>[number], front: Front, plan: StorefrontPlan, out: EmitResult): void {
  W.near = true;
  try { unitBody(W, F, U, front, plan, out); } finally { W.near = false; }
}
function unitBody(W: Writer, F: Frame, U: NonNullable<Front['units']>[number], front: Front, plan: StorefrontPlan, out: EmitResult): void {
  const sfH = 2.9, signH = 0.75, rd = 0.18, w = U.w - 0.5, uc = U.u;
  const a = uc - w / 2, c = uc + w / 2;
  // bulkhead box(w, 0.55, 0.12) at (0, 0.02, -rd + 0.06), z centred; colour 0.16, 0.15, 0.15
  W.box('detail', F, a, c, 0.02, 0.57, -rd, -rd + 0.12, [0.16, 0.15, 0.15], {}, true);
  // the sign: an atlas cell quad(w + 0.1, signH) at (0, sfH + 0.12, 0.10) and its box(w + 0.18, signH + 0.08, 0.14) at
  // (0, sfH + 0.08, 0.02); the 'signs' material lights it at 0.05 of its colour
  W.box('detail', F, uc - (w + 0.18) / 2, uc + (w + 0.18) / 2, sfH + 0.08, sfH + 0.16 + signH, 0.02 - 0.07, 0.02 + 0.07, [0.12, 0.11, 0.11]);
  sign(W, F, { text: plan.slots[U.slot] ?? '', u0: uc - (w + 0.1) / 2, u1: uc + (w + 0.1) / 2, y: sfH + 0.12, h: signH, z: 0.1, kind: 'kit', lit: 0, fg: U.fg, bg: U.bg, slot: U.slot }, plan, front, out, [0.05, 0.05]);
  // the glazing: quad(gw, sfH - 0.62) from y 0.6 at z -rd + 0.02, gw = q05(min(w - 0.1, 7)); the steelDark frame
  const gw = Math.round(Math.min(w - 0.1, 7) * 20) / 20, g0 = uc - gw / 2, g1 = uc + gw / 2;
  W.wall('glass', F, g0, g1, 0.6, 0.6 + sfH - 0.62, -rd + 0.02, [1, 1, 1], glassEx(false));
  const steel: V3 = [0.12, 0.12, 0.13];
  const nM = Math.max(1, Math.round(gw / 1.4));
  for (let i = 0; i <= nM; i++) { const x = g0 + (gw / nM) * i; W.box('detail', F, x - 0.0275, x + 0.0275, 0.6, sfH, -rd + 0.03 - 0.035, -rd + 0.03 + 0.035, steel, {}, true, true, i > 0 && i < nM); }
  W.box('detail', F, g0, g1, sfH - 0.06, sfH, -rd + 0.03 - 0.035, -rd + 0.03 + 0.035, steel);
  W.box('detail', F, g0, g1, 0.55, 0.6, -rd + 0.03 - 0.045, -rd + 0.03 + 0.045, steel);
  W.box('detail', F, g0, g1, sfH - 0.7, sfH - 0.65, -rd + 0.03 - 0.035, -rd + 0.03 + 0.035, steel);
  // the shop fill (0.42, 0.38, 0.32, "a lit shop interior, not a black card") and the warm ceiling strips
  if (U.gate !== 2) {
    W.wall('lit', F, g0, g1, 0.55, sfH - 0.15, -UNIT_FORWARD + 0.005, [0.42, 0.38, 0.32], { aLit: [[1, 1]] });
    W.wall('lit', F, g0 + gw * 0.05, g1 - gw * 0.05, sfH - 0.9, sfH - 0.83, -UNIT_FORWARD + 0.006, [1, 0.92, 0.78], { aLit: [[1, 1]] });
  }
  // the gates: by day as the dresser drew them; every unit's glazing closes after dark (the port's, gateDrop)
  const gy0 = 0.02 + sfH - 0.25, zg = -rd + 0.055;
  const curtain = (x0: number, x1: number, dayDown: number) => {
    W.rough = 0.55;   // rollGate: roughness 0.55 (src/materials.js L170)
    W.wall('paint', F, x0, x1, 0.02, gy0, zg, GATE_DEF, { aGate: [[F.y0 + gy0, F.y0 + 0.02, dayDown]] });
    W.rough = null;
  };
  if (U.gate > 0) {
    const gwidth = U.gate === 2 ? w : Math.min(2.2, w * 0.4);
    const gx = U.gate === 2 ? uc : uc + U.side * (w / 2 - gwidth / 2);
    curtain(gx - gwidth / 2, gx + gwidth / 2, 1);
    if (U.gate === 1) curtain(U.side > 0 ? a : gx + gwidth / 2, U.side > 0 ? gx - gwidth / 2 : c, 0);
    W.box('paint', F, gx - (gwidth + 0.1) / 2, gx + (gwidth + 0.1) / 2, sfH - 0.28, sfH + 0.02, -rd + 0.1 - 0.15, -rd + 0.1 + 0.15, [0.3, 0.3, 0.31]);
  } else curtain(a, c, 0);
  // the awning (L921-L970): fabric tipped 0.72 rad over L = 1.35 m, valance 0.3 m, gussets, from (0, sfH + 0.05, 0.02)
  if (U.awning) {
    const aw = Math.round(Math.min(w * 0.92, 6.5) * 20) / 20, x0 = uc - aw / 2, x1 = uc + aw / 2;
    const theta = 0.72, L = 1.35, drop = L * Math.sin(theta), zOut = L * Math.cos(theta), top = sfH + 0.05, wz = 0.02;
    const col = rgb(U.awning, [0.557, 0.184, 0.137]);
    W.rough = 0.85; W.twoSided = true;
    W.quad('paint', F.p(x0, top - drop, wz + zOut), F.p(x1, top - drop, wz + zOut), F.p(x1, top, wz), F.p(x0, top, wz), F.d(0, Math.cos(theta), Math.sin(theta)), col);
    W.wall('paint', F, x0, x1, top - drop - 0.3, top - drop, wz + zOut - 0.015, col);
    W.tri('paint', [F.p(x0, top, wz), F.p(x0, top - drop, wz + zOut), F.p(x0, top - drop, wz)], F.d(-1, 0, 0), col);
    W.tri('paint', [F.p(x1, top, wz), F.p(x1, top - drop, wz), F.p(x1, top - drop, wz + zOut)], F.d(1, 0, 0), col);
    W.rough = null; W.twoSided = false;
    const p = F.p(uc, top - drop, wz + zOut);
    out.features.push({ kind: 'awning', front: front.id, x: p[0], y: p[1], z: p[2], u: uc });
  }
  const p = F.p(uc, gy0, zg);
  out.features.push({ kind: 'unit', front: front.id, x: p[0], y: p[1], z: p[2], u: uc, dayDown: U.gate === 2 ? 1 : 0, text: plan.slots[U.slot] });
}

/** Writes the whole plan. `groundY` is the walking surface under a scene point (ctx.groundY). */
export function emitPlan(plan: StorefrontPlan, groundY: (x: number, z: number) => number, filter?: (f: Front) => boolean): EmitResult {
  const W = new Writer();
  // the atlas's last cell is solid (bake-vd-storefronts.mjs): a lit surface that is not lettering samples it
  const A = plan.atlas, last = (A.width / A.cellW) * (A.height / A.cellH) - 1;
  W.solidUv = [((last % A.cols) + 0.5) * A.cellW / A.width, (Math.floor(last / A.cols) + 0.5) * A.cellH / A.height];
  const out: EmitResult = { buffers: W.buffers, features: [], holes: [] };
  for (const front of plan.fronts) {
    if (filter && !filter(front)) continue;
    // the sidewalk in front (facadeKit makeB: padYNear 1.2 m out from the face's middle)
    const mid = front.len / 2;
    const gx = front.p0[0]! + front.u[0]! * mid + front.n[0]! * 1.2, gz = front.p0[1]! + front.u[1]! * mid + front.n[1]! * 1.2;
    const F = new Frame(front, groundY(gx, gz), front.src === 2 ? UNIT_FORWARD : 0);
    if (front.src === 1) namedFront(W, F, front, plan, out);
    for (const bay of front.bays) {
      if (bay.t === 's') storeBay(W, F, bay, front, out);
      else entranceBay(W, F, bay, front, out);
    }
    for (const u of front.units ?? []) unit(W, F, u, front, plan, out);
    for (const s of front.signs) sign(W, F, s, plan, front, out);
    for (const a of front.awnings) awning(W, F, a, plan, front, out);
  }
  return out;
}

/** Valdrada world (vp0 + u * vu) for a frame coordinate: what the tests compare against transform.ts. */
export function valdradaPoint(front: Front, u: number): [number, number] {
  return [front.vp0[0]! + u * front.vu[0]!, front.vp0[1]! + u * front.vu[1]!];
}
