import type { d } from 'typegpu';
import { std } from 'typegpu';

/**
 * NeonBlade's Holographic Terrain vertex shader, line for line, split in two
 * so the fragment stage can reuse the cursor weight for the accent tint.
 *
 * Inputs are packed so the shader reads three uniforms:
 * - `wave`: amplitude, frequency, time (seconds x waveSpeed), unused.
 * - `cursor`: world x, world z, on (0..1, scales the bump in and out), unused.
 * - `bump`: radius, strength (world units).
 *
 * Written once as TypeGPU functions: three.js runs them in the vertex shader
 * through @typegpu/three (WGSL on WebGPU, GLSL on the WebGL2 backend), and
 * the unit tests call the same functions on the CPU.
 */

/** The four overlapping sines, with NeonBlade's coefficients. */
export const waveHeight = (p: d.v2f, wave: d.v4f): number => {
  'use gpu';
  const x = p.x;
  const z = p.y;
  const a = wave.x;
  const f = wave.y;
  const t = wave.z;
  return (
    a * std.sin(f * x * 0.35 + t) +
    a * 0.6 * std.sin(f * z * 0.35 + t * 0.73) +
    a * 0.35 * std.sin(f * (x + z) * 0.2 + t * 1.31) +
    a * 0.2 * std.sin(f * (x - z) * 0.18 + t * 0.97)
  );
};

/**
 * The gaussian under the cursor, 0..1, scaled by how far the cursor is on.
 * NeonBlade switches it on and off in one step; here `on` eases, so the bump
 * grows and fades.
 */
export const cursorWeight = (p: d.v2f, cursor: d.v4f, radius: number): number => {
  'use gpu';
  const dx = p.x - cursor.x;
  const dz = p.y - cursor.y;
  // NeonBlade divides by radius squared as is; the floor only keeps a zero
  // radius from turning the mesh into NaNs.
  const r2 = std.max(radius * radius, 0.0001);
  return std.exp(-(dx * dx + dz * dz) / r2) * std.saturate(cursor.z);
};

/** Terrain height at world (x, z): the sines plus the cursor bump. */
export const terrainHeight = (p: d.v2f, wave: d.v4f, cursor: d.v4f, bump: d.v2f): number => {
  'use gpu';
  return waveHeight(p, wave) + bump.y * cursorWeight(p, cursor, bump.x);
};
