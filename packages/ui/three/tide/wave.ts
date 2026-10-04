import { d, std } from 'typegpu';

/**
 * Packed inputs, four floats each:
 * - `flow`: travel direction (x, z) and its perpendicular (x, z), unit vectors.
 * - `wave`: amplitude, frequency, wave time, hover active (0 or 1).
 * - `hover`: pointer x, z (mesh-local), radius, strength (world units).
 */
export interface TideInputs {
  flow: d.v4f;
  wave: d.v4f;
  hover: d.v4f;
}

/**
 * Height of the tide at mesh-local `xz` and its analytic gradient, as
 * (height, dh/dx, dh/dz, 0).
 *
 * NeonBlade's Neon Tide: a travelling wave along the flow direction, a
 * faster diagonal chop and a slower cross-swell, plus a gaussian bump under
 * the pointer. The gradient gives the surface normal without neighbours.
 *
 * Written once as a TypeGPU function: three.js runs it in the vertex shader
 * through @typegpu/three (WGSL on WebGPU, GLSL on the WebGL2 backend), and
 * the unit tests call the same function on the CPU.
 */
export const tideWave = (xz: d.v2f, flow: d.v4f, wave: d.v4f, hover: d.v4f): d.v4f => {
  'use gpu';
  const amplitude = wave.x;
  const f1 = wave.y;
  const t = wave.z;
  const d1 = xz.x * flow.x + xz.y * flow.y;
  const d2 = xz.x * flow.z + xz.y * flow.w;

  const f2 = f1 * 1.9;
  const f3 = f1 * 0.55;
  const p1 = d1 * f1 - t;
  const p2 = (d1 * 0.6 + d2 * 0.35) * f2 - t * 1.6;
  const p3 = d2 * f3 - t * 0.5;

  const c1 = amplitude * std.cos(p1) * f1;
  const c2 = amplitude * 0.45 * std.cos(p2) * f2;
  const c3 = amplitude * 0.3 * std.cos(p3) * f3;
  const gd1 = c1 + c2 * 0.6;
  const gd2 = c2 * 0.35 + c3;
  let gx = flow.x * gd1 + flow.z * gd2;
  let gz = flow.y * gd1 + flow.w * gd2;
  let h = amplitude * std.sin(p1) + amplitude * 0.45 * std.sin(p2) + amplitude * 0.3 * std.sin(p3);

  // The pointer: a gaussian bump, on only while the pointer is over the surface.
  const dx = xz.x - hover.x;
  const dz = xz.y - hover.y;
  const r2 = std.max(hover.z * hover.z, 0.0001);
  const on = std.select(d.f32(0), d.f32(1), wave.w > 0.5);
  const bump = hover.w * std.exp(-(dx * dx + dz * dz) / r2) * on;
  h = h + bump;
  gx = gx + (-2 / r2) * dx * bump;
  gz = gz + (-2 / r2) * dz * bump;

  return d.vec4f(h, gx, gz, 0);
};
