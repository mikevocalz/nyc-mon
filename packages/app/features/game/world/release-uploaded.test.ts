// world/release-uploaded.ts: static geometry and data-texture pixels leave the
// CPU once the GPU has held them for RELEASE_SETTLE_FRAMES frames, and the
// renderer keeps drawing them, including when a later material change makes
// it build a new pipeline for the same geometry (the path that reads
// array.BYTES_PER_ELEMENT and array.constructor) and when a shadow pass first
// runs after the release. Released arrays are trapped
// (release-uploaded.test-support.ts): no read of their contents is allowed.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../render-runtime/recording-gpu.test-support.ts');
installGpuGlobals();
const THREE = await import('three/webgpu');
const { advanceNodeFrame } = await import('@acme/ui/three/internals');
const { backendUploaded, createUploadedReleaser, RELEASE_SETTLE_FRAMES, RELEASE_UPLOADED } = await import('./release-uploaded.ts');
const { trapReleasedReads } = await import('./release-uploaded.test-support.ts');

async function setup() {
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(64, 64), device } as never);
  await renderer.init();
  renderer.setSize(64, 64, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  return { renderer, scene, camera, record };
}

test('releases uploaded static attributes and data-texture pixels, keeps counts and bounds, and draws after a pipeline rebuild', async () => {
  const { renderer, scene, camera, record } = await setup();
  const data = new Uint8Array(4 * 4 * 2 * 4).fill(200);
  const layers = new THREE.DataArrayTexture(data, 4, 4, 2);
  layers.needsUpdate = true;
  const material = new THREE.MeshStandardNodeMaterial();
  material.colorNode = THREE.TSL.texture(layers, THREE.TSL.uv()).depth(THREE.TSL.float(1));
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.Mesh<InstanceType<typeof THREE.BoxGeometry>, InstanceType<typeof THREE.Material>>(geometry, material);
  // The textured material reads position, normal and uv, so every attribute uploads.
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, 4);
  scene.add(mesh, instanced, new THREE.HemisphereLight());

  const releaser = createUploadedReleaser(scene, { settleFrames: 1 });
  const uploaded = backendUploaded(renderer);
  const positions = geometry.getAttribute('position').count;
  const indices = geometry.index!.count;
  assert.equal(releaser.release(uploaded), 0, 'nothing is uploaded before the first frame');

  renderer.render(scene, camera);
  const freed = releaser.release(uploaded);
  assert.ok(freed > data.byteLength, `${freed} bytes freed`);
  assert.equal(releaser.pending, 0);
  assert.equal(geometry.getAttribute('position').array.length, 0);
  assert.ok(geometry.getAttribute('position').array instanceof Float32Array, 'same array type for the vertex layout');
  assert.equal(geometry.getAttribute('position').count, positions, 'count is kept');
  assert.equal(geometry.index!.count, indices);
  assert.ok(geometry.boundingSphere && geometry.boundingSphere.radius > 0, 'bounds computed before release');
  assert.equal((layers.image as { data: Uint8Array }).data.length, 0);
  assert.equal(layers.image.width, 4);
  assert.equal(instanced.geometry.getAttribute('position').array.length, 0, 'an instanced mesh\'s model geometry is released');
  assert.ok(instanced.instanceMatrix.array.length > 0, 'its instance matrices stay: the tiers refill them');

  // A new material on the released geometry builds a new pipeline from it.
  const pipelines = record.renderPipelines;
  const writes = record.writeBytes;
  mesh.material = new THREE.MeshBasicNodeMaterial({ color: 0xff0000 });
  assert.doesNotThrow(() => renderer.render(scene, camera));
  assert.ok(record.renderPipelines > pipelines, 'the new material built a pipeline over the released geometry');
  assert.ok(record.writeBytes - writes < 4096, 'released geometry is not uploaded again');
});

test('dynamic and never-drawn data stays on the CPU', async () => {
  const { renderer, scene, camera } = await setup();
  const dynamic = new THREE.BoxGeometry(1, 1, 1);
  (dynamic.getAttribute('position') as InstanceType<typeof THREE.BufferAttribute>).setUsage(THREE.DynamicDrawUsage);
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicNodeMaterial());
  hidden.visible = false;
  scene.add(new THREE.Mesh(dynamic, new THREE.MeshBasicNodeMaterial()), hidden);
  const releaser = createUploadedReleaser(scene, { settleFrames: 1 });
  renderer.render(scene, camera);
  releaser.release(backendUploaded(renderer));
  assert.ok(dynamic.getAttribute('position').array.length > 0, 'dynamic usage is never released');
  assert.ok(hidden.geometry.getAttribute('position').array.length > 0, 'not uploaded yet, so kept');
  assert.ok(releaser.pending > 0, 'the hidden mesh waits for its first upload');
});

