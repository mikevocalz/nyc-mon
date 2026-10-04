import type { Rgba } from '../neon/colors.ts';
import { glyphPixels } from './pixel-font.ts';
import { Kind, QUAD_STRIDE } from './quad-writer.ts';

/**
 * Triangle meshes for the Skia fallback.
 *
 * The GPU scenes shade each quad per pixel by kind. Skia's Vertices carry
 * only a position, a texture coordinate and a colour per vertex, so the
 * fallback splits the work: geometry that never changes per pixel (flat
 * quads, glyph pixels, streak gradients, anti-aliased rounded shapes) is
 * tessellated here once, and the per-pixel parts (window twinkle, glow
 * falloff, vignette) are left to one SkSL shader (skia-quad-shader.ts). The
 * shader reads its inputs from the texture coordinate:
 *
 * - `tex.y >= 0`: a facade window overlay. `tex.x` is the window grid
 *   column plus the facade seed, `tex.y` the grid row plus
 *   `LIT_BAND * lit level`, so a single quad carries cols, rows, seed and
 *   lit fraction.
 * - `tex.y` in one of the negative `Band`s: `tex - (0, band)` is the quad's
 *   uv for that effect.
 *
 * The mesh is drawn with BlendMode.Modulate: the vertex colour times the
 * shader, so a solid returns 1 and keeps its colour.
 *
 * Pure TypeScript, so it runs in node tests and on any thread.
 */

/** tex.y bands the quad shader switches on. */
export const Band = { SOLID: -1, GLOW: -10, CORE: -20, VIGNETTE: -30, CITY_VIGNETTE: -40 } as const;

/** Lit fraction is quantised into this many steps for the window overlay. */
export const LIT_LEVELS = 63;
/** Grid rows per lit level in tex.y; facades never have this many floors. */
export const LIT_BAND = 1024;

/** Skia indexes vertices with uint16, so a chunk stops below 65536 vertices. */
export const MAX_CHUNK_VERTICES = 65532;

export interface MeshChunk {
  positions: Float32Array;
  texs: Float32Array;
  /** ARGB ints, unpremultiplied. */
  colors: Uint32Array;
  indices: Uint16Array;
}

const to255 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255));

/** 0-1 RGBA to a Skia ARGB int. */
export function packColor(r: number, g: number, b: number, a: number): number {
  return ((to255(a) << 24) | (to255(r) << 16) | (to255(g) << 8) | to255(b)) >>> 0;
}

export class MeshBuilder {
  private pos = new Float32Array(8192);
  private tex = new Float32Array(8192);
  private col = new Uint32Array(4096);
  private idx = new Uint16Array(8192);
  private vcount = 0;
  private icount = 0;
  private done: MeshChunk[] = [];

  reset() {
    this.vcount = 0;
    this.icount = 0;
    this.done = [];
  }

  /** Make room for `nv` vertices and `ni` indices; returns the base vertex index. */
  private reserve(nv: number, ni: number): number {
    if (this.vcount + nv > MAX_CHUNK_VERTICES) this.flush();
    if ((this.vcount + nv) * 2 > this.pos.length) {
      const size = Math.max((this.vcount + nv) * 2, this.pos.length * 2);
      const pos = new Float32Array(size);
      pos.set(this.pos.subarray(0, this.vcount * 2));
      this.pos = pos;
      const tex = new Float32Array(size);
      tex.set(this.tex.subarray(0, this.vcount * 2));
      this.tex = tex;
      const col = new Uint32Array(size / 2);
      col.set(this.col.subarray(0, this.vcount));
      this.col = col;
    }
    if (this.icount + ni > this.idx.length) {
      const idx = new Uint16Array(Math.max(this.icount + ni, this.idx.length * 2));
      idx.set(this.idx.subarray(0, this.icount));
      this.idx = idx;
    }
    return this.vcount;
  }

  private flush() {
    if (!this.vcount) return;
    this.done.push({
      positions: this.pos.slice(0, this.vcount * 2),
      texs: this.tex.slice(0, this.vcount * 2),
      colors: this.col.slice(0, this.vcount),
      indices: this.idx.slice(0, this.icount),
    });
    this.vcount = 0;
    this.icount = 0;
  }

  private vertex(x: number, y: number, u: number, v: number, color: number) {
    const i = this.vcount++;
    this.pos[i * 2] = x;
    this.pos[i * 2 + 1] = y;
    this.tex[i * 2] = u;
    this.tex[i * 2 + 1] = v;
    this.col[i] = color;
  }

