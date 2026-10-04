import { brand, palette } from '@acme/theme';
import { parseColor, type NeonColorInput, type Rgba } from '../neon/colors.ts';
import { shadeSteps } from '../neon/shade.ts';

/**
 * CityBlocks geometry: a street-grid plan of New York blocks, seen from above
 * at an oblique angle so every building is a stack of solid faces.
 *
 * Pure TypeScript, shared by the TypeGPU renderer and the Skia fallback, so
 * both draw the same city from the same seed. Everything is in layout px.
 */

export type District = 'downtown' | 'midtown' | 'harlem' | 'megacity';

/**
 * Quad kinds, read by both renderers:
 * - FACADE: solid face with a window grid (cols, rows, seed, lit fraction)
 * - FLAT: plain solid fill
 * - ROOF: solid fill with a darker bevel band (u and v bevel as fractions)
 * - GLOW: radial accent sprite (traffic lights)
 * - VIGNETTE: full-screen fade to night at the edges
 */
export const QuadKind = { FACADE: 1, FLAT: 0, GLOW: -1, ROOF: -2, VIGNETTE: -3 } as const;

/** Four corners, clockwise from top-left: uv (0,0), (1,0), (1,1), (0,1). */
export interface Quad {
  p: [number, number, number, number, number, number, number, number];
  color: Rgba;
  /** x: kind or facade columns; y, z, w: kind-specific (see QuadKind). */
  win: [number, number, number, number];
}

export interface BlockRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Lane {
  /** 'v' runs along an avenue (north-south), 'h' along a street. */
  axis: 'v' | 'h';
  /** Fixed coordinate (x for 'v', y for 'h'). */
  at: number;
  /** Travel direction along the axis. */
  dir: 1 | -1;
}

export interface CityLayout {
  width: number;
  height: number;
  /** Everything that only changes on resize or prop change. */
  quads: Quad[];
  /** Index in `quads` of the hover highlight slot (transparent until set). */
  hoverSlot: number;
  blocks: BlockRect[];
  lanes: Lane[];
  /** Window light colour, for renderers that draw lights separately. */
  light: Rgba;
}

export interface CityInput {
  width: number;
  height: number;
  district: District;
  /** North-south depth of one block in px; avenue blocks run longer east-west. */
  blockSize: number;
  /** Street width in px; avenues are wider. */
  streetWidth: number;
  seed: number;
  /** Lit-window colour. */
  lightColor: NeonColorInput;
  /** Lane-marking and accent colour. */
  accentColor: NeonColorInput;
  windowLights: boolean;
}

/** Screen offset per px of building height: up and to the right. */
export const EXTRUDE: readonly [number, number] = [0.2, -0.36];

interface DistrictSpec {
  /** East-west block length relative to its north-south depth. */
  aspect: number;
  /** Lots across each half-block row. */
  lots: [number, number];
  /** Chance a lot is built on. */
  fill: number;
  /** Building height range, in multiples of blockSize. */
  height: [number, number];
  /** Setback tiers. */
  tiers: [number, number];
  spire: number;
  waterTower: number;
  /** Chance the top tier is an Art Deco crown in the accent shade. */
  crown: number;
  /** Shade families for building bodies. */
  bodies: NeonColorInput[];
  ground: string;
  /** Traffic sprites per 1000 px of lane. */
  traffic: number;
  litFraction: number;
}

