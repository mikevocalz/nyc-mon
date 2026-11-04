import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { sourceTangentNormal } from './source-normal-map.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

test('source tangent frame compiles transformed UV derivatives, full normal XYZ and source sidedness', async () => {
  installGpuGlobals(); const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never); await renderer.init();
  const T = THREE.TSL, scale = T.uniform(new THREE.Vector2(1.5, 1.5)), camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4;
  const geometry = new THREE.BoxGeometry(), scene = new THREE.Scene(); scene.add(new THREE.DirectionalLight());
  const image = new THREE.DataTexture(new Uint8Array([80, 140, 220, 255]), 1, 1); image.needsUpdate = true;
  const materials: THREE.MeshStandardNodeMaterial[] = [];
  for (const side of [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide]) for (const flatShading of [false, true]) {
    const material = new THREE.MeshStandardNodeMaterial({ side, flatShading });
    const uv = T.vec2(T.uv().y.mul(-2), T.uv().x.mul(3));
    material.normalNode = sourceTangentNormal(THREE, { sample: T.texture(image, uv).rgb, uv, scale, side, flatShading });
    materials.push(material); scene.add(new THREE.Mesh(geometry, material));
  }
  renderer.render(scene, camera);
  assert.ok(record.shaders.some(code => code.includes('dpdx') && code.includes('dpdy') && code.includes('inverseSqrt')));
  const pipelines = record.renderPipelines; scale.value.set(-1.5, 0.5); renderer.render(scene, camera);
  assert.equal(record.renderPipelines, pipelines);
  for (const material of materials) material.dispose(); geometry.dispose(); image.dispose(); renderer.dispose();
});