test('the pass is opt-in: off unless EXPO_PUBLIC_WORLD_RELEASE_UPLOADED is set', () => {
  assert.equal(process.env.EXPO_PUBLIC_WORLD_RELEASE_UPLOADED, undefined);
  assert.equal(RELEASE_UPLOADED, false);
});

test('a resource goes only after reading as uploaded on RELEASE_SETTLE_FRAMES frames in a row', async () => {
  const { renderer, scene, camera } = await setup();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicNodeMaterial()));
  const releaser = createUploadedReleaser(scene);
  const uploaded = backendUploaded(renderer);
  renderer.render(scene, camera);
  for (let i = 1; i < RELEASE_SETTLE_FRAMES; i++) {
    assert.equal(releaser.release(uploaded), 0, `frame ${i}: still settling`);
    assert.ok(geometry.getAttribute('position').array.length > 0);
  }
  assert.ok(releaser.release(uploaded) > 0, 'released on the settle frame');
  assert.equal(geometry.getAttribute('position').array.length, 0);
  // A miss resets the streak: a probe that drops out starts the count again.
  const other = new THREE.BoxGeometry(1, 1, 1);
  scene.add(new THREE.Mesh(other, new THREE.MeshBasicNodeMaterial()));
  const late = createUploadedReleaser(scene);
  renderer.render(scene, camera);
  let flicker = 0;
  const flaky = (r: object) => (flicker++ % 2 === 0 ? uploaded(r) : false);
  for (let i = 0; i < RELEASE_SETTLE_FRAMES * 2; i++) late.release(flaky);
  assert.ok(other.getAttribute('position').array.length > 0, 'never released without a full streak');
});

test('geometry marked keepCpuArrays is never collected', async () => {
  const { renderer, scene, camera } = await setup();
  const kept = new THREE.BoxGeometry(1, 1, 1);
  kept.userData.keepCpuArrays = true;
  scene.add(new THREE.Mesh(kept, new THREE.MeshBasicNodeMaterial()));
  const releaser = createUploadedReleaser(scene, { settleFrames: 1 });
  renderer.render(scene, camera);
  releaser.release(backendUploaded(renderer));
  assert.ok(kept.getAttribute('position').array.length > 0);
  assert.equal(releaser.pending, 0, 'not even tracked');
});

test('a shadow pass that first runs after the release reads no released array', async () => {
  const { renderer, scene, camera, record } = await setup();
  const trap = trapReleasedReads();
  try {
    renderer.shadowMap.enabled = false;
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(3, 5, 2);
    light.castShadow = true;
    const caster = new THREE.Mesh(new THREE.TorusKnotGeometry(0.6, 0.2, 64, 8), new THREE.MeshStandardNodeMaterial());
    caster.castShadow = true;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2).translate(0, -1, 0), new THREE.MeshStandardNodeMaterial());
    ground.receiveShadow = true;
    const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardNodeMaterial(), 3);
    instanced.castShadow = true;
    scene.add(light, caster, ground, instanced);
    const releaser = createUploadedReleaser(scene);
    const uploaded = backendUploaded(renderer);
    const frame = () => { advanceNodeFrame(renderer as never); renderer.render(scene, camera); releaser.release(uploaded); };
    for (let i = 0; i <= RELEASE_SETTLE_FRAMES; i++) frame();
    assert.ok(trap.released >= 6, `${trap.released} arrays released with shadows off`);
    trap.pause();
    assert.equal(caster.geometry.getAttribute('position').array.length, 0);
    trap.resume();

    // The second pass arrives late: shadow maps on, every lit material rebuilt.
    const pipelines = record.renderPipelines;
    const buffers = record.bufferBytes;
    renderer.shadowMap.enabled = true;
    for (const m of [caster.material, ground.material, instanced.material]) m.needsUpdate = true;
    frame();
    frame();
    assert.ok(record.renderPipelines > pipelines, 'the shadow pass built its pipelines over released geometry');
    assert.deepEqual(Object.fromEntries(trap.reads), {}, 'the late shadow pass read a released array');
    assert.ok(record.bufferBytes - buffers < 64 * 1024, `${record.bufferBytes - buffers} buffer bytes: no geometry buffer was rebuilt`);
  } finally {
    trap.uninstall();
  }
});

test('the trap sees a read of a released array', async () => {
  const { renderer, scene, camera } = await setup();
  const trap = trapReleasedReads();
  try {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicNodeMaterial()));
    const releaser = createUploadedReleaser(scene, { settleFrames: 1 });
    renderer.render(scene, camera);
    releaser.release(backendUploaded(renderer));
    geometry.computeBoundingBox();
    assert.ok(trap.total() > 0, 'computeBoundingBox over a released position array is caught');
  } finally {
    trap.uninstall();
  }
});