const SPECS: Record<District, DistrictSpec> = {
  // FiDi: short irregular blocks packed with glass supertalls and spires.
  downtown: {
    aspect: 1.5, lots: [1, 2], fill: 0.85, height: [0.9, 2.6], tiers: [2, 4],
    spire: 0.3, waterTower: 0, crown: 0.08,
    bodies: ['royal', 'royal', 'ink', 'carolina'], ground: palette.ink[900], traffic: 9, litFraction: 0.42,
  },
  // Midtown: long avenue blocks, stepped Art Deco setbacks, rooftop water towers.
  midtown: {
    aspect: 2.5, lots: [2, 4], fill: 0.85, height: [0.4, 1.4], tiers: [2, 4],
    spire: 0.06, waterTower: 0.4, crown: 0.16,
    bodies: ['ink', 'ink', 'ink', 'royal', 'silver'], ground: palette.ink[900], traffic: 12, litFraction: 0.5,
  },
  // Harlem: brownstone rows, project slabs on lawns, a few towers behind.
  harlem: {
    aspect: 2.6, lots: [3, 5], fill: 1, height: [0.24, 0.36], tiers: [1, 1],
    spire: 0, waterTower: 0.1, crown: 0,
    bodies: [palette.orange[900], palette.orange[950], palette.apple[900]], ground: palette.ink[900], traffic: 6, litFraction: 0.55,
  },
  // Mega City: future NYC, megastructures over merged blocks and sky bridges.
  megacity: {
    aspect: 2.0, lots: [1, 1], fill: 1, height: [1.8, 3.4], tiers: [3, 5],
    spire: 0.5, waterTower: 0, crown: 0.3,
    bodies: ['royal', 'ink', 'carolina'], ground: palette.ink[950], traffic: 16, litFraction: 0.6,
  },
};

/** mulberry32: small, fast, deterministic. */
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (r: () => number, [lo, hi]: [number, number]) => lo + r() * (hi - lo);
const int = (r: () => number, [lo, hi]: [number, number]) => Math.floor(lo + r() * (hi - lo + 1));
const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)]!;

const rect = (x0: number, y0: number, x1: number, y1: number): Quad['p'] => [x0, y0, x1, y0, x1, y1, x0, y1];

function flat(x0: number, y0: number, x1: number, y1: number, color: Rgba): Quad {
  return { p: rect(x0, y0, x1, y1), color, win: [QuadKind.FLAT, 0, 0, 0] };
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  base: number;
  top: number;
  shade: NeonColorInput;
  windows: boolean;
  /** Sort key: the building it belongs to keeps its tiers together. */
  order: number;
}

const WINDOW_PITCH = 4.5;

/** West face, south face and roof of one extruded box, back to front. */
function boxQuads(b: Box, seed: number, lit: number, windowLights: boolean): Quad[] {
  const [ex, ey] = EXTRUDE;
  const bx = ex * b.base;
  const by = ey * b.base;
  const tx = ex * b.top;
  const ty = ey * b.top;
  const s = shadeSteps(b.shade);
  const rise = (b.top - b.base) * -ey;
  const windows = windowLights && b.windows && rise > 6;
  const rows = Math.max(1, Math.round(rise / WINDOW_PITCH));
  const southCols = Math.max(1, Math.round((b.x1 - b.x0) / WINDOW_PITCH));
  const westCols = Math.max(1, Math.round((b.y1 - b.y0) / (WINDOW_PITCH * 1.6)));
  const facade = (cols: number, dim: number): Quad['win'] =>
    windows ? [cols, rows, seed, lit * dim] : [QuadKind.FLAT, 0, 0, 0];
  const bevelU = Math.min(0.45, 1.5 / Math.max(1, b.x1 - b.x0));
  const bevelV = Math.min(0.45, 1.5 / Math.max(1, b.y1 - b.y0));
  return [
    {
      p: [b.x0 + tx, b.y0 + ty, b.x0 + tx, b.y1 + ty, b.x0 + bx, b.y1 + by, b.x0 + bx, b.y0 + by],
      color: parseColor(s.deep),
      win: facade(westCols, 0.6),
    },
    {
      p: [b.x0 + tx, b.y1 + ty, b.x1 + tx, b.y1 + ty, b.x1 + bx, b.y1 + by, b.x0 + bx, b.y1 + by],
      color: parseColor(s.side),
      win: facade(southCols, 1),
    },
    {
      p: rect(b.x0 + tx, b.y0 + ty, b.x1 + tx, b.y1 + ty),
      color: parseColor(s.top),
      win: [QuadKind.ROOF, bevelU, bevelV, 0],
    },
  ];
}

