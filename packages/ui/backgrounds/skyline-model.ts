import { brand, palette } from '@acme/theme';
import type { Rgba } from '../neon/colors.ts';
import type { District } from './city-blocks-model.ts';
import { THEMES } from './district-theme.ts';
import { mixRgba, rgba, rng, type QuadWriter } from './quad-writer.ts';

/**
 * Solid NYC skylines, one silhouette set per district.
 *
 * Generation produces flat "parts" (boxes, quads, rounds, beacons) tagged with
 * a role; painting colours each role from the district theme, so the same
 * layout can be drawn bright in front, fogged in the back, or dimmed behind
 * a rainy window. Pure TypeScript: GPU, Skia and tests all use it.
 *
 * - Downtown: narrow supertalls with setbacks and spires, a One-WTC taper.
 * - Midtown: Empire-State and Chrysler-like crowns, Deco setbacks, water towers.
 * - Harlem: brownstone rows with cornices and stoops, project slabs in a park,
 *   a few towers behind.
 * - Mega City: stacked megastructures with towers and sky bridges.
 */

export type Role =
  | 'face' | 'side' | 'cap' | 'accent' | 'steel' | 'wood' | 'woodDark' | 'stone'
  | 'park' | 'tree' | 'treeDark' | 'door' | 'trim' | 'light' | 'bridge';

export interface Part {
  role: Role;
  /** Body colour the face/side/cap roles shade from. */
  body: string;
  /** Box (x, y, w, h) unless `p` is set. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Four corners for tapers and needles. */
  p?: [number, number, number, number, number, number, number, number];
  /** Corner radius: draws a rounded box. */
  r?: number;
  /** Window grid. */
  cols?: number;
  rows?: number;
  seed?: number;
}

export interface Beacon {
  x: number;
  y: number;
  /** Blink phase offset. */
  phase: number;
}

export interface Skyline {
  parts: Part[];
  beacons: Beacon[];
  /** Tallest point (smallest y). */
  top: number;
}

export interface SkylineInput {
  /** Horizontal span to fill. */
  x0: number;
  x1: number;
  /** Street level y. */
  ground: number;
  /** Height of the tallest building class, px. */
  maxHeight: number;
  district: District;
  seed: number;
  /** Window cell scale; 1 is about 7 x 10 px. */
  windowScale?: number;
}

class Builder {
  parts: Part[] = [];
  beacons: Beacon[] = [];
  ground: number;
  cellW: number;
  cellH: number;
  next: () => number;

  constructor(ground: number, windowScale: number, seed: number) {
    this.ground = ground;
    this.cellW = 9 * windowScale;
    this.cellH = 13 * windowScale;
    this.next = rng(seed);
  }

  range(a: number, b: number) {
    return a + this.next() * (b - a);
  }

  box(role: Role, body: string, x: number, y: number, w: number, h: number, windows = false, r?: number) {
    const part: Part = { role, body, x, y, w, h };
    if (r !== undefined) part.r = r;
    if (windows) {
      part.cols = Math.floor(w / this.cellW);
      part.rows = Math.floor(h / this.cellH);
      part.seed = Math.floor(this.next() * 997);
    }
    this.parts.push(part);
  }

  quad(role: Role, body: string, p: Part['p'], windows = false, w = 0, h = 0) {
    const part: Part = { role, body, x: 0, y: 0, w: 0, h: 0, p };
    if (windows) {
      part.cols = Math.floor(w / this.cellW);
      part.rows = Math.floor(h / this.cellH);
      part.seed = Math.floor(this.next() * 997);
    }
    this.parts.push(part);
  }

  /** A solid tier: lit face, shaded side strip, a cornice cap one step lighter. Returns its top y. */
  tier(body: string, cx: number, bottom: number, w: number, h: number, capRole: Role = 'cap') {
    const x = cx - w / 2;
    const top = bottom - h;
    this.box('face', body, x, top, w, h, true);
    this.box('side', body, x + w * 0.76, top, w * 0.24, h);
    const cap = Math.max(2, Math.min(5, w * 0.05));
    this.box(capRole, body, x - 1, top - cap, w + 2, cap);
    return top - cap;
  }

  mast(cx: number, top: number, w: number, h: number) {
    this.box('steel', brand.silver, cx - w / 2, top - h, w, h);
    this.beacons.push({ x: cx, y: top - h, phase: this.next() * 6.28 });
  }

