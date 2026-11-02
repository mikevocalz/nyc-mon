// Lane C: Valdrada's viaduct materials (vkMats.js) as TSL. Every family builds and draws; every steel slot is one
// shader and one pipeline whatever its paint; the vk families' shader-module cost; vkRivet's selects against a direct
// transliteration of Valdrada's GLSL branches.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createVkMaterial, setVkRivBand, vkRivet, type RivetAlg, type VkDesc, type VkEnv, type VkSteelDesc } from './vk-materials.ts';

// two of Valdrada's live steel slots as describe-vk.mjs reads them (vk-irt and vk-parkBlue's option sets differ in
// paint, rust, chalk, corrugation and the light gains)
const STEEL_A: VkSteelDesc = {
  family: 'vkSteel', name: 'vk-a',
  uniforms: {
    vkPaint: [0.0612, 0.1274, 0.1046], vkPaint2: [0.0612, 0.1274, 0.1046], vkRustC: [0.2542, 0.0685, 0.0194], vkRustD: [0.0685, 0.0232, 0.0103],
    vkRustAmt: 0.6, vkGround: 3.38, vkSeed: 0, vkRivOn: 1, vkBand: [-1e4, 0, 0, 0], vkGuanoAmt: 0.55, vkChalk: 0, vkCorr: 0,
    vkSpecK: 0.45, vkAmbK: 1, vkDirK: 1, vkDnK: 0, vkGrime: 0,
  },
  roughness: 0.62, metalness: 0.08, st34K: 1.6, trim: { scale: [1, 1, 1], st34: true }, noShadow: false,
};
const STEEL_B: VkSteelDesc = {
  ...STEEL_A, name: 'vk-b',
  uniforms: { ...STEEL_A.uniforms, vkPaint: [0.02, 0.05, 0.3], vkPaint2: [0.03, 0.06, 0.28], vkRustAmt: 0.2, vkChalk: 0.2, vkCorr: 0.12, vkSpecK: 0.32, vkAmbK: 0.8, vkDnK: 1.2, vkGrime: 0.28, vkRivOn: 0 },
  roughness: 0.5, metalness: 0.2,
};
const base = {
  color: [0.5, 0.5, 0.5] as [number, number, number], roughness: 0.9, metalness: 0, opacity: 1, transparent: false, depthWrite: true,
  alphaTest: 0, side: 0, emissive: [0, 0, 0] as [number, number, number], emissiveIntensity: 1, trim: { scale: [1, 1, 1] as [number, number, number], st34: true }, noShadow: false,
};
const OTHERS: VkDesc[] = [
  { family: 'vkOther', ...base, name: 'vk-timber', color: [0.0685, 0.0467, 0.0307] },
  { family: 'vkLit', ...base, name: 'vkWin', emissive: [1, 0.69, 0.35], roughness: 0.4, noShadow: true, dayK: 0.18, nightK: 2.6 },
  {
    family: 'vkTex', ...base, name: 'vk-netting', color: [0.0103, 0.011, 0.0116], roughness: 0.95, opacity: 0.95, transparent: true, depthWrite: false, side: 2, noShadow: true,
    texture: { key: 'vk-netting', width: 4, height: 4, colorSpace: 'linear', repeat: [3.125, 3.125], wrapS: 1000, wrapT: 1000, anisotropy: 4 }, slots: ['alphaMap'],
  },
  {
    family: 'vkTex', ...base, name: 'vk-spikes', roughness: 0.32, metalness: 0.65, alphaTest: 0.45, side: 2,
    texture: { key: 'vk-spikes', width: 4, height: 4, colorSpace: 'srgb', repeat: [1, 1], wrapS: 1001, wrapT: 1001, anisotropy: 4 }, slots: ['map'],
  },
  {
    family: 'vkTex', ...base, name: 'vk-st34sign', color: [1, 1, 1], roughness: 0.45, metalness: 0.05, emissive: [1, 1, 1], emissiveIntensity: 0.12, trim: null,
    texture: { key: 'vk-st34sign', width: 4, height: 4, colorSpace: 'srgb', repeat: [1, 1], wrapS: 1001, wrapT: 1001, anisotropy: 4 }, slots: ['map', 'emissiveMap'],
  },
];

