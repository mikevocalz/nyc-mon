// The physical city's first frame on the bundled Harlem tile, run through a
// recording GPUDevice at the iPad Pro 12.9" drawing buffer (2732 x 2048).
// On the iPad the full stack never reached this frame: every lit material's
// shader build coerced ClusteredLightsNode's light-index buffer (an
// Int32Array of 7.4 M entries at that size) to a string, once per shader
// stage, about 2 GB of strings on the JS thread (patches/three@0.186.1.patch).
// These budgets pin that fix and the frame's size around it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
delete process.env.EXPO_PUBLIC_WORLD_PROBE;
delete process.env.EXPO_PUBLIC_WORLD_TIER;
delete process.env.EXPO_PUBLIC_WORLD_DROP;

const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('./render-runtime/recording-gpu.test-support.ts');
installGpuGlobals();
const THREE = await import('three/webgpu');
const { parseCityDataset } = await import('./city-dataset.ts');
const { createCityScene } = await import('./city-scene.ts');
const { physicalRendererParams } = await import('./world/physical-look.ts');
const { createVehicleActor } = await import('./living-city/vehicle-actor.ts');

const WIDTH = 2732;
const HEIGHT = 2048;

// Measured 2026-10-28 (node 26, three 0.186.1 + patch): 131 shader modules,
// 1.72 MB of WGSL, 73 render pipelines, 1 compute pipeline, 35 materials.
// The budgets leave room for tuning but not for a per-building material or
// a second copy of the stack.
const BUDGET = { shaderModules: 150, wgslBytes: 2_100_000, renderPipelines: 90, materials: 45 };

/** Large typed arrays turned into strings (join / toString / toLocaleString) while `run` executes. */
function countTypedArrayStringification(run: () => void): { calls: number; elements: number } {
  const proto = Object.getPrototypeOf(Int8Array.prototype) as Record<string, (...a: unknown[]) => unknown>;
  const names = ['join', 'toString', 'toLocaleString'] as const;
  const originals = names.map((n) => proto[n]!);
  const seen = { calls: 0, elements: 0 };
  names.forEach((n, i) => {
    proto[n] = function (this: ArrayLike<number>, ...args: unknown[]) {
      if (this.length > 4096) { seen.calls++; seen.elements += this.length; }
      return originals[i]!.apply(this, args);
    };
  });
  try {
    run();
  } finally {
    names.forEach((n, i) => { proto[n] = originals[i]!; });
  }
  return seen;
}

test('physical first frame on the Harlem tile: no typed array becomes a string, WGSL and pipelines in budget', async () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')));
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(WIDTH, HEIGHT), device, antialias: true, ...physicalRendererParams() } as never);
  await renderer.init();
  renderer.setPixelRatio(2);
  renderer.setSize(WIDTH / 2, HEIGHT / 2, false);
  const params = { camera: { x: 0, z: 0, yaw: 0, distance: 200 }, dataset };
  const built = createCityScene({ THREE, renderer, invalidate: () => {} } as never, {
    ...params,
    actors: [createVehicleActor({ read: () => null })],
  } as never);

  const stringified = countTypedArrayStringification(() => {
    built.update!({ delta: 1 / 60, time: 1 / 60, reducedMotion: false } as never, params as never);
    renderer.render(built.scene as never, built.camera as never);
  });
  assert.ok(renderer.lighting.constructor.name.includes('Clustered'), 'the full stack mounts ClusteredLighting');
  assert.deepEqual(stringified, { calls: 0, elements: 0 }, 'a typed array was joined into a string during the frame');

  const wgslBytes = record.shaders.reduce((n, code) => n + code.length, 0);
  assert.ok(record.shaders.length > 0 && record.renderPipelines > 0, 'the frame built shaders and pipelines');
  assert.ok(record.shaders.length <= BUDGET.shaderModules, `${record.shaders.length} shader modules`);
  assert.ok(wgslBytes <= BUDGET.wgslBytes, `${wgslBytes} bytes of WGSL`);
  assert.ok(record.renderPipelines <= BUDGET.renderPipelines, `${record.renderPipelines} render pipelines`);
  assert.equal(new Set(record.shaders).size, record.shaders.length, 'every shader module is distinct WGSL');

  const materials = new Set<unknown>();
  (built.scene as InstanceType<typeof THREE.Scene>).traverse((o) => {
    const m = (o as { material?: unknown }).material;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) materials.add(x);
  });
  assert.ok(materials.size <= BUDGET.materials, `${materials.size} materials in the scene`);
  built.dispose?.();
});
