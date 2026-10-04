import { d, std } from 'typegpu';

/** Floors per block of height. Heights snap to whole floors, so roofs stay flat and blocks step. */
export const FLOORS_PER_BLOCK = 4;

/**
 * Packed inputs, four floats each, so the shader reads four uniforms instead
 * of fourteen:
 * - `wave`: amplitude, frequency, wave time, scroll (rows travelled).
 * - `profile`: base, peak, centre ridge, slab boost (the district's shape).
 * - `cursor`: x, z (block units, local frame), active 0..1, mode (0 lift, 1 ripple).
 * - `bump`: radius, strength (both in blocks), clock (seconds), unused.
 */
export interface TerrainInputs {
  wave: d.v4f;
  profile: d.v4f;
  cursor: d.v4f;
  bump: d.v4f;
}

/** A stable 0..1 value per block. Same formula on the GPU and in tests. */
export const blockHash = (x: number, z: number): number => {
  'use gpu';
  return std.fract(std.sin(x * 127.1 + z * 311.7) * 43758.5453);
};

/**
 * Height of the block whose centre sits at `cell` (x across, z along the
 * terrain, both in blocks), quantised to floors.
 *
 * NeonBlade's Holographic Terrain sums four sines into a smooth swell. Here
 * the same four sines set each block's height, a per-block jitter breaks the
 * swell into individual buildings, and the result snaps to whole floors, so
 * the terrain reads as a city of flat-roofed blocks instead of hills. The
 * pointer lifts (or ripples) the blocks under it before the snap, so the lift
 * steps by floors too.
 *
 * Written once as a TypeGPU function: three.js runs it in the vertex shader
 * through @typegpu/three (WGSL on WebGPU, GLSL on the WebGL2 backend), and
 * the unit tests call the same function on the CPU.
 */
export const terrainHeight = (cell: d.v2f, wave: d.v4f, profile: d.v4f, cursor: d.v4f, bump: d.v4f): number => {
  'use gpu';
  const x = cell.x;
  const z = cell.y;
  const amplitude = wave.x;
  const f = wave.y * 0.3;
  const t = wave.z;
  // NeonBlade's four overlapping sines, normalised to 0..1.
  const sines =
    std.sin(f * x + t) +
    0.6 * std.sin(f * z + t * 0.73) +
    0.35 * std.sin(f * (x + z) * 0.6 + t * 1.31) +
    0.2 * std.sin(f * (x - z) * 0.5 + t * 0.97);
  const swell = 0.5 + sines / 4.3;
  const jitter = blockHash(x, z) - 0.5;
  const ridge = std.exp(-(x * x) / 60) * profile.z;
  let h = profile.x + (swell + jitter * 0.7) * profile.y * amplitude + ridge;
  // Slabs: the odd tall plain block standing over the rows (Harlem projects,
  // Mega City stacks). profile.w is the boost; 0 turns them off.
  h = h + std.select(d.f32(0), profile.w, blockHash(z * 1.7 + 3, x * 0.9 - 5) < 0.08);

  // Pointer: a gaussian lift, or a ring rippling out from the pointer.
  const dx = x - cursor.x;
  const dz = z + wave.w - cursor.y;
  const d2 = dx * dx + dz * dz;
  const r2 = std.max(bump.x * bump.x, 0.25);
  const lift = std.exp(-d2 / r2);
  const ring = std.exp(-d2 / (r2 * 2)) * (0.5 + 0.5 * std.sin(std.sqrt(d2) * 1.8 - bump.z * 5));
  h = h + bump.y * cursor.z * std.mix(lift, ring, cursor.w);

  return std.max(d.f32(1), std.round(h * FLOORS_PER_BLOCK)) / FLOORS_PER_BLOCK;
};

/**
 * Where block row `row` currently sits as the city scrolls toward the
 * camera, and which terrain row it shows. Rows wrap: a block leaving at the
 * near edge comes back at the far edge as a new block further down the
 * terrain. Returns (local z in 0..rows, terrain z).
 */
export const scrolledRow = (row: number, scroll: number, rows: number): d.v2f => {
  'use gpu';
  const travelled = row + scroll;
  const local = travelled - std.floor(travelled / rows) * rows;
  return d.vec2f(local, local - scroll);
};