/** A tower of stacked setback tiers on one footprint, plus its rooftop extras. */
function tower(
  r: () => number,
  spec: DistrictSpec,
  x0: number, y0: number, x1: number, y1: number,
  height: number, order: number, accent: NeonColorInput,
): Box[] {
  const boxes: Box[] = [];
  const body = pick(r, spec.bodies);
  const tiers = int(r, spec.tiers);
  let base = 0;
  let fx0 = x0, fy0 = y0, fx1 = x1, fy1 = y1;
  const crown = r() < spec.crown;
  for (let t = 0; t < tiers; t++) {
    const share = t === tiers - 1 ? 1 : 0.45 + r() * 0.3;
    const top = t === tiers - 1 ? height : base + (height - base) * share;
    const last = t === tiers - 1;
    boxes.push({
      x0: fx0, y0: fy0, x1: fx1, y1: fy1, base, top,
      shade: last && crown ? accent : body,
      windows: !(last && crown), order,
    });
    base = top;
    // Setback: each tier steps in, more on the street side.
    const insetX = (fx1 - fx0) * (0.1 + r() * 0.12);
    const insetY = (fy1 - fy0) * (0.1 + r() * 0.12);
    if (fx1 - fx0 - insetX * 2 < 3 || fy1 - fy0 - insetY * 2 < 3) break;
    fx0 += insetX; fx1 -= insetX; fy0 += insetY; fy1 -= insetY;
  }
  const cx = (fx0 + fx1) / 2;
  const cy = (fy0 + fy1) / 2;
  if (r() < spec.spire) {
    boxes.push({ x0: cx - 1.2, y0: cy - 1.2, x1: cx + 1.2, y1: cy + 1.2, base, top: base + height * 0.22, shade: 'silver', windows: false, order });
  } else if (r() < spec.waterTower && fx1 - fx0 > 8) {
    // Wooden water tower on legs: a dark stand and a cedar tank.
    const wx = fx0 + (fx1 - fx0) * (0.2 + r() * 0.5);
    const wy = fy0 + (fy1 - fy0) * (0.2 + r() * 0.5);
    boxes.push({ x0: wx - 2, y0: wy - 2, x1: wx + 2, y1: wy + 2, base, top: base + 4, shade: 'ink', windows: false, order });
    boxes.push({ x0: wx - 2.6, y0: wy - 2.6, x1: wx + 2.6, y1: wy + 2.6, base: base + 4, top: base + 10, shade: palette.orange[800], windows: false, order });
  }
  return boxes;
}