  private tri(a: number, b: number, c: number) {
    const i = this.icount;
    this.idx[i] = a;
    this.idx[i + 1] = b;
    this.idx[i + 2] = c;
    this.icount += 3;
  }

  /**
   * Quad on corners a, b, c, d (clockwise from top-left). Texture
   * coordinates span (u0, v0) at a to (u1, v1) at c. `top` colours a and b,
   * `bottom` colours c and d.
   */
  quad(
    ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number,
    top: number, bottom = top, u0 = 0, v0: number = Band.SOLID, u1 = u0, v1 = v0,
  ) {
    const base = this.reserve(4, 6);
    this.vertex(ax, ay, u0, v0, top);
    this.vertex(bx, by, u1, v0, top);
    this.vertex(cx, cy, u1, v1, bottom);
    this.vertex(dx, dy, u0, v1, bottom);
    this.tri(base, base + 1, base + 2);
    this.tri(base, base + 2, base + 3);
  }

  /** A closed fan around (cx, cy); `ring` holds x, y pairs. */
  fan(cx: number, cy: number, ring: Float32Array, n: number, color: number) {
    const base = this.reserve(n + 1, n * 3);
    this.vertex(cx, cy, 0, Band.SOLID, color);
    for (let i = 0; i < n; i++) this.vertex(ring[i * 2]!, ring[i * 2 + 1]!, 0, Band.SOLID, color);
    for (let i = 0; i < n; i++) this.tri(base, base + 1 + i, base + 1 + ((i + 1) % n));
  }

  /** A closed strip between two rings of n points each, coloured per ring (for feathered edges). */
  strip(inner: Float32Array, innerColor: number, outer: Float32Array, outerColor: number, n: number) {
    const base = this.reserve(n * 2, n * 6);
    for (let i = 0; i < n; i++) this.vertex(inner[i * 2]!, inner[i * 2 + 1]!, 0, Band.SOLID, innerColor);
    for (let i = 0; i < n; i++) this.vertex(outer[i * 2]!, outer[i * 2 + 1]!, 0, Band.SOLID, outerColor);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.tri(base + i, base + n + i, base + n + j);
      this.tri(base + i, base + n + j, base + j);
    }
  }

  get empty() {
    return this.vcount === 0 && this.done.length === 0;
  }

  /** Every chunk written since the last reset. */
  finish(): MeshChunk[] {
    this.flush();
    const out = this.done;
    this.done = [];
    return out;
  }
}

// ---------------------------------------------------------------------------
// Quad kinds to mesh.

/** Point at (u, v) inside the quad at `o` in `d` (bilinear; u, v may lie outside 0-1). */
function atX(d: Float32Array, o: number, u: number, v: number) {
  const tx = d[o]! + (d[o + 2]! - d[o]!) * u;
  const bx = d[o + 6]! + (d[o + 4]! - d[o + 6]!) * u;
  return tx + (bx - tx) * v;
}
function atY(d: Float32Array, o: number, u: number, v: number) {
  const ty = d[o + 1]! + (d[o + 3]! - d[o + 1]!) * u;
  const by = d[o + 7]! + (d[o + 5]! - d[o + 7]!) * u;
  return ty + (by - ty) * v;
}

function subQuad(mesh: MeshBuilder, d: Float32Array, o: number, u0: number, v0: number, u1: number, v1: number, color: number) {
  mesh.quad(
    atX(d, o, u0, v0), atY(d, o, u0, v0), atX(d, o, u1, v0), atY(d, o, u1, v0),
    atX(d, o, u1, v1), atY(d, o, u1, v1), atX(d, o, u0, v1), atY(d, o, u0, v1),
    color,
  );
}

const ringA = { buf: new Float32Array(256) };
const ringB = { buf: new Float32Array(256) };
const ringC = { buf: new Float32Array(256) };
const ringD = { buf: new Float32Array(256) };

/**
 * Outline of a w x h rounded box (radius r) grown by `grow` px, mapped
 * through the quad's corners. Returns the point count.
 */
