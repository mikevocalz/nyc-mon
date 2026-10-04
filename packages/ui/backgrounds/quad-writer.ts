import { parseColor, type NeonColorInput, type Rgba } from '../neon/colors.ts';

/**
 * The drawing vocabulary every solid NYC-MON background shares.
 *
 * A background is a list of layers that write quads (four arbitrary corners,
 * clockwise from top-left) into a QuadWriter. The TypeGPU scene draws the
 * buffer with one instanced draw call and a per-kind fragment shader; the
 * Skia fallback expands the same buffer into triangles. Models stay pure
 * TypeScript, so they run in node tests, on the GPU path and on Skia.
 */

/** Quad kinds. Stored in `extra[0]`; read by both renderers. */
export const Kind = {
  /** Plain solid fill. */
  FLAT: 0,
  /** Solid facade with a window grid. win: cols, rows, seed, lit fraction. extra 1-3: lit colour. */
  FACADE: 1,
  /** Radial glow sprite, the accent. */
  GLOW: 2,
  /** Rounded rectangle, disc or ring. win: width px, height px, radius px, ring thickness px (0 = filled). */
  ROUND: 3,
  /** 3x5 pixel glyph. win: bit mask (row-major from top-left), pixel gap fraction. */
  GLYPH: 4,
  /** Full-surface fade to the clear colour at the edges. */
  VIGNETTE: 5,
  /** Solid streak that fades towards its tail (uv.y = 0). win: tail alpha. */
  STREAK: 6,
} as const;

/** Floats per quad: corners (8), colour (4), win (4), extra (4). */
export const QUAD_STRIDE = 20;

export class QuadWriter {
  data: Float32Array;
  count = 0;

  constructor(capacity = 1024) {
    this.data = new Float32Array(capacity * QUAD_STRIDE);
  }

  reset() {
    this.count = 0;
  }

  private ensure(extra: number) {
    const needed = (this.count + extra) * QUAD_STRIDE;
    if (needed <= this.data.length) return;
    const next = new Float32Array(Math.max(needed, this.data.length * 2));
    next.set(this.data.subarray(0, this.count * QUAD_STRIDE));
    this.data = next;
  }

  /** Copy quads written elsewhere (a cached static layer). */
  append(source: Float32Array, count: number) {
    this.ensure(count);
    this.data.set(source.subarray(0, count * QUAD_STRIDE), this.count * QUAD_STRIDE);
    this.count += count;
  }

  /** Copy of what has been written so far. */
  snapshot(): { data: Float32Array; count: number } {
    return { data: this.data.slice(0, this.count * QUAD_STRIDE), count: this.count };
  }

  quad(
    ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number,
    color: Rgba, kind: number = Kind.FLAT,
    w0 = 0, w1 = 0, w2 = 0, w3 = 0, m1 = 0, m2 = 0, m3 = 0,
  ) {
    if (color[3] <= 0) return;
    this.ensure(1);
    const d = this.data;
    const o = this.count * QUAD_STRIDE;
    d[o] = ax; d[o + 1] = ay; d[o + 2] = bx; d[o + 3] = by;
    d[o + 4] = cx; d[o + 5] = cy; d[o + 6] = dx; d[o + 7] = dy;
    d[o + 8] = color[0]; d[o + 9] = color[1]; d[o + 10] = color[2]; d[o + 11] = color[3];
    d[o + 12] = w0; d[o + 13] = w1; d[o + 14] = w2; d[o + 15] = w3;
    d[o + 16] = kind; d[o + 17] = m1; d[o + 18] = m2; d[o + 19] = m3;
    this.count++;
  }

  rect(x: number, y: number, w: number, h: number, color: Rgba) {
    if (w <= 0 || h <= 0) return;
    this.quad(x, y, x + w, y, x + w, y + h, x, y + h, color);
  }

  /** A solid facade; windows light up from `lit` (0 to 1) of the cells, in `light`. */
  facade(x: number, y: number, w: number, h: number, color: Rgba, cols: number, rows: number, seed: number, lit: number, light: Rgba) {
    if (w <= 0 || h <= 0) return;
    if (cols < 1 || rows < 1) return this.rect(x, y, w, h, color);
    this.quad(x, y, x + w, y, x + w, y + h, x, y + h, color, Kind.FACADE, cols, rows, seed, lit, light[0], light[1], light[2]);
  }

  /** A facade on any four corners (perspective faces). */
  facadeQuad(p: readonly number[], color: Rgba, cols: number, rows: number, seed: number, lit: number, light: Rgba) {
    const [ax, ay, bx, by, cx, cy, dx, dy] = p as [number, number, number, number, number, number, number, number];
    if (cols < 1 || rows < 1) return this.quad(ax, ay, bx, by, cx, cy, dx, dy, color);
    this.quad(ax, ay, bx, by, cx, cy, dx, dy, color, Kind.FACADE, cols, rows, seed, lit, light[0], light[1], light[2]);
  }

  /** Rounded rectangle; a radius of half the short side makes a pill or disc. */
  round(x: number, y: number, w: number, h: number, color: Rgba, radius: number, ring = 0) {
    if (w <= 0 || h <= 0) return;
    this.quad(x, y, x + w, y, x + w, y + h, x, y + h, color, Kind.ROUND, w, h, Math.min(radius, w / 2, h / 2), ring);
  }

