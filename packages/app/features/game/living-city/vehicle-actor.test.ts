import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorldAssetRegistry } from './asset-registry.ts';
import { SEED_ASSETS } from './seed-assets.ts';
import {
  EXPERIMENTAL_LIVING_CITY,
  boxCarGeometryData,
  livingCityFactoriesFor,
  resolveVehicleEntry,
  vehiclePaint,
  vehiclePaintIndex,
} from './vehicle-actor.ts';
import {
  VSNAP_HEADER,
  VSNAP_STRIDE,
  interpolateVehiclePose,
} from './vehicle-sim.ts';
import type { SceneActorFactory } from '../scene-actor.ts';

// --- Mesh recipe -----------------------------------------------------------------------

test('box-car recipe: a bounded triangle count and ground-pivot geometry', () => {
  const data = boxCarGeometryData({ lengthM: 4.6, widthM: 1.9, heightM: 1.5 });
  // Six boxes: body + cabin + four wheels.
  assert.equal(data.triangles, 72);
  assert.equal(data.positions.length / 3, 24 * 6);
  assert.equal(data.normals.length, data.positions.length);
  assert.ok(Math.max(...data.indices) < data.positions.length / 3, 'indices in range');
  // Pivot at ground-centre: y min is the wheel bottoms, near 0.
  const ys = data.positions.filter((_, i) => i % 3 === 1);
  assert.ok(Math.min(...ys) >= -0.001 && Math.min(...ys) < 0.05, 'wheels touch y=0');
  const zs = data.positions.filter((_, i) => i % 3 === 2);
  assert.ok(Math.max(...zs) <= 4.6 / 2 + 0.01, 'length bounds honoured');
});

test('resolveVehicleEntry lands on a buildable proc recipe today, GLB pending', () => {
  const registry = createWorldAssetRegistry(SEED_ASSETS);
  const entry = resolveVehicleEntry(registry, 'vehicle.sedan');
  assert.ok(entry, 'sedan resolves');
  assert.ok(entry.uri!.startsWith('proc:'), `picked ${entry.uri}`);
  // The chain keeps the verified-but-unloadable GLB ahead — the swap point is this function.
  const bus = resolveVehicleEntry(registry, 'vehicle.bus');
  assert.ok(bus?.uri?.startsWith('proc:'));
  assert.equal(resolveVehicleEntry(registry, 'vehicle.nonexistent'), null);
});

test('vehicle paint is deterministic per id and stays in the palette', () => {
  assert.equal(vehiclePaint(7), vehiclePaint(7));
  assert.equal(vehiclePaintIndex(7), vehiclePaintIndex(7));
  assert.match(vehiclePaint(12), /^#/);
});

// --- Render-time interpolation --------------------------------------------------------------

test('interpolateVehiclePose lerps position and takes the shortest yaw arc', () => {
  // Header (8) + one record (12): [id, kind, px, pz, pyaw, x, z, yaw, speed, flags, age, reserved]
  const snap = [
    9, 12, 1 / 24, 1, VSNAP_STRIDE, 5, 0, 0,
    7, 0, 10, 20, 0, 14, 24, Math.PI / 2, 6, 0, 3, 0,
  ];
  assert.equal(snap.length, VSNAP_HEADER + VSNAP_STRIDE);
  const out = { x: 0, z: 0, yaw: 0 };
  interpolateVehiclePose(snap, 0, 0, out);
  assert.deepEqual(out, { x: 10, z: 20, yaw: 0 }, 'alpha 0 shows the previous pose');
  interpolateVehiclePose(snap, 0, 1, out);
  assert.deepEqual(out, { x: 14, z: 24, yaw: Math.PI / 2 }, 'alpha 1 shows the current pose');
  interpolateVehiclePose(snap, 0, 0.5, out);
  assert.deepEqual(out, { x: 12, z: 22, yaw: Math.PI / 4 });
  // Yaw wraps through ±π the short way: 3.0 → -3.0 sweeps ~0.283, not ~6.
  const wrap = [...snap];
  wrap[VSNAP_HEADER + 4] = 3.0;
  wrap[VSNAP_HEADER + 7] = -3.0;
  interpolateVehiclePose(wrap, 0, 0.5, out);
  assert.ok(Math.abs(out.yaw) > Math.PI - 0.2, `yaw ${out.yaw} wraps past π`);
});

// --- Flag gate (the zero-diff contract) -----------------------------------------------------

test('EXPO_PUBLIC_LIVING_CITY defaults off and the gate returns [] (zero-diff)', () => {
  assert.equal(EXPERIMENTAL_LIVING_CITY, false, 'flag is opt-in, like the L1–L6 lanes');
  const factory: SceneActorFactory = () => {
    throw new Error('must never be invoked while gated off');
  };
  assert.deepEqual(livingCityFactoriesFor(false, [factory]), []);
  assert.deepEqual(livingCityFactoriesFor(true, [factory]), [factory]);
});