export function buildCity(input: CityInput): CityLayout {
  const { width, height, district, blockSize, streetWidth, seed } = input;
  const spec = SPECS[district];
  const r = rng(seed * 9973 + district.length * 131);
  const accent = input.accentColor;
  const accentRgba = parseColor(accent);
  const scale = blockSize;
  const maxRise = spec.height[1] * scale * 1.25;

  const blockH = blockSize;
  const blockW = blockSize * spec.aspect;
  const avenue = streetWidth * 1.8;
  const pitchX = blockW + avenue;
  const pitchY = blockH + streetWidth;

  // Cover the viewport plus the margin that tall buildings lean in from:
  // roofs shift up and right, so footprints below and left of the screen
  // can still show.
  const x0 = -Math.ceil((maxRise * EXTRUDE[0] + pitchX) / pitchX) * pitchX + avenue / 2;
  const y0 = -pitchY + streetWidth / 2;
  const cols = Math.ceil((width - x0) / pitchX) + 1;
  const rows = Math.ceil((height + maxRise * -EXTRUDE[1] - y0) / pitchY) + 1;

  const plates: Quad[] = [];
  const lanes: Quad[] = [];
  const boxes: Box[] = [];
  const blocks: BlockRect[] = [];
  const laneList: Lane[] = [];
  const ground = parseColor(spec.ground);
  const lawn = parseColor(palette.leaf[900]);
  const curb = parseColor(palette.ink[800]);

  let order = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Mega City merges blocks in pairs east-west into one megastructure.
      if (district === 'megacity' && col % 2 === 1) continue;
      const span = district === 'megacity' ? 2 : 1;
      const bx = x0 + col * pitchX;
      const by = y0 + row * pitchY;
      const bw = blockW * span + avenue * (span - 1);
      const block = { x: bx, y: by, w: bw, h: blockH };
      blocks.push(block);
      const isProjects = district === 'harlem' && r() < 0.22;
      plates.push(flat(bx - 1, by - 1, bx + bw + 1, by + blockH + 1, curb));
      plates.push(flat(bx, by, bx + bw, by + blockH, isProjects ? lawn : ground));

      const pad = Math.max(3, streetWidth * 0.5);
      const ix0 = bx + pad, iy0 = by + pad, ix1 = bx + bw - pad, iy1 = by + blockH - pad;

      if (district === 'megacity') {
        boxes.push(...tower(r, spec, ix0, iy0, ix1, iy1, range(r, spec.height) * scale, order++, accent));
        continue;
      }
      if (isProjects) {
        // City housing: one or two long slabs set back on a lawn.
        const slabs = 1 + Math.floor(r() * 2);
        const sw = (ix1 - ix0) / slabs;
        for (let s = 0; s < slabs; s++) {
          const sx0 = ix0 + s * sw + sw * 0.18;
          const sx1 = ix0 + (s + 1) * sw - sw * 0.18;
          const sy0 = iy0 + (iy1 - iy0) * 0.3;
          const sy1 = iy1 - (iy1 - iy0) * 0.25;
          boxes.push({ x0: sx0, y0: sy0, x1: sx1, y1: sy1, base: 0, top: range(r, [0.9, 1.3]) * scale, shade: palette.apple[800], windows: true, order: order++ });
        }
        continue;
      }
      // Each block is two half-rows, north and south, cut into lots.
      const midY = (iy0 + iy1) / 2;
      for (const [ry0, ry1] of [[iy0, midY - 0.5], [midY + 0.5, iy1]] as const) {
        if (district === 'harlem') {
          // Brownstone row: one continuous box per run of matching stone,
          // cornice on top, stoops in front.
          const runs = int(r, spec.lots);
          const runW = (ix1 - ix0) / runs;
          // Towers rise behind the rows near the top of the view.
          const behind = by < height * 0.32 && r() < 0.18;
          for (let k = 0; k < runs; k++) {
            const rx0 = ix0 + k * runW;
            const rx1 = rx0 + runW - 0.6;
            const top = range(r, spec.height) * scale;
            const stone = pick(r, spec.bodies);
            if (behind && k === 0) {
              boxes.push(...tower(r, SPECS.midtown, rx0, ry0, rx1, ry1, range(r, [1.4, 2.2]) * scale, order++, accent));
              continue;
            }
            boxes.push({ x0: rx0, y0: ry0, x1: rx1, y1: ry1, base: 0, top, shade: stone, windows: true, order });
            // Cornice: a thin lighter ledge along the street front only.
            boxes.push({ x0: rx0, y0: ry1 - 1.4, x1: rx1, y1: ry1 + 0.6, base: top, top: top + 1.6, shade: palette.orange[500], windows: false, order });
            order++;
            const stoops = Math.max(1, Math.round(runW / 9));
            for (let st = 0; st < stoops; st++) {
              const sx = rx0 + (st + 0.5) * (runW / stoops);
              plates.push(flat(sx - 1.2, ry1, sx + 1.2, ry1 + Math.min(2.4, pad * 0.9), parseColor(palette.orange[400])));
            }
          }
          continue;
        }
        const lots = int(r, spec.lots);
        let cursor = ix0;
        for (let k = 0; k < lots; k++) {
          const remaining = lots - k;
          const lw = k === lots - 1 ? ix1 - cursor : ((ix1 - cursor) / remaining) * (0.7 + r() * 0.6);
          if (r() < spec.fill && lw > 4) {
            boxes.push(...tower(r, spec, cursor + 0.6, ry0, cursor + lw - 0.6, ry1, range(r, spec.height) * scale, order++, accent));
          }
          cursor += lw;
        }
      }
    }
  }

  // Sky bridges join neighbouring megastructures mid-height.
  if (district === 'megacity') {
    for (const b of blocks) {
      if (r() > 0.45) continue;
      const by0 = b.y + b.h * 0.42;
      const level = range(r, [0.9, 1.6]) * scale;
      boxes.push({ x0: b.x + b.w - 2, y0: by0, x1: b.x + b.w + avenue + 2, y1: by0 + 4, base: level, top: level + 5, shade: 'carolina', windows: false, order: order++ });
    }
  }

  // Lane markings: dashed avenue centrelines and the lanes traffic runs in.
  const dash = parseColor(`rgba(${Math.round(accentRgba[0] * 255)},${Math.round(accentRgba[1] * 255)},${Math.round(accentRgba[2] * 255)},0.55)`);
  for (let col = 0; col <= cols; col++) {
    const ax = x0 + col * pitchX - avenue / 2;
    if (ax < -avenue || ax > width + avenue) continue;
    for (let y = -8; y < height + 8; y += 14) lanes.push(flat(ax - 0.5, y, ax + 0.5, y + 6, dash));
    laneList.push({ axis: 'v', at: ax - avenue * 0.25, dir: 1 }, { axis: 'v', at: ax + avenue * 0.25, dir: -1 });
  }
  for (let row = 0; row <= rows; row++) {
    const sy = y0 + row * pitchY - streetWidth / 2;
    if (sy < -streetWidth || sy > height + streetWidth) continue;
    laneList.push({ axis: 'h', at: sy, dir: row % 2 === 0 ? 1 : -1 });
  }

  // Back to front: north rows first; within a row, east before west,
  // because roofs lean up and to the right over their eastern neighbours.
  const footprintOf = new Map<number, Box>();
  for (const b of boxes) if (!footprintOf.has(b.order)) footprintOf.set(b.order, b);
  boxes.sort((a, b) => {
    const fa = footprintOf.get(a.order)!;
    const fb = footprintOf.get(b.order)!;
    return fa.y1 - fb.y1 || fb.x0 - fa.x0 || a.order - b.order || a.base - b.base;
  });

  const light = parseColor(input.lightColor);
  const quads: Quad[] = [...plates];
  const hoverSlot = quads.length;
  quads.push({ p: rect(0, 0, 0, 0), color: [0, 0, 0, 0], win: [QuadKind.FLAT, 0, 0, 0] });
  quads.push(...lanes);
  boxes.forEach((b, i) => quads.push(...boxQuads(b, (seed * 31 + i) % 997, spec.litFraction, input.windowLights)));

  return { width, height, quads, hoverSlot, blocks, lanes: laneList, light };
}