  needle(cx: number, top: number, w: number, h: number) {
    this.quad('steel', brand.silver, [cx, top - h, cx, top - h, cx + w / 2, top, cx - w / 2, top]);
    this.beacons.push({ x: cx, y: top - h, phase: this.next() * 6.28 });
  }

  waterTower(cx: number, roof: number, s: number) {
    const w = 11 * s;
    const h = 12 * s;
    const legs = 6 * s;
    this.box('woodDark', palette.orange[950], cx - w * 0.4, roof - legs, Math.max(1, s * 1.4), legs);
    this.box('woodDark', palette.orange[950], cx + w * 0.4 - s * 1.4, roof - legs, Math.max(1, s * 1.4), legs);
    this.box('wood', palette.orange[900], cx - w / 2, roof - legs - h, w, h);
    this.box('woodDark', palette.orange[950], cx - w / 2, roof - legs - h * 0.66, w, Math.max(1, s));
    this.box('woodDark', palette.orange[950], cx - w / 2, roof - legs - h * 0.33, w, Math.max(1, s));
    const peak = roof - legs - h;
    this.quad('woodDark', palette.orange[950], [cx, peak - h * 0.45, cx, peak - h * 0.45, cx + w / 2 + s, peak, cx - w / 2 - s, peak]);
  }
}

const pick = <T,>(items: readonly T[], t: number): T => items[Math.min(items.length - 1, Math.floor(t * items.length))]!;

function downtown(b: Builder, x0: number, x1: number, H: number) {
  const bodies = THEMES.downtown.bodies;
  let x = x0 - H * 0.04;
  let tapered = false;
  while (x < x1) {
    const roll = b.next();
    const body = pick(bodies, b.next());
    if (!tapered && roll < 0.18 && x > x0 + (x1 - x0) * 0.2) {
      // One-WTC-like: a square base, then a chamfered taper and a long spire.
      tapered = true;
      const w = H * b.range(0.17, 0.2);
      const h = H * b.range(0.82, 0.92);
      const base = h * 0.12;
      b.box('face', body, x, b.ground - base, w, base, true);
      const top = b.ground - h;
      const inset = w * 0.22;
      b.quad('face', body, [x + inset, top, x + w - inset, top, x + w, b.ground - base, x, b.ground - base], true, w * 0.8, h - base);
      b.quad('side', body, [x + w / 2, top, x + w - inset, top, x + w, b.ground - base, x + w / 2, b.ground - base]);
      b.box('cap', body, x + inset - 1, top - 3, w - inset * 2 + 2, 3);
      b.mast(x + w / 2, top - 3, Math.max(2, w * 0.04), h * 0.22);
      x += w + H * 0.02;
      continue;
    }
    const slim = roll > 0.72;
    const w = H * (slim ? b.range(0.06, 0.09) : b.range(0.09, 0.15));
    const h = H * (slim ? b.range(0.36, 0.6) : b.range(0.5, 0.88));
    const tiers = slim ? 1 : 2 + Math.floor(b.next() * 3);
    let bottom = b.ground;
    let tw = w;
    for (let t = 0; t < tiers; t++) {
      const share = t === 0 ? (tiers === 1 ? 1 : 0.6) : 0.4 / (tiers - 1);
      bottom = b.tier(body, x + w / 2, bottom, tw, h * share, t === tiers - 1 && b.next() < 0.25 ? 'accent' : 'cap');
      tw *= 0.78;
    }
    if (b.next() < 0.35) b.mast(x + w / 2, bottom, Math.max(1.5, w * 0.05), h * b.range(0.12, 0.22));
    x += w + H * b.range(0, 0.018);
  }
}

