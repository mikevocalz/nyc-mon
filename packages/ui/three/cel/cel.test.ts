import assert from 'node:assert/strict';
import { test } from 'node:test';
import { d } from 'typegpu';
import {
  acosApprox, celBody, DSTS_DEFAULT_RIG, evalSH9, hemisphereSH, innerGrowA, INV_PI, rigAroundSun, SH_L0, SHADOW_FLOOR,
  toonBand, toonRampU,
} from './cel-shading.ts';

// The TypeGPU cel functions run on the CPU too, so the code the fragment
// shader uses is tested here directly.
const close = (a: number, b: number, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const ramp = d.vec4f(0.5, 0.68, 0.006, 0);
const bands = d.vec4f(0.12, 0.55, 1, 0);
const white = d.vec3f(1, 1, 1);
const zero = d.vec3f(0, 0, 0);

test('acosApprox tracks Math.acos across -1..1', () => {
  for (let x = -1; x <= 1.0001; x += 0.05) close(acosApprox(Math.min(1, x)), Math.acos(Math.min(1, x)), 2e-4);
});

test('the ramp coordinate is linear in the light angle: 0.005 away, 0.5 at the terminator, 0.995 facing', () => {
  close(toonRampU(-1), 0.005, 1e-3);
  close(toonRampU(0), 0.5, 1e-3);
  close(toonRampU(1), 0.995, 1e-3);
  close(toonRampU(Math.cos(Math.PI / 4)), 0.5 + 0.495 * 0.5, 1e-3);
});

test('the ramp stand-in gives three flat bands, stepping up toward the light', () => {
  const level = (ndotl: number) => toonBand(ndotl, ramp, bands, white).x;
  close(level(-0.6), 0.12);
  close(level(0.2), 0.55);
  close(level(0.9), 1);
  let last = -1;
  for (let x = -1; x <= 1; x += 0.01) {
    const v = level(x);
    assert.ok(v >= last - 1e-6, `not monotonic at ${x}`);
    last = v;
  }
  // The cool ramp is the neutral one times its tint.
  const cool = toonBand(0.9, ramp, bands, d.vec3f(0.8, 0.9, 1.1));
  close(cool.x, 0.8);
  close(cool.z, 1.1);
});

test('hemisphere SH lights the sky side with the sky and the ground side with the ground', () => {
  const sky = [0.6, 0.8, 1] as const;
  const ground = [0.3, 0.25, 0.2] as const;
  const sh = hemisphereSH(sky, ground, 0.2).map((c) => d.vec3f(...c));
  const at = (n: ReturnType<typeof d.vec3f>) => evalSH9(n, sh[0]!, sh[1]!, sh[2]!, sh[3]!, sh[4]!, sh[5]!, sh[6]!, sh[7]!, sh[8]!);
  const up = at(d.vec3f(0, 1, 0));
  const down = at(d.vec3f(0, -1, 0));
  for (let i = 0; i < 3; i++) {
    close(up[i]! * INV_PI, 0.2 * sky[i]!);
    close(down[i]! * INV_PI, 0.2 * ground[i]!);
  }
  // The studio rig's flat ambient: sh0 alone, the same from every side.
  const flat = at(d.vec3f(1, 0, 0));
  assert.ok(flat.x > 0);
  const rigFlat = evalSH9(d.vec3f(0.3, 0.9, 0.3), d.vec3f(0.55, 0.55, 0.55), zero, zero, zero, zero, zero, zero, zero, zero);
  close(rigFlat.y, SH_L0 * DSTS_DEFAULT_RIG.shL0);
});

test('rim glow: zero head-on, rising at the silhouette; mode 1 is effectively off', () => {
  const base = d.vec3f(6, 1, 0.5);
  close(innerGrowA(1, base), 0);
  close(innerGrowA(0.5, base), 0);
  assert.ok(innerGrowA(0.02, base) > 0.5);
  assert.ok(innerGrowA(0.05, base) < innerGrowA(0.01, base));
  assert.ok(innerGrowA(0.01, d.vec3f(1, 1, 1)) < 0.02);
});

test('the body: lit side over shadow side, shadow floor at half, rim only when on', () => {
  const light = (x: number, y: number, z: number) => d.vec4f(x, y, z, 0);
  const shade = (normal: ReturnType<typeof d.vec3f>, rimScale = 0, shadow = 1) => celBody(
    d.vec3f(0.5, 0.5, 0.5), normal, d.vec3f(0, 0, 10), d.vec3f(0.55 * SH_L0, 0.55 * SH_L0, 0.55 * SH_L0),
    d.vec4f(0, 1, 0, shadow), d.vec4f(1, 1, 1, 0), light(-1, 0.3, 0), d.vec4f(0.3, 0.3, 0.35, 0), light(0, -0.3, -1),
    d.vec4f(0.2, 0.2, 0.24, 0), ramp, bands, d.vec4f(0.9, 0.95, 1.05, 0), d.vec4f(0.2, 0.2, 0.2, rimScale), d.vec4f(6, 1, 0.5, 0),
    d.vec4f(0, 0, 0, 1),
  );
  const top = shade(d.vec3f(0, 1, 0));
  const bottom = shade(d.vec3f(0, -1, 0));
  assert.ok(top.x > bottom.x * 2, `${top.x} vs ${bottom.x}`);
  // Self-shadow slides the key to its shadow band, then the whole composite takes the floor.
  const shadowed = shade(d.vec3f(0, 1, 0), 0, 0);
  assert.ok(shadowed.x < top.x * SHADOW_FLOOR + 1e-6);
  // Grazing view: the rim adds only when its scale is on.
  const grazing = d.vec3f(0, 0.9995, 0.03);
  assert.ok(shade(grazing, 1).x > shade(grazing, 0).x);
  close(shade(d.vec3f(0, 0, 1), 1).x, shade(d.vec3f(0, 0, 1), 0).x);
});

test('the rig turns with the sun: key on the sun, fills keep elevation and spacing', () => {
  const sun = [-0.45, 0.78, 0.43] as const;
  const rig = rigAroundSun(sun);
  const l = Math.hypot(...sun);
  for (let i = 0; i < 3; i++) close(rig.key[i]!, sun[i]! / l);
  const elevation = (v: readonly number[]) => v[1]! / Math.hypot(v[0]!, v[1]!, v[2]!);
  const azimuth = (v: readonly number[]) => Math.atan2(v[2]!, v[0]!);
  close(elevation(rig.fill1), elevation(DSTS_DEFAULT_RIG.fill1.dir));
  close(elevation(rig.fill2), elevation(DSTS_DEFAULT_RIG.fill2.dir));
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  close(wrap(azimuth(rig.fill1) - azimuth(rig.key)), wrap(azimuth(DSTS_DEFAULT_RIG.fill1.dir) - azimuth(DSTS_DEFAULT_RIG.key.dir)));
});