/** Index of the block under a point, or -1. */
export function blockAt(layout: CityLayout, x: number, y: number): number {
  return layout.blocks.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}

/** The hover highlight for a block: an accent plate under the buildings. */
export function hoverQuad(layout: CityLayout, index: number, color: NeonColorInput): Quad {
  const b = layout.blocks[index];
  if (!b) return { p: rect(0, 0, 0, 0), color: [0, 0, 0, 0], win: [QuadKind.FLAT, 0, 0, 0] };
  return { p: rect(b.x - 2, b.y - 2, b.x + b.w + 2, b.y + b.h + 2), color: parseColor(color), win: [QuadKind.FLAT, 0, 0, 0] };
}

export interface TrafficOptions {
  /** Multiplier on the district's traffic density. 0 turns traffic off. */
  density: number;
  speed: number;
  headlight: NeonColorInput;
  taillight: NeonColorInput;
}

/** Most traffic sprites a layout can produce; renderers size buffers with it. */
export function trafficCapacity(layout: CityLayout, density: number): number {
  const lanePx = layout.lanes.reduce((sum, l) => sum + (l.axis === 'v' ? layout.height : layout.width) + 80, 0);
  return Math.ceil((lanePx / 1000) * 16 * Math.max(0, density)) + layout.lanes.length;
}

