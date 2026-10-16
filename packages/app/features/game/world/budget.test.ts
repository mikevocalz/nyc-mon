import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { ThreeContext, ThreeFrame } from '@acme/ui/three';
import { parseCityDataset } from '../city-dataset.ts';
import { createCityScene, type CityCamera } from '../city-scene.ts';
import { visibleTriangles } from './budget.ts';

/**
 * Surface Duo budget. The device measured 857k triangles at 14.7 fps
 * (2026-10-16); the first target was 200k. The street-level pass (D18)
 * raised it to 300k, since the Duo's frame rate turned out not to follow
 * the triangle count.
 */
const TRIANGLE_BUDGET = 300_000;
const frame = { delta: 0, time: 0, reducedMotion: false } as unknown as ThreeFrame;
/**
 * Scene build in node, cold, on the real tile. The Surface Duo runs this on
 * Hermes (no JIT) inside the 20 s START window: a 450 ms node build was
 * enough to push START past it (2026-10-16). About 200 ms after the fix,
 * fastest of three builds.
 */
const BUILD_BUDGET_MS = 400;

test('the real tile stays under the triangle budget at the Apollo spawn and while walking', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const camera: CityCamera = { x: -28, z: 22, yaw: Math.PI / 2, distance: 8 };
  // Fastest of three builds: the suite runs files in parallel, and one slow sample is the neighbours, not the build.
  let buildMs = Infinity;
  for (let i = 0; i < 2; i++) {
    const started = performance.now();
    createCityScene({ THREE } as unknown as ThreeContext, { dataset, camera }).dispose!();
    buildMs = Math.min(buildMs, performance.now() - started);
  }
  const started = performance.now();
  const built = createCityScene({ THREE } as unknown as ThreeContext, { dataset, camera });
  buildMs = Math.min(buildMs, performance.now() - started);
  assert.ok(buildMs < BUILD_BUDGET_MS, `scene build ${buildMs.toFixed(0)} ms`);
  console.log(`scene build ${buildMs.toFixed(0)} ms (fastest of three)`);
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
