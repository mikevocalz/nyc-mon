// Lane C: Valdrada's PBR library surface (pbr-material.ts) against its baked texture arrays (data/pbr-sets.ts,
// assets/pbr-*.bin): the payloads are the manifest's size, a material builds, and two sets (and three option sets)
// share one shader and one pipeline.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { VD_PBR_BIN, VD_PBR_LAYER_SIZE, VD_PBR_LAYERS, VD_PBR_SETS } from './data/pbr-sets.ts';
import { createPbrMaterial, loadPbrTextures, type PbrDescriptor } from './pbr-material.ts';

const bin = (name: string) => {
  const b = readFileSync(new URL(`./assets/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

// Three descriptors as tooling/city/vd-port/describe-pbr.mjs reads them off Valdrada's live materials (pk/pkMats.js
// pkMat('green'), pkMat('concrete'); vk/vkMats.js otherMat('brick')), the obcUni fields the port reads.
const COMMON = { family: 'pbr', side: 0, over: false, street: false, gum: false, city: true, pbBaseY: -10000, pbTopY: 100000, pbRot: [1, 0, 0, 1], pbWorld: 0, pbGrimeC: [0.52, 0.49, 0.45], pbGlazed: 0, pbRS: [0, 1, 0], pbRough: 1 } as const;
const GREEN: PbrDescriptor = {
  ...COMMON, name: 'metal_painted', set: 'paint_steel', envMapIntensity: 0.25, trim: [1.94, 1.7, 1.47], paint: true,
  pbSize: [1, 1], pbRatio: [0.0859119, 0.2742181, 0.1514681], pbSeed: 337, pbDirt: 0.25, pbPaint: [0.0137021, 0.043735, 0.0241576],
  pbUnit: [0, 0], pbBl: [0.25, 0.75, 0.5], pbChips: 0.2, pbRefL: 0.1595, pbScan: [-0.1262899, 0.0418101, -0.0422899, 0.1594899],
  pbSubK: 1, pbOver: [0, 0.1595, 0.55], pbCavK: 0, pbMetal: [0, 0], pbNrmK: 0.48, pbFac: [0, 1, 1],
};
const CONCRETE: PbrDescriptor = {
  ...COMMON, name: 'concrete_precast', set: 'concrete_precast', envMapIntensity: 1, trim: [1.94, 1.7, 1.47], paint: false,
  pbSize: [2.2, 1.1], pbRatio: [0.8572081, 0.8545324, 0.8116153], pbSeed: 349, pbDirt: 0.3, pbPaint: [0.3864294, 0.3662526, 0.3094689],
  pbUnit: [0, 0], pbBl: [0.25, 0.75, 0.5], pbChips: 1, pbRefL: 0.4299, pbScan: [0, 0, 0, 1], pbSubK: 0, pbOver: [0, 0.4299, 0.55],
  pbCavK: 1, pbMetal: [0, 0], pbNrmK: 1, pbFac: [0, 0, 0],
};
const BRICK: PbrDescriptor = {
  ...COMMON, name: 'brick_tan', set: 'brick_tan', envMapIntensity: 1, trim: null, paint: false,
  pbSize: [2.1336, 1.0832], pbRatio: [0.7374701, 0.6485099, 0.6359067], pbSeed: 0, pbDirt: 0.3, pbPaint: [0.3324515, 0.1946178, 0.1070231],
  pbUnit: [1, 0.125], pbBl: [0.42, 0.58, 1.4], pbChips: 1, pbRefL: 0.3226, pbScan: [0, 0, 0, 1], pbSubK: 0, pbOver: [0, 0.3226, 0.55],
  pbCavK: 1, pbMetal: [0, 0], pbNrmK: 1, pbFac: [1, 0, 0],
};

test('the .bin payloads are the manifest\'s size and content', () => {
  for (const [key, file] of [['albedo', 'pbr-albedo.bin'], ['orm', 'pbr-orm.bin']] as const) {
    const b = bin(file);
    assert.equal(b.byteLength, VD_PBR_LAYER_SIZE * VD_PBR_LAYER_SIZE * 4 * VD_PBR_LAYERS, file);
    assert.equal(b.byteLength, VD_PBR_BIN[key].bytes, file);
    assert.equal(createHash('sha256').update(new Uint8Array(b)).digest('hex').slice(0, 16), VD_PBR_BIN[key].sha256, file);
  }
  assert.deepEqual(VD_PBR_SETS.map((s) => s.layer), VD_PBR_SETS.map((_, i) => i));
  // each layer's albedo mean (decoded from the bytes) is the manifest's baked mean, within a byte's rounding
  const a = new Uint8Array(bin('pbr-albedo.bin')), n = VD_PBR_LAYER_SIZE * VD_PBR_LAYER_SIZE;
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  for (const s of VD_PBR_SETS) {
    const m = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) m[c]! += lin(a[(s.layer * n + i) * 4 + c]!) / n;
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(m[c]! - s.bakedMean[c]!) < 0.004, `${s.set} mean ${m.map((v) => v.toFixed(4))} vs ${s.bakedMean}`);
  }
  const mb = (VD_PBR_BIN.albedo.bytes + VD_PBR_BIN.orm.bytes) / 1048576;
  console.log(`pbr payloads: ${VD_PBR_LAYERS} layers of ${VD_PBR_LAYER_SIZE} px, ${mb.toFixed(2)} MB on disk, ${(mb * 4 / 3).toFixed(2)} MB on the GPU with mips`);
  assert.ok(mb * 4 / 3 <= 16, 'within the 16 MB budget');
});

test('two sets and three option sets build into one shader and one pipeline', async () => {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../../../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(64, 64), device } as never);
  await renderer.init();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(), new THREE.DirectionalLight());
  const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 100);
  camera.position.set(0, 1.6, 6);
  camera.lookAt(0, 1, 0);
  const tex = loadPbrTextures(THREE as never, { albedo: bin('pbr-albedo.bin'), orm: bin('pbr-orm.bin') });
  const env = { night: THREE.TSL.uniform(0) as never, physical: true, albedo: tex.albedo, orm: tex.orm, groundY: 0.14 };
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const add = (d: PbrDescriptor, x: number) => {
    const mesh = new THREE.Mesh(geo, createPbrMaterial(THREE as never, d, env) as never);
    mesh.position.set(x, 0.5, 0);
    scene.add(mesh);
    return mesh;
  };

  add(GREEN, -1.5);
  renderer.render(scene, camera);
  const one = { shaders: record.shaders.length, pipelines: record.renderPipelines };
  const pbrShaders = record.shaders.filter((s) => s.includes('texture_2d_array'));
  assert.ok(pbrShaders.length >= 1, 'the pbr fragment shader samples the arrays');
  console.log(`one pbr material: ${one.shaders} shader modules, ${one.pipelines} render pipelines (incl. the mip generation), fragment WGSL ${pbrShaders.map((s) => s.length).join(' / ')} chars`);

  add(CONCRETE, 0);
  add(BRICK, 1.5);
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  assert.equal(record.shaders.length, one.shaders, `two more materials (other sets, other options) added ${record.shaders.length - one.shaders} shader modules`);
  assert.equal(record.renderPipelines, one.pipelines, `two more materials added ${record.renderPipelines - one.pipelines} pipelines`);
  assert.ok(record.draws >= 3, `${record.draws} draws`);
  // the arrays: RGBA8 (albedo sRGB), the manifest's size and layers, a full mip chain
  const arrays = record.textures.filter((t) => t.layers === VD_PBR_LAYERS && t.width === VD_PBR_LAYER_SIZE);
  assert.deepEqual(arrays.map((t) => t.format).sort(), ['rgba8unorm', 'rgba8unorm-srgb']);
  for (const t of arrays) assert.equal(t.mipLevelCount, Math.log2(VD_PBR_LAYER_SIZE) + 1);
});

test('a descriptor with per-vertex weathering is refused (not ported)', () => {
  const tex = { albedo: null as never, orm: null as never };
  assert.throws(() => createPbrMaterial(THREE as never, { ...CONCRETE, weatherAttr: true }, { night: THREE.TSL.uniform(0) as never, physical: true, ...tex }), /not ported/);
  assert.throws(() => createPbrMaterial(THREE as never, { ...CONCRETE, set: 'asphalt' }, { night: THREE.TSL.uniform(0) as never, physical: true, ...tex }), /not baked/);
});
