import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorldAssetRegistry } from './asset-registry.ts';
import { PED_SEMANTIC_ID } from './ped-sim.ts';
import {
  pedClothes,
  pedClothesIndex,
  personGeometryData,
  resolvePedEntry,
} from './ped-actor.ts';
import { SEED_ASSETS } from './seed-assets.ts';
import { EXPERIMENTAL_LIVING_CITY, livingCityFactoriesFor } from './vehicle-actor.ts';
import type { SceneActorFactory } from '../scene-actor.ts';

// --- Mesh recipe -----------------------------------------------------------------------

test('person recipe: two boxes, bounded triangle count, feet pivot', () => {
  const data = personGeometryData({ lengthM: 0.45, widthM: 0.55, heightM: 1.7 });
  // Legs + torso/head = two boxes = 24 triangles.
  assert.equal(data.triangles, 24);
  assert.equal(data.positions.length / 3, 48);
  assert.equal(data.normals.length, data.positions.length);
  assert.ok(Math.max(...data.indices) < data.positions.length / 3, 'indices in range');
  // Feet pivot: nothing below y=0, head reaches the declared height.
  const ys = data.positions.filter((_, i) => i % 3 === 1);
  assert.ok(Math.min(...ys) >= -0.001, 'feet on the ground plane');
  assert.ok(Math.max(...ys) <= 1.7 + 0.001, 'height bound honoured');
  // The kid variant shrinks by data, not code.
  const kid = personGeometryData({ lengthM: 0.35, widthM: 0.4, heightM: 1.15 });
  const kidYs = kid.positions.filter((_, i) => i % 3 === 1);
  assert.ok(Math.max(...kidYs) < Math.max(...ys), 'kid is shorter');
});

test('resolvePedEntry lands on a buildable proc recipe today, GLB pending', () => {
  const registry = createWorldAssetRegistry(SEED_ASSETS);
  for (const semantic of ['ped.adult', 'ped.kid'] as const) {
    const entry = resolvePedEntry(registry, semantic);
    assert.ok(entry, `${semantic} resolves`);
    assert.ok(entry.uri!.startsWith('proc:'), `picked ${entry.uri}`);
  }
  assert.equal(resolvePedEntry(registry, 'ped.nonexistent'), null);
});

test('ped clothes are deterministic per id and stay in the palette', () => {
  assert.equal(pedClothes(7), pedClothes(7));
  assert.equal(pedClothesIndex(7), pedClothesIndex(7));
  assert.match(pedClothes(12), /^#/);
  assert.notEqual(pedClothes(1), pedClothes(2), 'different ids can differ');
});

test('the semantic seam: the sim names kinds, never meshes', () => {
  assert.equal(PED_SEMANTIC_ID.adult, 'ped.adult');
  assert.equal(PED_SEMANTIC_ID.kid, 'ped.kid');
});

// --- Flag gate (the zero-diff contract) -----------------------------------------------------

test('EXPO_PUBLIC_LIVING_CITY defaults off: ped factory gated out like the fleet', () => {
  assert.equal(EXPERIMENTAL_LIVING_CITY, false, 'flag is opt-in');
  const factory: SceneActorFactory = () => {
    throw new Error('must never be invoked while gated off');
  };
  assert.deepEqual(livingCityFactoriesFor(false, [factory]), []);
  assert.deepEqual(livingCityFactoriesFor(true, [factory]), [factory]);
});
