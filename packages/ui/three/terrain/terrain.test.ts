import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brand } from '@acme/theme';
import { d } from 'typegpu';
import { cursorWeight, terrainHeight, waveHeight } from './height.ts';
import {
  cameraPosition, fogFactor, TERRAIN_COLORS, TERRAIN_DEFAULTS, terrainOpacity, terrainSegments,
} from './terrain-config.ts';

// The TypeGPU height functions run on the CPU too, so the code the vertex
// shader runs is tested here directly, against NeonBlade's shader written out
// in plain JS.
const neonblade = (x: number, z: number, t: number, a = 0.8, f = 1.5) =>
  a * Math.sin(f * x * 0.35 + t) +
  a * 0.6 * Math.sin(f * z * 0.35 + t * 0.73) +
  a * 0.35 * Math.sin(f * (x + z) * 0.2 + t * 1.31) +
  a * 0.2 * Math.sin(f * (x - z) * 0.18 + t * 0.97);

const wave = (t: number, a = 0.8, f = 1.5) => d.vec4f(a, f, t, 0);
const off = d.vec4f(0, 0, 0, 0);
const bump = d.vec2f(3.5, 2.5);

test("height matches NeonBlade's four sines", () => {
  for (const t of [0, 0.7, 3.2, 41.5]) {
    for (let x = -12; x <= 12; x += 1.5) {
      for (let z = -12; z <= 12; z += 2) {
        const h = terrainHeight(d.vec2f(x, z), wave(t), off, bump);
        assert.ok(Math.abs(h - neonblade(x, z, t)) < 1e-4, `(${x}, ${z}, ${t}): ${h} vs ${neonblade(x, z, t)}`);
      }
    }
  }
});

test('amplitude and frequency scale the waves', () => {
  const p = d.vec2f(3, -5);
  assert.ok(Math.abs(waveHeight(p, wave(1.1, 1.6)) - 2 * waveHeight(p, wave(1.1, 0.8))) < 1e-4);
  assert.ok(Math.abs(waveHeight(p, wave(1.1, 0.8, 3)) - neonblade(3, -5, 1.1, 0.8, 3)) < 1e-4);
  assert.equal(waveHeight(p, wave(2, 0)), 0);
  // Peaks stay inside the summed amplitudes.
  for (let x = -12; x <= 12; x++) assert.ok(Math.abs(waveHeight(d.vec2f(x, x * 0.7), wave(x))) <= 0.8 * 2.15 + 1e-4);
});

test('the waves move with time', () => {
  const p = d.vec2f(1, 2);
  assert.notEqual(waveHeight(p, wave(0)), waveHeight(p, wave(0.5)));
});

test('the cursor adds a gaussian bump of bumpStrength at its centre', () => {
  const at = d.vec2f(2, -3);
  const on = d.vec4f(2, -3, 1, 0);
  const lift = terrainHeight(at, wave(1), on, bump) - terrainHeight(at, wave(1), off, bump);
  assert.ok(Math.abs(lift - 2.5) < 1e-4, `lift ${lift}`);
  // One radius out it falls to strength / e.
  const edge = d.vec2f(2 + 3.5, -3);
  const edgeLift = terrainHeight(edge, wave(1), on, bump) - terrainHeight(edge, wave(1), off, bump);
  assert.ok(Math.abs(edgeLift - 2.5 / Math.E) < 1e-4, `edge ${edgeLift}`);
  // Far away it is gone.
  const far = d.vec2f(20, 20);
  assert.ok(terrainHeight(far, wave(1), on, bump) - terrainHeight(far, wave(1), off, bump) < 1e-6);
});

test('the bump scales with how far the cursor is on, and a zero radius stays finite', () => {
  assert.equal(cursorWeight(d.vec2f(0, 0), d.vec4f(0, 0, 0, 0), 3.5), 0);
  assert.ok(Math.abs(cursorWeight(d.vec2f(0, 0), d.vec4f(0, 0, 0.4, 0), 3.5) - 0.4) < 1e-6);
  assert.equal(cursorWeight(d.vec2f(0, 0), d.vec4f(0, 0, 1, 0), 3.5), 1);
  // Overshoot from easing never pushes it past full.
  assert.equal(cursorWeight(d.vec2f(0, 0), d.vec4f(0, 0, 1.2, 0), 3.5), 1);
  assert.ok(Number.isFinite(terrainHeight(d.vec2f(1, 1), wave(0), d.vec4f(0, 0, 1, 0), d.vec2f(0, 2.5))));
});

test("defaults: NeonBlade's numbers, the theme's colours", () => {
  assert.deepEqual(
    { ...TERRAIN_DEFAULTS },
    {
      waveAmplitude: 0.8, waveFrequency: 1.5, waveSpeed: 1, bumpRadius: 3.5, bumpStrength: 2.5, planeWidth: 24, planeDepth: 24,
      cameraHeight: 10, gridSegments: 60, fog: true, opacity: 100,
    },
  );
  assert.equal(TERRAIN_COLORS.bgColor, brand.night);
  assert.equal(TERRAIN_COLORS.lineColor, brand.carolina);
  assert.equal(TERRAIN_COLORS.accentColor, brand.orange);
});

test('segments clamp to 8..200, camera keeps the 1.4 tilt, opacity takes 0..100 or 0..1', () => {
  assert.equal(terrainSegments(2), 8);
  assert.equal(terrainSegments(60), 60);
  assert.equal(terrainSegments(900), 200);
  assert.deepEqual(cameraPosition(10), [0, 10, 14]);
  assert.equal(terrainOpacity(100), 1);
  assert.equal(terrainOpacity(50), 0.5);
  assert.equal(terrainOpacity(0.5), 0.5);
  assert.equal(terrainOpacity(-3), 0);
});

test('fog: clear near the camera, nearly opaque past the far edge', () => {
  assert.equal(fogFactor(0), 0);
  assert.ok(fogFactor(17) < 0.5);
  assert.ok(fogFactor(45) > 0.95);
});