/** A vk face as vkKit.js writes it: uv in metres, aRv (W, e, c, p), aJ (L, seed). */
function face() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 2, 0, 0, 2, 0.3, 0, 0, 0.3, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 2, 0.3, 0, 0.3], 2));
  g.setAttribute('aRv', new THREE.Float32BufferAttribute(new Array(4).fill([0.3, 0.045, 0, 0.1]).flat(), 4));
  g.setAttribute('aJ', new THREE.Float32BufferAttribute(new Array(4).fill([2, 7]).flat(), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

function env(night: ReturnType<typeof THREE.TSL.uniform>): VkEnv {
  const tex = new Map<string, InstanceType<typeof THREE.DataTexture>>();
  return {
    night: night as never, physical: true,
    texture(key) {
      let t = tex.get(key);
      if (!t) { t = new THREE.DataTexture(new Uint8Array(4 * 4 * 4).fill(255), 4, 4); t.needsUpdate = true; tex.set(key, t); }
      return t as never;
    },
  };
}

async function frame(descs: VkDesc[], shared = THREE.TSL.uniform(0.5)) {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../../../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(64, 64), device } as never);
  await renderer.init();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(), new THREE.DirectionalLight());
  const e = env(shared);
  const mats = descs.map((d) => createVkMaterial(THREE as never, d, e));
  mats.forEach((m, i) => { const mesh = new THREE.Mesh(face(), m as never); mesh.position.x = i * 3; scene.add(mesh); });
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  // every face in frame (the driver culls)
  camera.position.set(1.5 * descs.length, 1, 6 * descs.length + 6);
  camera.lookAt(1.5 * descs.length, 0, 0);
  const empty = { pipelines: record.renderPipelines, modules: record.shaders.length };
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  return { record, mats, added: { pipelines: record.renderPipelines - empty.pipelines, modules: record.shaders.length - empty.modules } };
}