  disc(cx: number, cy: number, r: number, color: Rgba, ring = 0) {
    this.round(cx - r, cy - r, r * 2, r * 2, color, r, ring);
  }

  /** Radial glow sprite centred on (cx, cy). */
  glow(cx: number, cy: number, r: number, color: Rgba) {
    this.quad(cx - r, cy - r, cx + r, cy - r, cx + r, cy + r, cx - r, cy + r, color, Kind.GLOW);
  }

  /** A 3x5 pixel glyph filling the box. */
  glyph(x: number, y: number, w: number, h: number, color: Rgba, mask: number, gap = 0.12) {
    if (!mask) return;
    this.quad(x, y, x + w, y, x + w, y + h, x, y + h, color, Kind.GLYPH, mask, gap);
  }

  /** Corners of a bar of `width` from (x1, y1) to (x2, y2). uv.y runs 0 at the start to 1 at the end. */
  private barCorners(x1: number, y1: number, x2: number, y2: number, width: number) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (-(y2 - y1) / len) * (width / 2);
    const ny = ((x2 - x1) / len) * (width / 2);
    return [x1 - nx, y1 - ny, x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny] as const;
  }

  /** Solid bar between two points (butt ends). */
  bar(x1: number, y1: number, x2: number, y2: number, width: number, color: Rgba) {
    const c = this.barCorners(x1, y1, x2, y2, width);
    this.quad(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], color);
  }

  /** Pill between two points: rounded ends, oriented along the segment. */
  pill(x1: number, y1: number, x2: number, y2: number, width: number, color: Rgba) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = len ? (x2 - x1) / len : 0;
    const uy = len ? (y2 - y1) / len : 1;
    const r = width / 2;
    const c = this.barCorners(x1 - ux * r, y1 - uy * r, x2 + ux * r, y2 + uy * r, width);
    // In uv space the quad is width (u) by length (v).
    this.quad(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], color, Kind.ROUND, width, len + width, r, 0);
  }

  /** Streak from tail (x1, y1) to head (x2, y2); the tail fades to `tail` of the head alpha. */
  streak(x1: number, y1: number, x2: number, y2: number, width: number, color: Rgba, tail = 0) {
    const c = this.barCorners(x1, y1, x2, y2, width);
    this.quad(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], color, Kind.STREAK, tail);
  }

  vignette(width: number, height: number, strength = 1) {
    this.quad(0, 0, width, 0, width, height, 0, height, [0, 0, 0, strength], Kind.VIGNETTE);
  }
}

// ---------------------------------------------------------------------------
// Colour helpers. Models work in 0-1 RGBA tuples, cached per input string.

const cache = new Map<string, Rgba>();

/** Parse once, reuse forever. `alpha` multiplies the colour's own alpha. */
export function rgba(input: NeonColorInput, alpha = 1): Rgba {
  const key = `${input}|${alpha}`;
  let hit = cache.get(key);
  if (!hit) {
    const [r, g, b, a] = parseColor(input);
    hit = [r, g, b, a * alpha];
    cache.set(key, hit);
  }
  return hit;
}

/** Mix two colours; t = 0 is `a`. Allocates, so keep it out of per-quad loops where it can be hoisted. */
export function mixRgba(a: Rgba, b: Rgba, t: number): Rgba {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

export function withAlphaRgba(c: Rgba, alpha: number): Rgba {
  return [c[0], c[1], c[2], c[3] * alpha];
}

// ---------------------------------------------------------------------------
// Determinism helpers.

/** mulberry32: small, fast, deterministic. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash to 0-1, stable across platforms (no Math.sin precision drift). */
export function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Layers.

export interface Pointer {
  x: number;
  y: number;
  inside: boolean;
}

export interface PaintFrame {
  width: number;
  height: number;
  /** Seconds; frozen under reduced motion. */
  time: number;
  pointer: Pointer;
}

export interface Layer {
  paint: (writer: QuadWriter, frame: PaintFrame) => void;
  /** Static layers ignore time and pointer; they are painted once per size. */
  static?: boolean;
}

interface Cached {
  width: number;
  height: number;
  data: Float32Array;
  count: number;
}

/**
 * Paint every layer in order into `out`. Static layers are cached per layer
 * object and size in `cache`, so a background rebuilds its skyline only when
 * its props or size change, and only the moving parts run per frame.
 */
export function composeLayers(out: QuadWriter, layers: readonly Layer[], frame: PaintFrame, cache: WeakMap<Layer, Cached>, scratch: QuadWriter) {
  out.reset();
  for (const layer of layers) {
    if (!layer.static) {
      layer.paint(out, frame);
      continue;
    }
    let hit = cache.get(layer);
    if (!hit || hit.width !== frame.width || hit.height !== frame.height) {
      scratch.reset();
      layer.paint(scratch, frame);
      hit = { width: frame.width, height: frame.height, ...scratch.snapshot() };
      cache.set(layer, hit);
    }
    out.append(hit.data, hit.count);
  }
}