/**
 * Traffic at a moment in time, as glow sprites. Stateless: position is a
 * function of time, so a frozen clock (reduced motion) freezes the street
 * and both renderers agree on where every car is.
 */
export function trafficAt(layout: CityLayout, district: District, time: number, opts: TrafficOptions): Quad[] {
  if (opts.density <= 0) return [];
  const spec = SPECS[district];
  const head = parseColor(opts.headlight);
  const tail = parseColor(opts.taillight);
  const out: Quad[] = [];
  layout.lanes.forEach((lane, li) => {
    const length = (lane.axis === 'v' ? layout.height : layout.width) + 80;
    const count = Math.max(1, Math.round((length / 1000) * spec.traffic * opts.density));
    for (let c = 0; c < count; c++) {
      const h = Math.sin((li + 1) * 12.9898 + (c + 1) * 78.233) * 43758.5453;
      const jitter = h - Math.floor(h);
      const speed = (38 + jitter * 34) * opts.speed;
      const along = (((c / count + jitter * 0.6) * length + lane.dir * time * speed) % length + length) % length - 40;
      const [x, y] = lane.axis === 'v' ? [lane.at, along] : [along, lane.at];
      const s = 5;
      out.push({ p: rect(x - s, y - s, x + s, y + s), color: lane.dir === 1 ? head : tail, win: [QuadKind.GLOW, 0, 0, 0] });
    }
  });
  return out;
}

/** Full-screen fade to night at the edges (NeonBlade's `overlay`). */
export function vignetteQuad(width: number, height: number): Quad {
  return { p: rect(0, 0, width, height), color: parseColor(brand.night), win: [QuadKind.VIGNETTE, 0, 0, 0] };
}

/** Floats per quad when packed for the GPU: 4 corners, colour, win. */
export const QUAD_FLOATS = 16;

/** Pack quads into a Float32Array laid out like the shader's Quad struct. */
export function packQuads(quads: Quad[], out: Float32Array, offset = 0): void {
  quads.forEach((q, i) => {
    const o = (offset + i) * QUAD_FLOATS;
    out.set(q.p, o);
    out.set(q.color, o + 8);
    out.set(q.win, o + 12);
  });
}

export function districtDefaults(district: District) {
  const spec = SPECS[district];
  return {
    light: district === 'megacity' ? palette.carolina[300] : palette.orange[300],
    accent: district === 'harlem' ? palette.orange[400] : district === 'megacity' ? brand.carolina : brand.orange,
    litFraction: spec.litFraction,
  };
}

const hashCell = (x: number, y: number) => {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
};

/**
 * Lit window centres, for renderers without a per-pixel window shader (the
 * Skia fallback). Same lit test as the GPU shader at time zero. Facades are
 * sampled every `stride` cells and the total is capped, so a dense district
 * stays cheap to draw.
 */
export function litWindows(layout: CityLayout, maxPoints = 12000, stride = 2): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (const q of layout.quads) {
    const [cols, rows, seed, lit] = q.win;
    if (cols <= 0.5) continue;
    for (let row = 0; row < rows; row += stride) {
      for (let col = 0; col < cols; col += stride) {
        if (hashCell(col + seed, row) >= lit) continue;
        const u = (col + 0.5) / cols;
        const v = (row + 0.5) / rows;
        const [ax, ay, bx, by, cx, cy, dx, dy] = q.p;
        const topX = ax + (bx - ax) * u;
        const topY = ay + (by - ay) * u;
        const botX = dx + (cx - dx) * u;
        const botY = dy + (cy - dy) * u;
        points.push({ x: topX + (botX - topX) * v, y: topY + (botY - topY) * v });
        if (points.length >= maxPoints) return points;
      }
    }
  }
  return points;
}