function midtown(b: Builder, x0: number, x1: number, H: number) {
  const bodies = THEMES.midtown.bodies;
  let x = x0 - H * 0.05;
  let empire = false;
  let chrysler = false;
  const s = b.cellW / 9;
  while (x < x1) {
    const roll = b.next();
    const body = pick(bodies, b.next());
    const span = (x - x0) / Math.max(1, x1 - x0);
    if (!empire && span > 0.35 && roll < 0.35) {
      // Empire-State-like: wide base, long shaft, stacked setbacks, lit crown, mast.
      empire = true;
      const w = H * 0.22;
      const h = H * 0.92;
      const cx = x + w / 2;
      let top = b.tier(body, cx, b.ground, w, h * 0.12);
      top = b.tier(body, cx, top, w * 0.78, h * 0.46);
      top = b.tier(body, cx, top, w * 0.6, h * 0.1);
      top = b.tier(body, cx, top, w * 0.42, h * 0.07, 'accent');
      top = b.tier(body, cx, top, w * 0.24, h * 0.06, 'accent');
      b.mast(cx, top, Math.max(2, w * 0.05), h * 0.16);
      x += w + H * 0.03;
      continue;
    }
    if (!chrysler && span > 0.1 && roll < 0.3) {
      // Chrysler-like: a shaft under stacked steel arches and a needle.
      chrysler = true;
      const w = H * 0.13;
      const h = H * 0.84;
      const cx = x + w / 2;
      const shaftTop = b.tier(body, cx, b.ground, w, h * 0.66);
      // Terraced steel crown: trapezoid steps narrowing to the needle, each
      // with a lit band where the sunburst windows sit.
      const arch = h * 0.05;
      const widths = [0.86, 0.68, 0.5, 0.32, 0.16];
      for (let i = 0; i + 1 < widths.length; i++) {
        const bw = w * widths[i]!;
        const tw = w * widths[i + 1]!;
        const by = shaftTop - arch * i;
        const ty = by - arch;
        b.quad('steel', brand.silver, [cx - tw / 2, ty, cx + tw / 2, ty, cx + bw / 2, by, cx - bw / 2, by]);
        b.box('light', body, cx - tw * 0.32, ty + arch * 0.45, tw * 0.64, Math.max(1, arch * 0.22));
      }
      b.needle(cx, shaftTop - arch * (widths.length - 1), Math.max(3, w * 0.12), h * 0.2);
      x += w + H * 0.03;
      continue;
    }
    // Deco slab: symmetric setbacks, sometimes a water tower on a low roof.
    const w = H * b.range(0.13, 0.26);
    const h = H * b.range(0.28, 0.62);
    const tiers = 2 + Math.floor(b.next() * 2);
    let bottom = b.ground;
    let tw = w;
    let firstRoof = 0;
    for (let t = 0; t < tiers; t++) {
      bottom = b.tier(body, x + w / 2, bottom, tw, h * (t === 0 ? 0.62 : 0.38 / (tiers - 1)), t === tiers - 1 && b.next() < 0.3 ? 'accent' : 'cap');
      if (t === 0) firstRoof = bottom;
      tw *= 0.72;
    }
    if (b.next() < 0.5) b.waterTower(x + w * 0.85 - 6 * s, firstRoof, s);
    else if (b.next() < 0.4) b.waterTower(x + w / 2, bottom, s);
    x += w + H * b.range(0.01, 0.04);
  }
}

function harlem(b: Builder, x0: number, x1: number, H: number, back: boolean) {
  const bodies = THEMES.harlem.bodies;
  let x = x0 - H * 0.03;
  if (back) {
    // The few tall buildings behind the rows.
    while (x < x1) {
      const w = H * b.range(0.1, 0.16);
      const h = H * b.range(0.4, 0.75);
      if (b.next() < 0.45) b.tier(pick(THEMES.midtown.bodies, b.next()), x + w / 2, b.ground, w, h);
      x += w + H * b.range(0.05, 0.25);
    }
    return;
  }
  const s = b.cellW / 9;
  while (x < x1) {
    if (b.next() < 0.22) {
      // Housing projects: plain brick slabs on a lawn with trees.
      const count = 1 + Math.floor(b.next() * 2);
      const parkX = x;
      x += H * 0.05;
      for (let i = 0; i < count; i++) {
        const w = H * b.range(0.14, 0.18);
        const h = H * b.range(0.5, 0.68);
        const body = pick(bodies.slice(1, 3), b.next());
        b.box('face', body, x, b.ground - h, w, h, true);
        b.box('side', body, x + w * 0.8, b.ground - h, w * 0.2, h);
        b.box('cap', body, x + w * 0.3, b.ground - h - 4 * s, w * 0.25, 4 * s);
        x += w + H * 0.08;
      }
      const parkW = x - parkX;
      b.box('park', palette.leaf[900], parkX, b.ground - 3 * s, parkW, 3 * s);
      for (let tx = parkX + 6 * s; tx < parkX + parkW - 4 * s; tx += b.range(9, 16) * s) {
        const r = b.range(4, 7) * s;
        b.box('door', palette.orange[950], tx - s * 0.7, b.ground - r - 3 * s, s * 1.4, r);
        b.box(b.next() < 0.5 ? 'tree' : 'treeDark', palette.leaf[700], tx - r, b.ground - r * 2.6, r * 2, r * 2, false, r);
      }
      x += H * 0.02;
      continue;
    }
    // A row of brownstones: brick, cornice, raised parlour floor and stoop.
    const units = 3 + Math.floor(b.next() * 4);
    const h = H * b.range(0.2, 0.26);
    for (let i = 0; i < units; i++) {
      const w = H * b.range(0.085, 0.105);
      const body = pick(bodies, b.next());
      const garden = h * 0.2;
      const top = b.ground - h;
      b.box('face', body, x, top, w, h - garden, true);
      b.box('side', body, x, b.ground - garden, w, garden);
      b.box('trim', palette.ink[900], x - 1.5 * s, top - 3 * s, w + 3 * s, 3 * s);
      b.box('cap', body, x, top, w, 1.5 * s);
      // Stoop: stepped stone climbing to the parlour door.
      const doorW = w * 0.24;
      const doorX = x + w * 0.12;
      b.box('door', palette.ink[950], doorX, b.ground - garden - h * 0.28, doorW, h * 0.28);
      b.box('light', body, doorX, b.ground - garden - h * 0.28, doorW, Math.max(1, h * 0.04));
      for (let step = 0; step < 3; step++) {
        const stepW = doorW * 0.55 * (3 - step);
        b.box('stone', palette.ink[800], doorX - stepW * 0.2, b.ground - (garden * (step + 1)) / 3, doorW + stepW, garden / 3 + 0.5);
      }
      x += w;
    }
    x += H * b.range(0.03, 0.06);
  }
}

