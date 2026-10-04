import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brand } from '@acme/theme';
import { d } from 'typegpu';
import { tideWave } from './wave.ts';
import { directionFromOrigin, heightNorm, TIDE_DEFAULT_COLORS, tideSegments, type NeonTideOrigin } from './tide-config.ts';

// The TypeGPU wave runs on the CPU too, so the code the vertex shader uses is tested here directly.
const flowFor = (origin: NeonTideOrigin) => {
  const [dx, dz] = directionFromOrigin(origin);
  return d.vec4f(dx, dz, -dz, dx);
};
const wave = (t = 0, active = 0, amplitude = 1.2, frequency = 0.55) => d.vec4f(amplitude, frequency, t, active);
const hover = (x = 0, z = 0) => d.vec4f(x, z, 4, 1.4);
const at = (x: number, z: number, t = 0, origin: NeonTideOrigin = 'top-right', active = 0) =>
  tideWave(d.vec2f(x, z), flowFor(origin), wave(t, active), hover());

test('height stays within the summed amplitudes', () => {
  const bound = 1.2 * (1 + 0.45 + 0.3) + 1e-4;
  for (let x = -17; x <= 17; x += 1.7) {
    for (let z = -17; z <= 17; z += 1.7) {
      const h = at(x, z, 2.3).x;
      assert.ok(Math.abs(h) <= bound, `height ${h} out of range`);
    }
  }
});

test('the analytic gradient matches finite differences', () => {
  const e = 1e-3;
  for (const [x, z] of [[0, 0], [3.2, -5.1], [-7.4, 9.9], [12, 4]] as const) {
    for (const active of [0, 1]) {
      const w = at(x, z, 1.7, 'bottom-left', active);
      const hx = (at(x + e, z, 1.7, 'bottom-left', active).x - at(x - e, z, 1.7, 'bottom-left', active).x) / (2 * e);
      const hz = (at(x, z + e, 1.7, 'bottom-left', active).x - at(x, z - e, 1.7, 'bottom-left', active).x) / (2 * e);
      assert.ok(Math.abs(w.y - hx) < 2e-3, `dh/dx ${w.y} vs ${hx}`);
      assert.ok(Math.abs(w.z - hz) < 2e-3, `dh/dz ${w.z} vs ${hz}`);
    }
  }
});

test('waves travel away from the origin corner', () => {
  // The leading wave's phase is dot(xz, dir) * f - t: a crest at time t sits further along dir at a later time.
  const dir = directionFromOrigin('top-right');
  const f = 0.55;
  const s = (Math.PI / 2) / f; // distance along dir of the first crest at t = 0
  const crestAt = (t: number) => {
    let best = -Infinity;
    let where = 0;
    for (let k = s - 3; k <= s + 6; k += 0.01) {
      const h = tideWave(d.vec2f(dir[0] * k, dir[1] * k), flowFor('top-right'), d.vec4f(1, f, t, 0), hover()).x;
      if (h > best) { best = h; where = k; }
    }
    return where;
  };
  assert.ok(crestAt(1) > crestAt(0));
});

test('the pointer bump raises the surface under it and only when active', () => {
  const bumpHover = d.vec4f(2, -3, 4, 1.4);
  const still = tideWave(d.vec2f(2, -3), flowFor('top-left'), wave(0.5, 0), bumpHover).x;
  const lifted = tideWave(d.vec2f(2, -3), flowFor('top-left'), wave(0.5, 1), bumpHover).x;
  assert.ok(Math.abs(lifted - still - 1.4) < 1e-4, `bump ${lifted - still}`);
  const far = tideWave(d.vec2f(30, 30), flowFor('top-left'), wave(0.5, 1), bumpHover).x;
  const farStill = tideWave(d.vec2f(30, 30), flowFor('top-left'), wave(0.5, 0), bumpHover).x;
  assert.ok(Math.abs(far - farStill) < 1e-6);
});

test('directions point from the origin corner to the opposite one', () => {
  assert.deepEqual(directionFromOrigin('top-right').map(Math.sign), [-1, 1]);
  assert.deepEqual(directionFromOrigin('bottom-left').map(Math.sign), [1, -1]);
  for (const o of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
    const [x, z] = directionFromOrigin(o);
    assert.ok(Math.abs(Math.hypot(x, z) - 1) < 1e-9);
  }
});

test('segments clamp to 8..220; height ramp in 0..1', () => {
  assert.equal(tideSegments(2), 8);
  assert.equal(tideSegments(500), 220);
  assert.equal(tideSegments(120), 120);
  assert.equal(heightNorm(0, 1.2), 0.5);
  assert.equal(heightNorm(100, 1.2), 1);
  assert.equal(heightNorm(-100, 1.2), 0);
});

test('default colours are theme tokens', () => {
  assert.equal(TIDE_DEFAULT_COLORS.colorA, brand.royal);
  assert.equal(TIDE_DEFAULT_COLORS.colorB, brand.carolina);
  assert.equal(TIDE_DEFAULT_COLORS.glossColor, brand.orange);
  assert.equal(TIDE_DEFAULT_COLORS.bgColor, brand.night);
});
