// Teardown of the physical stack's GPU state that three r186 leaves to a GC on
// the shared device (the H-Lynk memory lane's audit): the ClusteredLightsNode
// light-index storage buffer, the storage instance matrices, and the world's
// own lights. Observed through the recording GPU harness's renderer data maps.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../render-runtime/recording-gpu.test-support.ts');
installGpuGlobals();
const THREE = await import('three/webgpu');
const { ClusteredLighting } = await import('three/examples/jsm/lighting/ClusteredLighting.js');
const { releaseClusteredNode, releaseStorageInstanceMatrices, swapInstanceMatricesToStorage } = await import('./physical-rig.ts');

type Internals = { _attributes: { has(o: object): boolean } };

async function setup() {
  const { device } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(256, 256), device } as never);
  await renderer.init();
  renderer.setSize(256, 256, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 2, 6);
  return { renderer, scene, camera };
}

test('releaseClusteredNode deletes the light-index storage buffer and the scene node', async () => {
  const { renderer, scene, camera } = await setup();
  const lighting = new ClusteredLighting(8, 32, 8, 8);
  renderer.lighting = lighting as never;
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardNodeMaterial()), new THREE.PointLight(0xffffff, 2, 5));
  renderer.render(scene, camera);
  const node = (lighting as unknown as { _lightsNodeMap: WeakMap<object, { _lightIndexes: { value: object } | null }> })._lightsNodeMap.get(scene);
  assert.ok(node?._lightIndexes, 'the frame built the clustered node and its index buffer');
  const indexes = node._lightIndexes.value;
  const attributes = (renderer as unknown as Internals)._attributes;
  assert.ok(attributes.has(indexes), 'the index buffer was uploaded');
  assert.equal(releaseClusteredNode(renderer as never, lighting, scene), true);
  assert.equal(attributes.has(indexes), false, 'the storage buffer is gone from the renderer');
  assert.equal(releaseClusteredNode(renderer as never, lighting, scene), false, 'a second release is a no-op');
});

test('releaseStorageInstanceMatrices frees every swapped instance matrix', async () => {
  const { renderer, scene, camera } = await setup();
  const a = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicNodeMaterial(), 4);
  const b = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicNodeMaterial(), 2);
  scene.add(a, b);
  assert.equal(swapInstanceMatricesToStorage(THREE as never, renderer as never, scene as never), 2);
  renderer.render(scene, camera);
  const attributes = (renderer as unknown as Internals)._attributes;
  assert.ok(attributes.has(a.instanceMatrix) && attributes.has(b.instanceMatrix));
  assert.equal(releaseStorageInstanceMatrices(renderer as never, scene as never), 2);
  assert.equal(attributes.has(a.instanceMatrix), false);
  assert.equal(attributes.has(b.instanceMatrix), false);
});

test('the world disposes its own hemisphere light and sun', async () => {
  const { parseCityDataset } = await import('../city-dataset.ts');
  const { buildCityWorld } = await import('./index.ts');
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const world = buildCityWorld(THREE as never, dataset, { skyRig: false });
  const lights: { dispose(): void; isLight?: boolean }[] = [];
  world.group.traverse((o) => { if ((o as { isLight?: boolean }).isLight) lights.push(o as never); });
  assert.ok(lights.length >= 2, `${lights.length} lights`);
  let disposed = 0;
  for (const light of lights) {
    const original = light.dispose.bind(light);
    light.dispose = () => { disposed++; original(); };
  }
  world.dispose();
  assert.equal(disposed, lights.length, 'hemisphere light and sun disposed');
});

test('the sky rig disposes its sun', async () => {
  const { createSkyRig } = await import('./sky-rig.ts');
  const rig = createSkyRig(THREE as never, {});
  let disposed = 0;
  const original = rig.sun.dispose.bind(rig.sun);
  rig.sun.dispose = () => { disposed++; original(); };
  rig.dispose();
  assert.equal(disposed, 1);
});