function megacity(b: Builder, x0: number, x1: number, H: number, back: boolean) {
  const bodies = THEMES.megacity.bodies;
  let x = x0 - H * 0.08;
  while (x < x1) {
    const body = pick(bodies, b.next());
    const w = H * b.range(0.34, 0.56);
    const h = H * b.range(0.78, 1);
    // Stacked levels: each one a step narrower, banded with light.
    let top = b.ground;
    let lw = w;
    for (let level = 0; level < 2; level++) {
      top = b.tier(body, x + w / 2, top, lw, h * (level === 0 ? 0.16 : 0.1), 'accent');
      lw *= 0.88;
    }
    const towers = 2 + Math.floor(b.next() * 2);
    const tops: { cx: number; top: number; w: number }[] = [];
    for (let i = 0; i < towers; i++) {
      const tw = lw * b.range(0.18, 0.26);
      const cx = x + (w - lw) / 2 + (lw * (i + 0.5)) / towers;
      const th = h * b.range(0.42, 0.72);
      let tt = b.tier(pick(bodies, b.next()), cx, top, tw, th * 0.8);
      tt = b.tier(body, cx, tt, tw * 0.6, th * 0.2, 'accent');
      b.mast(cx, tt, Math.max(2, tw * 0.06), h * 0.08);
      tops.push({ cx, top: tt, w: tw });
    }
    // Sky bridges between neighbouring towers.
    for (let i = 0; i + 1 < tops.length; i++) {
      const a = tops[i]!;
      const c = tops[i + 1]!;
      const y = Math.max(a.top, c.top) + (top - Math.max(a.top, c.top)) * b.range(0.25, 0.55);
      const bh = Math.max(4, H * 0.018);
      b.box('bridge', body, a.cx, y, c.cx - a.cx, bh);
      b.box('accent', body, a.cx, y + bh * 0.35, c.cx - a.cx, Math.max(1, bh * 0.3));
    }
    // Behind a panorama the megastructures stand apart, so they read as distant giants.
    x += w + H * (back ? b.range(0.25, 0.6) : b.range(0.02, 0.06));
  }
}

/** Generate one skyline layer for a district across [x0, x1]. */
export function buildSkyline(input: SkylineInput & { back?: boolean }): Skyline {
  const b = new Builder(input.ground, input.windowScale ?? 1, input.seed * 7919 + input.district.length * 31);
  const H = input.maxHeight;
  // Before layout the canvas is 1 x 1; every generator steps by a share of H,
  // so a tiny H would never reach x1.
  if (H < 20 || input.x1 - input.x0 < 4) return { parts: [], beacons: [], top: input.ground };
  if (input.district === 'downtown') downtown(b, input.x0, input.x1, H);
  else if (input.district === 'midtown') midtown(b, input.x0, input.x1, H);
  else if (input.district === 'harlem') harlem(b, input.x0, input.x1, H, input.back ?? false);
  else megacity(b, input.x0, input.x1, H, input.back ?? false);
  let top = input.ground;
  for (const p of b.parts) top = Math.min(top, p.p ? Math.min(p.p[1], p.p[3]) : p.y);
  for (const beacon of b.beacons) top = Math.min(top, beacon.y);
  return { parts: b.parts, beacons: b.beacons, top };
}

