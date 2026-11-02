// The gen lane's emission: one cell's GenSpec to the vertex arrays the blocks reader streams
// (vd-port/blocks/codec.ts NearArrays — float32x3 position, RGBA8 colour + emission, index;
// the package adds the zero uv, same as sourceNearPackage). Pure — no three.js — so the same
// spec emits byte-identical arrays on every call and `node --test` covers the whole of it.
//
// Massing stays cheap on purpose: one box per lot, two past seven floors (the NYC setback —
// the upper share pulls in 18 % each side). 20 verts, 10 triangles a box; a full cell is a few
// hundred verts, far under the lite cells' 350 k preset row — which is the budget the gen row
// is sized against (perf/tier-presets.ts vdPort.gen).
//
// What the spec's facade params become in the arrays: the use picks the glow (homes dim, offices
// bright, parks none), the class picks the wall tone family (palette.ts WALL_TONES, the same
// table the record city rolls on), and the style id + salt pick the tone inside it. Emission
// follows the near encoding the blocks material reads (shell-material.ts): colour alpha is the
// day share lo / 4, emissive rgb is the linear glow / 4 sRGB-coded, emissive alpha the night
// share hi / 4 — uniform across a wall, so the gain sits low: a faint inhabited cast at dusk,
// not lit faces the record buildings do not have.
import { CITY_COLORS, WALL_TONES, hexToRgb } from '../palette.ts';
import type { NearArrays } from '../vd-port/blocks/codec.ts';
import { CELL } from '../cells/cell-rules.ts';
import type { GenLotSpec, GenSpec, GenUse } from './spec.ts';

/** Verts and triangles one massing box emits: 5 faces x 4 verts (no floor), two triangles each. */
export const GEN_VERTS_PER_BOX = 20;
export const GEN_TRIS_PER_BOX = 10;
/** Floors before the setback step (the upper box carries the rest). */
export const GEN_SETBACK_FLOORS = 7;
const SETBACK_INSET = 0.18;

/** Per-use emission: glow is the linear radiance peak of a wall, lo/hi the day/night shares. */
const USE_GLOW: Readonly<Record<GenUse, { gain: number; lo: number; hi: number }>> = {
  home: { gain: 0.22, lo: 0.05, hi: 0.7 },
  mixed: { gain: 0.3, lo: 0.08, hi: 0.75 },
  office: { gain: 0.35, lo: 0.1, hi: 0.8 },
  school: { gain: 0.15, lo: 0.04, hi: 0.5 },
  stadium: { gain: 0.08, lo: 0.02, hi: 0.4 },
  park: { gain: 0, lo: 0, hi: 0 },
};

