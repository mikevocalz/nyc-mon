// three r186 rendered every shadow caster through one shared override material
// and copied each caster's alphaTest onto it through Material's alphaTest
// setter, bumping `version` on every zero-crossing — every shadow render
// object re-keyed every frame (see git history for the measured numbers).
// r187 upstreamed the fix: Renderer assigns `overrideMaterial._alphaTest`
// directly, bypassing the setter (src/renderers/common/Renderer.js). This
// file pins that upstream line and the behaviour it preserves.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../render-runtime/recording-gpu.test-support.ts';
import { advanceNodeFrame } from '@acme/ui/three/internals';

const require = createRequire(import.meta.url);
const threeRoot = dirname(dirname(require.resolve('three')));
const source = readFileSync(join(threeRoot, 'src/renderers/common/Renderer.js'), 'utf8');

test('pinned to r187: the shadow pass bypasses the alphaTest setter upstream', () => {
  assert.equal(THREE.REVISION, '187', `three r${THREE.REVISION}: re-measure before moving the pin`);
  assert.match(source, /overrideMaterial\._alphaTest = material\.alphaTest/);
});

/** Re-keys over five steady frames of a sun-shadowed scene of eight casters, alternating alphaTest 0 / 0.5. */
async function steadyKeys(): Promise<{ keys: number; shaders: string[] }> {
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(64, 64), device } as never);
  await renderer.init();
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.position.set(10, 20, 5);
  scene.add(sun);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.MeshStandardNodeMaterial();
    if (i % 2 === 1) m.alphaTest = 0.5;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m);
    mesh.position.set(i * 2 - 8, 0.5, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true; // a receiver is what runs the shadow pass
    scene.add(mesh);
  }
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, 0);
  // A render object re-keys through its material's customProgramCacheKey (RenderObject.getMaterialCacheKey).
  const NodeProto = THREE.NodeMaterial.prototype as unknown as { customProgramCacheKey: () => string };
  const original = NodeProto.customProgramCacheKey;
  let keys = 0;
  try {
    const draw = () => { advanceNodeFrame(renderer as never); renderer.render(scene, camera); };
    for (let f = 0; f < 3; f++) draw();
    NodeProto.customProgramCacheKey = function (this: unknown) { keys++; return original.call(this); };
    for (let f = 0; f < 5; f++) draw();
    return { keys, shaders: record.shaders };
  } finally {
    NodeProto.customProgramCacheKey = original;
    renderer.dispose();
  }
}

test('mixed alphaTest casters: steady frames do not re-key, and the alpha-tested shadow keeps its discard', async () => {
  const { keys, shaders } = await steadyKeys();
  assert.ok(keys < 5, `steady frames should barely re-key with the upstream bypass (${keys})`);
  assert.ok(shaders.some((code) => code.includes('discard')), 'the alpha-tested caster still discards in its shadow shader');
});

test('ordinary materials still bump their version when alphaTest crosses zero', () => {
  const m = new THREE.MeshStandardNodeMaterial();
  const v = m.version;
  m.alphaTest = 0.5;
  assert.equal(m.version, v + 1);
});