function outline(target: { buf: Float32Array }, d: Float32Array, o: number, w: number, h: number, r: number, grow: number, segs: number) {
  const ex = Math.max(0, w / 2 + grow);
  const ey = Math.max(0, h / 2 + grow);
  const rr = Math.max(0, Math.min(r + grow, ex, ey));
  const n = 4 * (segs + 1);
  if (target.buf.length < n * 2) target.buf = new Float32Array(n * 2);
  const out = target.buf;
  let k = 0;
  // Clockwise from the top-right corner, as the GPU's corner order.
  const corners = [
    [ex - rr, -(ey - rr), -Math.PI / 2],
    [ex - rr, ey - rr, 0],
    [-(ex - rr), ey - rr, Math.PI / 2],
    [-(ex - rr), -(ey - rr), Math.PI],
  ] as const;
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= segs; i++) {
      const t = start + (i / segs) * (Math.PI / 2);
      const u = (w / 2 + cx + Math.cos(t) * rr) / w;
      const v = (h / 2 + cy + Math.sin(t) * rr) / h;
      out[k++] = atX(d, o, u, v);
      out[k++] = atY(d, o, u, v);
    }
  }
  return n;
}

/**
 * A rounded box, disc, pill or ring, anti-aliased like the GPU path: the
 * edge fades out over one device pixel (`feather` layout px) through vertex
 * colour, so Skia needs no per-pixel work for it.
 */
function roundShape(mesh: MeshBuilder, d: Float32Array, o: number, r8: number, g8: number, b8: number, a: number, feather: number) {
  const w = d[o + 12]!;
  const h = d[o + 13]!;
  const r = d[o + 14]!;
  const ring = d[o + 15]!;
  if (w <= 0 || h <= 0) return;
  const segs = r * 2 < 3 ? 2 : Math.min(8, Math.ceil(Math.sqrt(r) * 1.6));
  const solid = packColor(r8, g8, b8, a);
  const clear = packColor(r8, g8, b8, 0);
  const half = feather / 2;
  const n = outline(ringA, d, o, w, h, r, half, segs);
  outline(ringB, d, o, w, h, r, -half, segs);
  if (ring > 0) {
    outline(ringC, d, o, w, h, r, -ring + half, segs);
    outline(ringD, d, o, w, h, r, -ring - half, segs);
    mesh.strip(ringB.buf, solid, ringA.buf, clear, n);
    mesh.strip(ringC.buf, solid, ringB.buf, solid, n);
    mesh.strip(ringC.buf, solid, ringD.buf, clear, n);
    return;
  }
  mesh.fan(atX(d, o, 0.5, 0.5), atY(d, o, 0.5, 0.5), ringB.buf, n, solid);
  mesh.strip(ringB.buf, solid, ringA.buf, clear, n);
}

const glyphCache = new Map<number, [number, number][]>();

/** Window overlay quad: same corners as the facade, the grid in tex (see the module comment). */
function windowOverlay(mesh: MeshBuilder, d: Float32Array, o: number, cols: number, rows: number, seed: number, lit: number, light: number) {
  const level = Math.round(Math.max(0, Math.min(1, lit)) * LIT_LEVELS) * LIT_BAND;
  const rowsClamped = Math.min(rows, LIT_BAND - 1);
  mesh.quad(d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!, d[o + 4]!, d[o + 5]!, d[o + 6]!, d[o + 7]!, light, light, seed, level, cols + seed, level + rowsClamped);
}

/** Glow sprite: a halo quad in its colour and a white core quad over it. */
function glowSprite(mesh: MeshBuilder, d: Float32Array, o: number, r: number, g: number, b: number, a: number, coreMix: number) {
  const c = packColor(r, g, b, a);
  mesh.quad(d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!, d[o + 4]!, d[o + 5]!, d[o + 6]!, d[o + 7]!, c, c, 0, Band.GLOW, 1, Band.GLOW + 1);
  const core = packColor(1, 1, 1, a * coreMix);
  mesh.quad(d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!, d[o + 4]!, d[o + 5]!, d[o + 6]!, d[o + 7]!, core, core, 0, Band.CORE, 1, Band.CORE + 1);
}

/**
 * Append `count` QuadWriter quads (see quad-writer.ts) to `mesh`, in order.
 * `feather` is one device pixel in layout px.
 */
