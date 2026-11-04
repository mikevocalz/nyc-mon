import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { customBuildingEmissionNode, customWallColorNode, customSelfLitEmissionNode, customMonumentRadianceNode, sourceCustomBuildingProgram } from './custom-building-material.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

test('custom families require the recorded source program as well as its material role', () => {
  assert.equal(sourceCustomBuildingProgram('b3wall|0.2|0.05|cityaon|cs34|lighttrim1,1,1|st34', '2950ad8e'), 'wall-weathered');
  assert.equal(sourceCustomBuildingProgram('b2vic', '403da1e'), 'victoria');
  assert.equal(sourceCustomBuildingProgram('b3tg|glass_tower_green#8384784', '16df4371'), 'tower-glass');
  assert.throws(() => sourceCustomBuildingProgram('b2vic', 'changed'), /Unsupported/);
  assert.throws(() => sourceCustomBuildingProgram('b3wall|0.7|0.05|cityaon|cs34|lighttrim1,1,1|st34', '2950ad8e'), /Unsupported/);
});

test('authored wall source-world weather and night modifiers compile on native WGSL without day/night recompilation', async () => {
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never);
  await renderer.init();
  const T = THREE.TSL, night = T.uniform(0), sourceOffset = T.uniform(new THREE.Vector3(300, 3.5, 1400));
  const sourceDayNight = T.uniform(new THREE.Vector2(0.179, 1.1)), reflectedWorldY = T.uniform(-0.1);
  const geometry = new THREE.BoxGeometry(), camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4;
  const scene = new THREE.Scene(), materials: THREE.MeshStandardNodeMaterial[] = [];
  for (const weathered of [true, false]) {
    const material = new THREE.MeshStandardNodeMaterial();
    material.colorNode = customWallColorNode(THREE, { color: T.vec3(0.6, 0.4, 0.3), world: T.positionWorld.add(sourceOffset), night, weathered });
    materials.push(material); scene.add(new THREE.Mesh(geometry, material));
  }
  for (const program of ['victoria', 'lattice', 'night-lit', 'tower-glass'] as const) {
    const material = new THREE.MeshStandardNodeMaterial();
    material.emissiveNode = customBuildingEmissionNode(THREE, program, T.vec3(0.7, 0.4, 0.2), night);
    materials.push(material); scene.add(new THREE.Mesh(geometry, material));
  }
  const selfLit = new THREE.MeshStandardNodeMaterial();
  selfLit.emissiveNode = customSelfLitEmissionNode(THREE, T.vec3(0.1), T.vec3(0.6, 0.4, 0.2).mul(T.mix(0.30, 0.88, night)), sourceDayNight, night);
  materials.push(selfLit); scene.add(new THREE.Mesh(geometry, selfLit));
  const reflection = new THREE.MeshStandardNodeMaterial();
  reflection.colorNode = customMonumentRadianceNode(THREE, T.uniform(new THREE.Vector3(0.8, 0.3, 0.1)), reflectedWorldY);
  materials.push(reflection); scene.add(new THREE.Mesh(geometry, reflection));
  renderer.render(scene, camera);
  assert.ok(record.shaders.some((source) => source.includes('43758.5453') && source.includes('1.22')));
  assert.ok(record.shaders.some((source) => source.includes('0.2126') && source.includes('0.7152') && source.includes('smoothstep')));
  const pipelines = record.renderPipelines;
  night.value = 1; sourceOffset.value.x += 128; sourceDayNight.value.set(0.640, 1.6); reflectedWorldY.value = 0.2;
  renderer.render(scene, camera);
  assert.equal(record.renderPipelines, pipelines);
  for (const material of materials) material.dispose();
  geometry.dispose(); renderer.dispose();
});
