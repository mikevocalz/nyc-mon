import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { ThreeContext, ThreeFrame } from '@acme/ui/three';
import { parseCityDataset } from '../city-dataset.ts';
import { createCityScene, type CityCamera } from '../city-scene.ts';
import { visibleTriangles } from './budget.ts';

/** Surface Duo budget: the device measured 857k triangles at 14.7 fps (2026-10-16); the target is under 200k. */
const TRIANGLE_BUDGET = 200_000;
const frame = { delta: 0, time: 0, reducedMotion: false } as unknown as ThreeFrame;

test('the real tile stays under the triangle budget at the Apollo spawn and while walking', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const camera: CityCamera = { x: -28, z: 22, yaw: Math.PI / 2, distance: 8 };
  const built = createCityScene({ THREE } as unknown as ThreeContext, { dataset, camera });
  const at = (c: CityCamera) => {
    built.update!(frame, { dataset, camera: c });
    return visibleTriangles(built.scene as never);
  };
  for (const distance of [8, 18, 40]) {
    const { total, meshes } = at({ ...camera, distance });
    assert.ok(total < TRIANGLE_BUDGET, `chase ${distance} m: ${total} triangles (${meshes.map((m) => `${m.name}=${m.triangles}`).join(' ')})`);
  }
  // Walk west along 125th Street: the near trees, shadows and pools follow.
  for (let x = -28; x > -428; x -= 25) {
    const { total } = at({ ...camera, x });
    assert.ok(total < TRIANGLE_BUDGET, `at x=${x}: ${total}`);
  }
  const nearTrees = built.scene.getObjectByName('city:trees-near') as THREE.InstancedMesh;
  assert.ok(nearTrees.count <= 240);
  built.dispose!();
});