export interface SkylineStyle {
  /** 0 = full colour, 1 = fully the fog colour. */
  fog: number;
  fogColor: Rgba;
  /** Window light colour. */
  light: Rgba;
  /** Fraction of lit windows. */
  lit: number;
  /** Accent colour for crowns and bands. */
  accent: Rgba;
  /** Multiplies every colour's alpha. */
  alpha?: number;
}

const ROLE_FIXED: Partial<Record<Role, string>> = {
  steel: palette.silver[400],
  wood: palette.orange[900],
  woodDark: palette.orange[950],
  stone: palette.ink[700],
  park: palette.leaf[900],
  tree: palette.leaf[700],
  treeDark: palette.leaf[800],
  door: palette.ink[950],
  trim: palette.ink[900],
};

function roleColor(part: Part, style: SkylineStyle, memo: Map<string, Rgba>): Rgba {
  const key = `${part.role}|${part.body}`;
  let hit = memo.get(key);
  if (hit) return hit;
  const body = rgba(part.body);
  const night = rgba(brand.night);
  const white = rgba(brand.white);
  let base: Rgba;
  switch (part.role) {
    case 'face': base = body; break;
    case 'side': base = mixRgba(body, night, 0.38); break;
    case 'cap': base = mixRgba(body, white, 0.2); break;
    case 'bridge': base = mixRgba(body, night, 0.15); break;
    case 'accent': base = style.accent; break;
    case 'light': base = style.light; break;
    default: base = rgba(ROLE_FIXED[part.role] ?? part.body);
  }
  hit = mixRgba(base, style.fogColor, style.fog);
  hit[3] = (style.alpha ?? 1) * base[3];
  memo.set(key, hit);
  return hit;
}

/** Draw a skyline's parts. Beacons are left to a moving layer (see paintBeacons). */
export function paintSkyline(w: QuadWriter, skyline: Skyline, style: SkylineStyle) {
  const memo = new Map<string, Rgba>();
  const light = mixRgba(style.light, style.fogColor, style.fog * 0.6);
  for (const part of skyline.parts) {
    const color = roleColor(part, style, memo);
    if (part.p) {
      if (part.cols) w.facadeQuad(part.p, color, part.cols, part.rows ?? 0, part.seed ?? 0, style.lit, light);
      else w.quad(...part.p, color);
    } else if (part.r !== undefined) {
      w.round(part.x, part.y, part.w, part.h, color, part.r);
    } else if (part.cols) {
      w.facade(part.x, part.y, part.w, part.h, color, part.cols, part.rows ?? 0, part.seed ?? 0, style.lit, light);
    } else {
      w.rect(part.x, part.y, part.w, part.h, color);
    }
  }
}

/** Blinking aviation lights on masts and needles. Steady when `blink` is false. */
export function paintBeacons(w: QuadWriter, skyline: Skyline, color: Rgba, time: number, blink: boolean, size = 7) {
  for (const b of skyline.beacons) {
    const on = blink ? 0.25 + 0.75 * Math.abs(Math.sin(time * 1.6 + b.phase)) : 0.9;
    w.glow(b.x, b.y, size, [color[0], color[1], color[2], color[3] * on]);
    w.disc(b.x, b.y, Math.max(1.2, size * 0.2), [color[0], color[1], color[2], color[3]]);
  }
}

/** Stepped solid sky: `bands` colours from top to `bottom`. */
export function paintSky(w: QuadWriter, width: number, bottom: number, bands: string[]) {
  const n = bands.length;
  // Bands grow towards the horizon, so the steps read as depth.
  let y = 0;
  const total = (n * (n + 1)) / 2;
  for (let i = 0; i < n; i++) {
    const h = (bottom * (i + 1)) / total;
    w.rect(0, y, width, h + 0.5, rgba(bands[i]!));
    y += h;
  }
}

export type SkylineDistrict = District | 'all';

/** Which district fills each part of a panorama: Harlem, Midtown, Downtown left to right. */
export function panoramaSpans(width: number): { district: District; x0: number; x1: number }[] {
  return [
    { district: 'harlem', x0: 0, x1: width * 0.3 },
    { district: 'midtown', x0: width * 0.3, x1: width * 0.64 },
    { district: 'downtown', x0: width * 0.64, x1: width },
  ];
}