/** sRGB encode, the inverse of the material's e.rgb decode (shell-material.ts). */
const srgbByte = (linear: number): number => {
  const x = Math.min(1, Math.max(0, linear));
  return Math.round((x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255);
};
const srgbToLinear = (byte01: number): number =>
  byte01 <= 0.04045 ? byte01 / 12.92 : Math.pow((byte01 + 0.055) / 1.055, 2.4);

/** One massing box: a footprint rect over a height range, with its facade params resolved. */
export interface GenBox {
  readonly x0: number; readonly z0: number; readonly x1: number; readonly z1: number;
  readonly y0: number; readonly y1: number;
  readonly use: GenUse;
  /** sRGB albedo 0..1, uniform over the walls (the roof takes CITY_COLORS.roof). */
  readonly tint: readonly [number, number, number];
  /** sRGB-coded emissive bytes (linear glow / 4) and the lo/hi share bytes, resolved per lot. */
  readonly glowRgb: readonly [number, number, number];
  readonly lo: number;
  readonly hi: number;
}

const TONE_INDEX_MOD = 7.13; // spreads salt over the tone list without reusing the style pick

function tintOf(lot: GenLotSpec): readonly [number, number, number] {
  const tones = WALL_TONES[lot.class];
  const tone = tones[(lot.styleId + Math.floor(lot.salt * TONE_INDEX_MOD)) % tones.length]!;
  const jitter = 0.94 + lot.salt2 * 0.12;
  const rgb = hexToRgb(CITY_COLORS[tone]);
  return [Math.min(1, rgb[0] * jitter), Math.min(1, rgb[1] * jitter), Math.min(1, rgb[2] * jitter)];
}

function glowOf(lot: GenLotSpec): { rgb: readonly [number, number, number]; lo: number; hi: number } {
  const g = USE_GLOW[lot.use];
  // windowWarm, linear, scaled to the use's gain, then the near encoding: / 4, sRGB coded.
  const warm = hexToRgb(CITY_COLORS.windowWarm).map((c) => srgbToLinear(c) * g.gain);
  return {
    rgb: [srgbByte(warm[0]! / 4), srgbByte(warm[1]! / 4), srgbByte(warm[2]! / 4)],
    lo: Math.round((g.lo / 4) * 255),
    hi: Math.round((g.hi / 4) * 255),
  };
}

/**
 * A spec's lots as massing boxes in scene metres, grounded by `groundY` at each lot centre.
 * `park` lots emit nothing. Deterministic in spec order — same spec and ground function,
 * same boxes.
 */
export function genCellBoxes(spec: GenSpec, groundY: (x: number, z: number) => number): GenBox[] {
  const boxes: GenBox[] = [];
  for (const lot of spec.lots) {
    if (lot.floors <= 0) continue;
    const [rx0, rz0, rx1, rz1] = lot.rect;
    const base = groundY((rx0 + rx1) / 2, (rz0 + rz1) / 2);
    const tint = tintOf(lot);
    const { rgb, lo, hi } = glowOf(lot);
    const lower = Math.min(lot.floors, GEN_SETBACK_FLOORS);
    const lowerTop = base + lower * lot.floorHeightMeters;
    boxes.push({ x0: rx0, z0: rz0, x1: rx1, z1: rz1, y0: base, y1: lowerTop, use: lot.use, tint, glowRgb: rgb, lo, hi });
    if (lot.floors > GEN_SETBACK_FLOORS) {
      const iw = (rx1 - rx0) * SETBACK_INSET, id = (rz1 - rz0) * SETBACK_INSET;
      boxes.push({
        x0: rx0 + iw, z0: rz0 + id, x1: rx1 - iw, z1: rz1 - id,
        y0: lowerTop, y1: lowerTop + (lot.floors - GEN_SETBACK_FLOORS) * lot.floorHeightMeters,
        use: lot.use, tint, glowRgb: rgb, lo, hi,
      });
    }
  }
  return boxes;
}

/**
 * The boxes' scene-space box, for the package's bounds (bounds are world space even on a
 * cell-local frame). Padded a millimetre: the arrays store f32 positions, and an f64 box over
 * the exact corners can leave a stored vertex a few ulps outside it — the contract is that
 * bounds cover the cell's triangles, which means the ones the GPU draws.
 */
export function genCellBounds(boxes: readonly GenBox[]): Float64Array {
  const P = 1e-3;
  const b = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for (const box of boxes) {
    if (box.x0 - P < b[0]!) b[0] = box.x0 - P;
    if (box.y0 - P < b[1]!) b[1] = box.y0 - P;
    if (box.z0 - P < b[2]!) b[2] = box.z0 - P;
    if (box.x1 + P > b[3]!) b[3] = box.x1 + P;
    if (box.y1 + P > b[4]!) b[4] = box.y1 + P;
    if (box.z1 + P > b[5]!) b[5] = box.z1 + P;
  }
  return b;
}

type Pt = readonly [number, number, number];

/**
 * The five faces of a box as quads, counter-clockwise seen from outside (the material keeps
 * FrontSide culling; the facet normal comes from derivatives). Scene coords on the faces —
 * the caller subtracts the cell frame's origin.
 */
const FACES: readonly (readonly [Pt, Pt, Pt, Pt])[] = [
  // +x
  [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
  // -x
  [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  // +z
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  // -z
  [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
  // +y
  [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
];

const ROOF = 4;

/**
 * The spec's boxes as the near layout's arrays, positions cell-local around the cell centre
 * (the CellPackage.positionFrame convention). u16 index — a gen cell stays under ~1 k verts.
 */
export function emitGenCell(spec: GenSpec, boxes: readonly GenBox[]): NearArrays {
  const ox = spec.cx * CELL + CELL / 2;
  const oz = spec.cz * CELL + CELL / 2;
  const n = boxes.length * GEN_VERTS_PER_BOX;
  const position = new Float32Array(n * 3);
  const color = new Uint8Array(n * 4);
  const emissive = new Uint8Array(n * 4);
  const index = new Uint16Array(boxes.length * GEN_TRIS_PER_BOX * 3);
  const roofRgb = hexToRgb(CITY_COLORS.roof);
  let v = 0, it = 0;
  const corner = (b: GenBox, f: readonly [number, number, number]): Pt => [
    f[0] === 0 ? b.x0 : b.x1, f[1] === 0 ? b.y0 : b.y1, f[2] === 0 ? b.z0 : b.z1,
  ];
  for (const b of boxes) {
    for (let f = 0; f < FACES.length; f++) {
      const quad = FACES[f]!;
      const isRoof = f === ROOF;
      const rgb = isRoof ? roofRgb : b.tint;
      const [cr, cg, cb] = [Math.round(rgb[0] * 255), Math.round(rgb[1] * 255), Math.round(rgb[2] * 255)];
      const er = isRoof ? 0 : b.glowRgb[0], eg = isRoof ? 0 : b.glowRgb[1], eb = isRoof ? 0 : b.glowRgb[2];
      const ea = isRoof ? 0 : b.hi;
      for (const cv of quad) {
        const p = corner(b, cv);
        position[v * 3] = p[0] - ox;
        position[v * 3 + 1] = p[1];
        position[v * 3 + 2] = p[2] - oz;
        color[v * 4] = cr;
        color[v * 4 + 1] = cg;
        color[v * 4 + 2] = cb;
        color[v * 4 + 3] = b.lo;
        emissive[v * 4] = er;
        emissive[v * 4 + 1] = eg;
        emissive[v * 4 + 2] = eb;
        emissive[v * 4 + 3] = ea;
        v++;
      }
      index[it++] = v - 4;
      index[it++] = v - 3;
      index[it++] = v - 2;
      index[it++] = v - 4;
      index[it++] = v - 2;
      index[it++] = v - 1;
    }
  }
  return { position, color, emissive, index };
}