export function appendQuads(mesh: MeshBuilder, d: Float32Array, count: number, feather: number) {
  for (let i = 0; i < count; i++) {
    const o = i * QUAD_STRIDE;
    const kind = d[o + 16]!;
    const r = d[o + 8]!;
    const g = d[o + 9]!;
    const b = d[o + 10]!;
    const a = d[o + 11]!;
    if (a <= 0) continue;
    switch (kind) {
      case Kind.FACADE: {
        const color = packColor(r, g, b, a);
        mesh.quad(d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!, d[o + 4]!, d[o + 5]!, d[o + 6]!, d[o + 7]!, color);
        windowOverlay(mesh, d, o, Math.round(d[o + 12]!), Math.round(d[o + 13]!), d[o + 14]!, d[o + 15]!, packColor(d[o + 17]!, d[o + 18]!, d[o + 19]!, a));
        break;
      }
      case Kind.GLOW:
        glowSprite(mesh, d, o, r, g, b, a, 0.4);
        break;
      case Kind.ROUND:
        roundShape(mesh, d, o, r, g, b, a, feather);
        break;
      case Kind.GLYPH: {
        const mask = d[o + 12]!;
        const gap = d[o + 13]!;
        let pixels = glyphCache.get(mask);
        if (!pixels) {
          pixels = glyphPixels(mask);
          glyphCache.set(mask, pixels);
        }
        const color = packColor(r, g, b, a);
        for (const [col, row] of pixels) subQuad(mesh, d, o, (col + gap) / 3, (row + gap) / 5, (col + 1 - gap) / 3, (row + 1 - gap) / 5, color);
        break;
      }
      case Kind.VIGNETTE: {
        // The GPU vignette fades to black at the quad's alpha.
        const c = packColor(r, g, b, a);
        mesh.quad(d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!, d[o + 4]!, d[o + 5]!, d[o + 6]!, d[o + 7]!, c, c, 0, Band.VIGNETTE, 1, Band.VIGNETTE + 1);
        break;
      }
      case Kind.STREAK: {
        // Alpha runs from the tail (uv.y = 0, corners a and b) to the head,
        // linear like the shader's mix; vertex colours interpolate it.
        const tail = packColor(r, g, b, a * d[o + 12]!);
        const head = packColor(r, g, b, a);
        mesh.quad(d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!, d[o + 4]!, d[o + 5]!, d[o + 6]!, d[o + 7]!, tail, head);
        break;
      }
      default: {
        const color = packColor(r, g, b, a);
        mesh.quad(d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!, d[o + 4]!, d[o + 5]!, d[o + 6]!, d[o + 7]!, color);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CityBlocks quads (city-blocks-model.ts) use their own kinds.

interface CityQuadLike {
  p: readonly number[];
  color: Rgba;
  win: readonly number[];
}

const cityScratch = new Float32Array(QUAD_STRIDE);

/** Append CityBlocks quads in order. `light` is the window light colour. */
export function appendCityQuads(mesh: MeshBuilder, quads: readonly CityQuadLike[], light: Rgba) {
  const d = cityScratch;
  for (const q of quads) {
    const [r, g, b, a] = q.color;
    if (a <= 0) continue;
    for (let k = 0; k < 8; k++) d[k] = q.p[k]!;
    const kind = q.win[0]!;
    if (kind > 0.5) {
      // Facade with a window grid.
      mesh.quad(d[0]!, d[1]!, d[2]!, d[3]!, d[4]!, d[5]!, d[6]!, d[7]!, packColor(r, g, b, a));
      windowOverlay(mesh, d, 0, Math.round(kind), Math.round(q.win[1]!), q.win[2]!, q.win[3]!, packColor(light[0], light[1], light[2], a));
    } else if (kind < -2.5) {
      const c = packColor(r, g, b, a);
      mesh.quad(d[0]!, d[1]!, d[2]!, d[3]!, d[4]!, d[5]!, d[6]!, d[7]!, c, c, 0, Band.CITY_VIGNETTE, 1, Band.CITY_VIGNETTE + 1);
    } else if (kind < -1.5) {
      // Roof: the parapet band is the face at 0.78, the deck inside at 1.01.
      const bu = Math.min(0.5, q.win[1]!);
      const bv = Math.min(0.5, q.win[2]!);
      mesh.quad(d[0]!, d[1]!, d[2]!, d[3]!, d[4]!, d[5]!, d[6]!, d[7]!, packColor(r * 0.78, g * 0.78, b * 0.78, a));
      if (bu < 0.5 && bv < 0.5) subQuad(mesh, d, 0, bu, bv, 1 - bu, 1 - bv, packColor(r * 1.01, g * 1.01, b * 1.01, a));
    } else if (kind < -0.5) {
      glowSprite(mesh, d, 0, r, g, b, a, 0.45);
    } else {
      mesh.quad(d[0]!, d[1]!, d[2]!, d[3]!, d[4]!, d[5]!, d[6]!, d[7]!, packColor(r, g, b, a));
    }
  }
}
