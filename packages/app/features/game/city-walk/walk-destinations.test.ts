import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { INITIAL_CITY_CAMERA } from '../city-camera.ts';
import type { StorefrontPlan } from '../world/vd-port/storefronts/plan-types.ts';
import {
  landmarkLabels,
  nearestDestination,
  pickOverlayLabels,
  signLabels,
  walkCameraBounds,
  walkDestinations,
} from './walk-destinations.ts';

const origin = JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')).origin as [number, number];
const destinations = walkDestinations(origin);
const bounds = walkCameraBounds(origin);

test('the Go to list starts at the Apollo and carries the bake’s named landmarks', () => {
  assert.equal(destinations[0]!.key, 'start');
  assert.deepEqual(
    { x: destinations[0]!.x, z: destinations[0]!.z, distance: destinations[0]!.distance },
    { x: INITIAL_CITY_CAMERA.x, z: INITIAL_CITY_CAMERA.z, distance: INITIAL_CITY_CAMERA.distance },
  );
  const names = destinations.map((d) => d.name);
  for (const n of ['Empire State Building', 'Apollo Theater', 'BROOKLYN BRG', 'Statue of Liberty, pedestal and Fort Wood']) {
    assert.ok(names.includes(n), n);
  }
  assert.ok(destinations.length > 50);
});

test('the walk bounds cover the start, every destination and nothing wild', () => {
  assert.ok(INITIAL_CITY_CAMERA.x > bounds.minX && INITIAL_CITY_CAMERA.x < bounds.maxX);
  assert.ok(INITIAL_CITY_CAMERA.z > bounds.minZ && INITIAL_CITY_CAMERA.z < bounds.maxZ);
  for (const d of destinations) {
    assert.ok(d.x >= bounds.minX && d.x <= bounds.maxX, `${d.name} x ${d.x}`);
    assert.ok(d.z >= bounds.minZ && d.z <= bounds.maxZ, `${d.name} z ${d.z}`);
  }
  // Staten Island is in (Verrazzano ~22.5 km south), the empty tile corners stay out.
  assert.ok(bounds.maxZ > 20_000, `maxZ ${bounds.maxZ}`);
  assert.ok(bounds.maxZ < 40_000, `maxZ ${bounds.maxZ}`);
});

test('nearestDestination finds the Apollo by the start', () => {
  const near = nearestDestination(INITIAL_CITY_CAMERA.x, INITIAL_CITY_CAMERA.z, destinations)!;
  assert.equal(near.destination.name, 'Apollo Theater');
  assert.ok(near.meters < 60);
});

const PLAN: StorefrontPlan = {
  fronts: [
    {
      src: 0, id: 'a#1', addr: '', p0: [100, 200], u: [1, 0], n: [0, -1], len: 20, k: 1, vp0: [0, 0], vu: [1, 0],
      bays: [], awnings: [],
      signs: [
        { text: 'APOLLO', u0: 4, u1: 12, y: 3, h: 1, z: 0.5, kind: 'lit', lit: 1, fg: null, bg: null, slot: 0 },
        { text: 'APOLLO', u0: 5, u1: 13, y: 3, h: 1, z: 0.5, kind: 'lit', lit: 1, fg: null, bg: null, slot: 0 },
      ],
    },
    {
      src: 2, id: 'b#1', addr: '', p0: [0, 0], u: [1, 0], n: [0, -1], len: 20, k: 1, vp0: [0, 0], vu: [1, 0],
      bays: [], awnings: [],
      signs: [{ text: 'INVENTED NAME', u0: 0, u1: 10, y: 3, h: 1, z: 0, kind: 'kit', lit: 0, fg: null, bg: null, slot: 0 }],
    },
  ],
  atlas: { width: 1, height: 1, cellW: 1, cellH: 1, cols: 1, count: 1 },
  slots: ['x'],
};

test('signLabels keeps recorded signs, skips invented kit names and dedupes a spot', () => {
  const labels = signLabels(PLAN);
  assert.equal(labels.length, 1, JSON.stringify(labels));
  const apollo = labels[0]!;
  assert.equal(apollo.text, 'APOLLO');
  assert.ok(Math.abs(apollo.x - (100 + 8)) < 1e-6 && Math.abs(apollo.z - (200 - 0.5)) < 1e-6);
  assert.equal(signLabels(null).length, 0);
});

test('pickOverlayLabels shows landmarks far out and signs only close in', () => {
  const landmarks = landmarkLabels(origin);
  const signs = [{ key: 's1', text: 'NEARBY', kind: 'sign' as const, x: INITIAL_CITY_CAMERA.x + 20, y: 8, z: INITIAL_CITY_CAMERA.z }];
  const streets = [{ key: 'st1', text: 'W 125 ST', kind: 'street' as const, x: INITIAL_CITY_CAMERA.x, y: 2, z: INITIAL_CITY_CAMERA.z + 10, angle: 0 }];
  const vp = { width: 800, height: 600 };
  const close = pickOverlayLabels({ ...INITIAL_CITY_CAMERA }, vp, { landmarks, signs, streets });
  assert.ok(close.some((p) => p.key === 's1'), 'a sign 20 m away shows at overview distance');
  assert.ok(close.some((p) => p.key === 'st1'), 'the street under the camera shows');
  const st = close.find((p) => p.key === 'st1')!;
  assert.equal(typeof st.angle, 'number', 'a street label carries its screen angle');
  const far = pickOverlayLabels({ ...INITIAL_CITY_CAMERA, distance: 3000 }, vp, { landmarks, signs, streets });
  assert.ok(!far.some((p) => p.key === 's1' || p.key === 'st1'), 'near detail hides at skyline distance');
  assert.ok(far.some((p) => p.kind === 'landmark'), 'landmarks still read at skyline distance');
});
