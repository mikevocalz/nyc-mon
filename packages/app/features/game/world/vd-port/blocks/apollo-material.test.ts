import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { APOLLO_SOURCE_PROGRAMS, apolloSurfaceNodes, sourceApolloProgram } from './apollo-material.ts';
import { installSourceOutputHook } from './source-output.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

test('Apollo classification rejects changed and unknown source shaders', () => {
  for (const [key, hash] of Object.entries(APOLLO_SOURCE_PROGRAMS)) assert.equal(sourceApolloProgram(`prefix|${key}`, hash), key);
  assert.throws(() => sourceApolloProgram('prefix|a34tube', 'changed'), /Unsupported/);
  assert.throws(() => sourceApolloProgram('a33led', 'e3c25378'), /Unsupported/);
});

test('all observed Apollo modifiers compile to WGSL and keep one pipeline across day/night', async () => {
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never);
  await renderer.init();
  const T = THREE.TSL, night = T.uniform(0);
  const geometry = new THREE.BoxGeometry();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xaaaaaa, 2, 20);
  const materials: THREE.MeshStandardNodeMaterial[] = [];
  for (const key of Object.keys(APOLLO_SOURCE_PROGRAMS) as (keyof typeof APOLLO_SOURCE_PROGRAMS)[]) {
    const material = new THREE.MeshStandardNodeMaterial();
    const nodes = apolloSurfaceNodes(THREE, key, { emission: T.vec3(0.7, 0.4, 0.2), night });
    if (nodes.emission) material.emissiveNode = nodes.emission;
    if (nodes.output) installSourceOutputHook(material, nodes.output);
    materials.push(material);
    scene.add(new THREE.Mesh(geometry, material));
  }
  renderer.render(scene, camera);
  const pipelines = record.renderPipelines;
  assert.ok(pipelines > 0);
  assert.ok(record.shaders.some((source) => source.includes('1.35')));
  night.value = 1;
  renderer.render(scene, camera);
  assert.equal(record.renderPipelines, pipelines);
  for (const material of materials) material.dispose();
  geometry.dispose(); renderer.dispose();
});
