// world/shadow-pass-alpha.ts: with casters of both kinds (alphaTest 0 and
// 0.5) the shadow pass stops re-keying its render objects every frame, and the
// alpha-tested caster's shadow pipeline still carries its discard.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../render-runtime/recording-gpu.test-support.ts';
import { advanceNodeFrame } from '@acme/ui/three/internals';
import { installShadowPassAlphaTest, shadowPassAlphaApplies } from './shadow-pass-alpha.ts';

test('pinned to three r186, the revision the bypass was measured on', () => {
  assert.equal(shadowPassAlphaApplies(THREE as never), true, `three r${THREE.REVISION}: re-measure before moving the pin`);
});

/** Re-keys over five steady frames of a sun-shadowed scene of eight casters, alternating alphaTest 0 / 0.5. */
async function steadyKeys(install: boolean): Promise<{ keys: number; shaders: string[] }> {
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
  const Material = THREE.Material.prototype;
  const saved = Object.getOwnPropertyDescriptor(Material, 'alphaTest')!;
  // A render object re-keys through its material's customProgramCacheKey (RenderObject.getMaterialCacheKey).
  const NodeProto = THREE.NodeMaterial.prototype as unknown as { customProgramCacheKey: () => string };
  const original = NodeProto.customProgramCacheKey;
  let keys = 0;
  try {
    if (install) installShadowPassAlphaTest(THREE as never);
    // The app's loop advances three's node frame each draw (ThreeCanvas); the shadow pass runs once per node frame.
    const draw = () => { advanceNodeFrame(renderer as never); renderer.render(scene, camera); };
    for (let f = 0; f < 3; f++) draw();
    NodeProto.customProgramCacheKey = function (this: unknown) { keys++; return original.call(this); };
    for (let f = 0; f < 5; f++) draw();
    return { keys, shaders: record.shaders };
  } finally {
    NodeProto.customProgramCacheKey = original;
    Object.defineProperty(Material, 'alphaTest', saved);
    delete (Material as unknown as Record<symbol, unknown>)[Symbol.for('nyc-mon.shadowPassAlphaTest')];
  }
}

test('mixed alphaTest casters: the shadow pass stops re-keying every frame, and the alpha-tested shadow keeps its discard', async () => {
  const before = await steadyKeys(false);
  const after = await steadyKeys(true);
  assert.ok(before.keys >= 5 * 4, `without the bypass every caster re-keys each frame (${before.keys})`);
  assert.ok(after.keys < before.keys / 4, `with it the steady frames barely re-key (${after.keys} vs ${before.keys})`);
  assert.ok(after.shaders.some((code) => code.includes('discard')), 'the alpha-tested caster still discards in its shadow shader');
});

test('ordinary materials still bump their version when alphaTest crosses zero', () => {
  installShadowPassAlphaTest(THREE as never);
  const m = new THREE.MeshStandardNodeMaterial();
  const v = m.version;
  m.alphaTest = 0.5;
  assert.equal(m.version, v + 1);
  const shadow = new THREE.NodeMaterial() as THREE.NodeMaterial & { isShadowPassMaterial?: boolean };
  shadow.isShadowPassMaterial = true;
  const sv = shadow.version;
  shadow.alphaTest = 0.5;
  shadow.alphaTest = 0;
  assert.equal(shadow.version, sv);
  assert.equal(shadow.alphaTest, 0);
});