test('every vk family builds and draws', async () => {
  const { record, mats } = await frame([STEEL_A, ...OTHERS]);
  assert.equal(mats.length, 1 + OTHERS.length);
  assert.ok(record.draws >= 2 * mats.length, `${record.draws} draws for ${mats.length} meshes over two frames`);
  const vertex = record.shaders.filter((s) => s.includes('@vertex') && s.includes('aRv : vec4<f32>') && s.includes('aJ : vec2<f32>'));
  assert.equal(vertex.length, 1, 'one steel vertex shader reads aRv and aJ');
  // WGSL rejects derivatives in non-uniform control flow: the steel fragment's dpdx/dpdy/fwidth sit outside every if
  const fragment = record.shaders.find((s) => s.includes('@fragment') && s.includes('fwidth'))!;
  let depth = 0;
  for (const line of fragment.split('\n')) {
    // depth 1: a function body's own statements; 2 and up: inside an if
    if (/\b(dpdx|dpdy|fwidth)\(/.test(line)) assert.equal(depth, 1, `derivative inside a branch: ${line.trim()}`);
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
  }
});

test('two steel slots with different paint compile to one pipeline and identical shader code', async () => {
  const one = await frame([STEEL_A]);
  const two = await frame([STEEL_A, STEEL_B]);
  const other = await frame([STEEL_B]);
  assert.deepEqual(other.record.shaders, one.record.shaders, 'slot B alone generates exactly slot A\'s WGSL');
  assert.equal(two.added.pipelines, one.added.pipelines, `two slots: ${two.added.pipelines} pipelines, one slot: ${one.added.pipelines}`);
  assert.equal(two.added.modules, one.added.modules);
  // the per-slot values live on the material, where setRivBand writes them
  setVkRivBand(two.mats[1]!, 12, 3, 4, 5);
  const band = (two.mats[1]!.userData as { vk: { vkBand: { value: InstanceType<typeof THREE.Vector4> } } }).vk.vkBand.value;
  assert.deepEqual([band.x, band.y, band.z, band.w], [12, 3, 4, 25]);
});

test('shader modules added by every vk family stay small', async () => {
  const none = await frame([]);
  const all = await frame([STEEL_A, STEEL_B, ...OTHERS]);
  const modules = all.record.shaders.length - none.record.shaders.length;
  const pipelines = all.record.renderPipelines - none.record.renderPipelines;
  console.log(`vk families add ${modules} shader modules and ${pipelines} pipelines for ${all.mats.length} materials (2 steel slots)`);
  // six shaders: one steel graph for both slots, vkOther, vkLit and the three textured cards (alphaMap, map with alpha
  // test, map + emissiveMap), and a seventh pipeline for the netting's back faces (three draws a transparent DoubleSide
  // material in two passes); at most a vertex and a fragment module per pipeline
  const steel = all.record.pipelineVertexBuffers.filter((p) => /_vk-[ab]_/.test(p.label));
  assert.equal(steel.length, 1, `one steel pipeline for both slots (${steel.map((p) => p.label)})`);
  assert.ok(pipelines <= 7, `${pipelines} pipelines`);
  assert.ok(modules <= 2 * 7, `${modules} shader modules`);
  for (const s of all.record.shaders) assert.ok(!/normalize\(\s*cross\(/.test(s), 'no unguarded normalize(cross(...))');
});

// vkMats.js L46-L63 as Valdrada wrote it, branches and all
function glslRivet(u: number, v: number, rv: [number, number, number, number], L: number): [number, number, number] {
  const [W, e, c, p] = rv;
  if (Math.abs(p) < 1e-4) return [1e3, 1e3, 0];
  let ua: number;
  if (p > 0) ua = (Math.floor(u / p) + 0.5) * p;
  else ua = u < 0.5 * L ? -p : L + p;
  let va: number;
  if (c < 0) {
    const g = -c, nMax = Math.max(Math.floor((W - 2 * e) / g + 1e-3), 0);
    va = e + Math.min(Math.max(Math.floor((v - e) / g + 0.5), 0), nMax) * g;
  } else {
    va = 0.5 * W;
    let best = 1e3;
    if (e > 0) { const a = e, b = W - e; va = Math.abs(v - a) < Math.abs(v - b) ? a : b; best = Math.abs(v - va); }
    if (c > 0) { const a = 0.5 * W - c, b = 0.5 * W + c; const vb = Math.abs(v - a) < Math.abs(v - b) ? a : b; if (Math.abs(v - vb) < best) va = vb; }
  }
  return [u - ua, v - va, 1];
}

const num: RivetAlg<number, boolean> = {
  n: (v) => v, add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b, div: (a, b) => a / b,
  floor: Math.floor, abs: Math.abs, max: Math.max, clamp: (a, lo, hi) => Math.min(Math.max(a, lo), hi),
  lt: (a, b) => a < b, gt: (a, b) => a > b, and: (a, b) => a && b, sel: (c, a, b) => (c ? a : b),
};

test('vkRivet: the select form (shared with the TSL graph) equals Valdrada\'s branches', () => {
  // vkKit.js RIV specs on a 0.3 m face: none, edges, mid, pair, grid, ends; plus a both-rows face (e and c > 0)
  const specs: [number, number, number, number][] = [
    [0.3, 0, 0, 0], [0.3, 0.045, 0, 0.1], [0.3, 0, 0, 0.1], [0.3, 0, 0.07, 0.1], [0.3, 0.05, -0.09, 0.09], [0.3, 0, 0, -0.05],
    [0.3, 0.04, 0.05, 0.12], [0.012, 0, 0, 0.1],
  ];
  let n = 0;
  for (const rv of specs) for (let i = 0; i <= 40; i++) for (let j = 0; j <= 12; j++) {
    const u = -0.1 + i * 0.061, v = -0.02 + j * 0.029, L = 2.37;
    const want = glslRivet(u, v, rv, L);
    const got = vkRivet(num, u, v, rv[0], rv[1], rv[2], rv[3], L);
    assert.deepEqual(got, want, `rv ${rv} at (${u}, ${v})`);
    n++;
  }
  assert.ok(n > 4000);
});
