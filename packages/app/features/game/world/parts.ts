// Small solid parts written straight into a VertexBuffer: boxes, upright
// cylinders and cones in a local frame (x along a facade or kerb, y up, z out
// toward the street). Stoops, fire escapes, water towers, hydrants and the
// rest are built from these and merged per material, so they cost triangles
// but no draw calls. Pure: no three import.
import { VertexBuffer } from './geometry.ts';

type Rgb = readonly number[];

/**
 * Uv for detail merged into the facade material: v below zero sits under the
 * window and shopfront bands, so the facade shader shows the plain wall colour.
 */
export const PLAIN_UV = -10;

/** Origin on the ground and the unit direction local +z points to (out of the wall, or toward the road). */
export interface Frame { x: number; y: number; z: number; ox: number; oz: number }

export function frame(x: number, z: number, out: readonly [number, number], y = 0): Frame {
  return { x, y, z, ox: out[0], oz: out[1] };
}

/** Local (along, up, out) to scene. Local x is (oz, -ox) so that x, y, z stay right-handed. */
function toScene(f: Frame, lx: number, ly: number, lz: number): [number, number, number] {
  return [f.x + f.oz * lx + f.ox * lz, f.y + ly, f.z - f.ox * lx + f.oz * lz];
}
function dirToScene(f: Frame, lx: number, ly: number, lz: number): [number, number, number] {
  return [f.oz * lx + f.ox * lz, ly, -f.ox * lx + f.oz * lz];
}

export interface BoxOptions {
  /** Rotation about local z (out), radians: tilts a ladder in the facade plane. */
  roll?: number;
  /** Faces to leave out (hidden against a wall or the ground). */
  skip?: readonly ('bottom' | 'top' | 'back' | 'front' | 'left' | 'right')[];
  uvV?: number;
}

/** An axis-aligned box in the frame, from local min to max corner. */
export function box(buffer: VertexBuffer, f: Frame, min: readonly [number, number, number], max: readonly [number, number, number], color: Rgb, options: BoxOptions = {}): void {
  const roll = options.roll ?? 0;
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  // The eight corners once, rolled about the box centre then placed in the frame; index bit 0 = x, 1 = y, 2 = z.
  const corners: [number, number, number][] = [];
  for (let k = 0; k < 8; k++) {
    const dx = (k & 1 ? max[0] : min[0]) - cx;
    const dy = (k & 2 ? max[1] : min[1]) - cy;
    const lz = k & 4 ? max[2] : min[2];
    corners.push(toScene(f, cx + dx * c - dy * s, cy + dx * s + dy * c, lz));
  }
  const N = (x: number, y: number, z: number) => dirToScene(f, x * c - y * s, x * s + y * c, z);
  const skip = options.skip;
  const v = options.uvV ?? PLAIN_UV;
  const uv = [[0, v], [0, v], [0, v], [0, v]] as const;
  const C = corners;
  // Each face counter-clockwise seen from outside.
  if (!skip?.includes('front')) buffer.quad(C[4]!, C[5]!, C[7]!, C[6]!, N(0, 0, 1), color, uv);
  if (!skip?.includes('back')) buffer.quad(C[1]!, C[0]!, C[2]!, C[3]!, N(0, 0, -1), color, uv);
  if (!skip?.includes('right')) buffer.quad(C[5]!, C[1]!, C[3]!, C[7]!, N(1, 0, 0), color, uv);
  if (!skip?.includes('left')) buffer.quad(C[0]!, C[4]!, C[6]!, C[2]!, N(-1, 0, 0), color, uv);
  if (!skip?.includes('top')) buffer.quad(C[6]!, C[7]!, C[3]!, C[2]!, N(0, 1, 0), color, uv);
  if (!skip?.includes('bottom')) buffer.quad(C[0]!, C[1]!, C[5]!, C[4]!, N(0, -1, 0), color, uv);
}

/** An upright open cylinder (no caps) of `segments` sides, centred on local (x, z). */
export function cylinder(buffer: VertexBuffer, f: Frame, x: number, z: number, radius: number, y0: number, y1: number, segments: number, color: Rgb, uvV = PLAIN_UV): void {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p = (a: number, y: number) => toScene(f, x + Math.cos(a) * radius, y, z + Math.sin(a) * radius);
    const am = (a0 + a1) / 2;
    // Counter-clockwise from outside with x = cos, z = sin: the angle has to fall as we go right.
    buffer.quad(p(a1, y0), p(a0, y0), p(a0, y1), p(a1, y1), dirToScene(f, Math.cos(am), 0, Math.sin(am)), color, [[0, uvV], [0, uvV], [0, uvV], [0, uvV]]);
  }
}

/** A cone (or a flat cap when `apex` equals `base`) over local (x, z). */
export function cone(buffer: VertexBuffer, f: Frame, x: number, z: number, radius: number, base: number, apex: number, segments: number, color: Rgb, uvV = PLAIN_UV): void {
  const top = toScene(f, x, apex, z);
  const slope = Math.atan2(radius, Math.max(apex - base, 1e-6));
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const p0 = toScene(f, x + Math.cos(a0) * radius, base, z + Math.sin(a0) * radius);
    const p1 = toScene(f, x + Math.cos(a1) * radius, base, z + Math.sin(a1) * radius);
    const n = dirToScene(f, Math.cos(am) * Math.cos(slope), Math.sin(slope), Math.sin(am) * Math.cos(slope));
    for (const p of [p1, p0, top]) buffer.vertex(p[0], p[1], p[2], n[0], n[1], n[2], color, 0, uvV);
  }
}

/**
 * A vertex buffer written in z bands (buildings and props sorted by band
 * first), so one draw range can show only the bands near the Caller.
 */
export class BandedBuffer {
  readonly buffer = new VertexBuffer(65_536);
  private readonly starts: number[] = [];

  /** Call before writing anything of `band`; bands must arrive in ascending order. */
  mark(band: number): void {
    while (this.starts.length <= band) this.starts.push(this.buffer.vertexCount);
  }

  /** Close the last band; `bandCount` is the total. */
  finish(bandCount: number): Int32Array {
    this.mark(bandCount);
    return Int32Array.from(this.starts);
  }
}
