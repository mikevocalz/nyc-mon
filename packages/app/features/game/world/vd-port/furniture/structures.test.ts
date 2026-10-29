// Lane C structures (vk, pk, lk): the packages decode, stay inside the square and the caps (disk 25 MB, JS bundle 3 MB,
// 250k resident vertices on the iPad tier), stream near / far / nothing by distance, and the whole lane builds within
// the GPU budgets with everything on.
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { valdradaToScene } from '../transform.ts';
import { decodePlacements, decodeProto } from './cell-package.ts';
import { VD_STRUCTURES } from './data/structures.ts';
import { STRUCTURE_LIMITS } from './structures.ts';
import { diskAssets, readAsset } from './disk-assets.test-support.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORIGIN = [-73.94975, 40.81005] as const;
const EXTENT = 850;

test('every cell package decodes, every placement and prototype is inside the square', () => {
  const shared = readAsset('assets/protos.bin');
  let placements = 0;
  for (const c of VD_STRUCTURES.cells) {
    const buf = readAsset(`cells/${c.key}.bin`);
    assert.equal(buf.byteLength, c.bytes, `${c.key} size`);
    const list = decodePlacements(buf, c, VD_STRUCTURES.placementBytes);
    assert.equal(list.length, c.placements);
    for (const p of list) {
      const meta = VD_STRUCTURES.protos[p.proto]!;
      const pr = decodeProto(meta.file === '' ? shared : buf, meta);
      assert.equal(pr.position.length, meta.vertices * 3);
      const x = p.m[3]!, z = p.m[11]!;
      assert.ok(Math.abs(x) <= EXTENT + 64 && Math.abs(z) <= EXTENT + 64, `${c.key}: a placement at ${x}, ${z}`);
      placements++;
    }
    for (const v of c.bounds) assert.ok(Number.isFinite(v), `${c.key} bounds`);
  }
  assert.ok(placements > 10_000, `${placements} placements`);
});

test('the parts are all there: the Manhattan Valley viaduct and station, Park Avenue, the 125th Street props and life', () => {
  const families = new Set(VD_STRUCTURES.slots.map((s) => s.family));
  for (const f of ['vkSteel', 'pbr', 'std']) assert.ok(families.has(f), `no ${f} slot`);
  const parts = new Set(VD_STRUCTURES.slots.map((s) => (s as { part?: string }).part).filter(Boolean));
  assert.ok(parts.has('pk') && parts.has('lk'), `parts ${[...parts]}`);
  const names = VD_STRUCTURES.slots.map((s) => s.name ?? '');
  assert.ok(names.some((n) => n.startsWith('vk-irt')), 'the IRT (Manhattan Valley) steel');
  assert.ok(names.some((n) => n.startsWith('vk-park')), 'the Park Avenue steel');
});

test('caps: packages on disk <= 25 MB, the lane\'s JS data <= 3 MB, one cell\'s near level under the resident cap', () => {
  let disk = statSync(join(HERE, 'assets/protos.bin')).size;
  for (const f of readdirSync(join(HERE, 'cells'))) if (f.endsWith('.bin')) disk += statSync(join(HERE, 'cells', f)).size;
  assert.ok(disk <= 25 * 1e6, `${(disk / 1e6).toFixed(1)} MB of packages`);
  let js = 0;
  for (const f of readdirSync(HERE)) if (f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.includes('test-support')) js += statSync(join(HERE, f)).size;
  for (const f of readdirSync(join(HERE, 'data'))) if (f !== 'placement-fixture.ts') js += statSync(join(HERE, 'data', f)).size;
  js += statSync(join(HERE, 'cells/index.ts')).size;
  assert.ok(js <= 3 * 1e6, `${(js / 1e6).toFixed(2)} MB of JS`);
  const worst = Math.max(...VD_STRUCTURES.cells.map((c) => c.near));
  assert.ok(worst < STRUCTURE_LIMITS.maxVertices, `the densest cell's near level is ${worst} vertices`);
  console.log(`packages ${(disk / 1e6).toFixed(2)} MB, lane JS ${(js / 1e6).toFixed(2)} MB, densest near cell ${worst} vertices`);
});

async function streamAlong(path: readonly (readonly [number, number])[]) {
  const group = new THREE.Group();
  const { build } = await import('./index.ts');
  const part = build({
    THREE: THREE as never, group: group as never, night: THREE.TSL.uniform(0) as never, physical: true, groundY: () => 0.14,
    toScene: valdradaToScene(ORIGIN), inBounds: () => true, register: () => {}, registerChunks: () => {}, env: {} as never, preset: null,
  }, { assets: diskAssets() });
  await part.ready;
  const s = part.structures()!;
  const camera = new THREE.PerspectiveCamera(60, 1.5, 0.5, 2000);
  const seen: { vertices: number; near: number; far: number }[] = [];
  let t = 0;
  for (const [x, z] of path) {
    camera.position.set(x, 1.7, z);
    camera.updateMatrixWorld();
    // frames per stop with the packages' promises settling in between
    for (let k = 0; k < 180; k++) {   // 6 s: past evictAfterS + fadeS
      s.frame(camera, (t += 1 / 30));
      await new Promise((r) => setImmediate(r));
    }
    seen.push(s.stats());
  }
  return { part, s, seen, group };
}

test('streaming: near within 60 m, far beyond, nothing past 360 m, never over 250k resident vertices', async () => {
  const mvv = (VD_STRUCTURES.anchors as Record<string, { scene: [number, number] }>).mvv!.scene;
  const { part, s, seen, group } = await streamAlong([mvv, [mvv[0] + 300, mvv[1] + 120], [0, 0], [600, 400]]);
  for (const st of seen) assert.ok(st.vertices <= STRUCTURE_LIMITS.maxVertices, `${st.vertices} resident vertices`);
  assert.ok(seen[0]!.near > 0, 'near cells at the Manhattan Valley arch');
  // the meshes in the group are the resident cells; none of them is past the radius from the last stop
  const last = new THREE.Vector3(600, 1.7, 400);
  for (const m of group.children) {
    if (!m.name.startsWith('vd-structure:')) continue;
    const box = (m as InstanceType<typeof THREE.Mesh>).geometry.boundingBox!;
    assert.ok(box.distanceToPoint(last) <= STRUCTURE_LIMITS.radiusM / STRUCTURE_LIMITS.hysteresis + 1, `${m.name} resident ${box.distanceToPoint(last).toFixed(0)} m out`);
  }
  console.log(`streaming stops: ${seen.map((x) => `${x.vertices} v / ${x.near} near / ${x.far} far`).join(' | ')}`);
  s.dispose();
  part.dispose();
});

test('GPU budget with everything on: pools and streamed structures, the sun casting', async () => {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../../../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(64, 64), device } as never);
  await renderer.init();
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.position.set(-300, 400, 300);
  scene.add(new THREE.HemisphereLight(), sun);
  const baseline = { modules: 0, pipelines: 0 };
  renderer.render(scene, new THREE.PerspectiveCamera());
  baseline.modules = record.shaders.length; baseline.pipelines = record.renderPipelines;
  const group = new THREE.Group();
  scene.add(group);
  const { build } = await import('./index.ts');
  const part = build({
    THREE: THREE as never, group: group as never, night: THREE.TSL.uniform(1) as never, physical: true, groundY: () => 0.14,
    toScene: valdradaToScene(ORIGIN), inBounds: () => true, register: () => {}, registerChunks: () => {}, env: {} as never, preset: null,
  }, { assets: diskAssets() });
  await part.ready;
  const mvv = (VD_STRUCTURES.anchors as Record<string, { scene: [number, number] }>).mvv!.scene;
  const camera = new THREE.PerspectiveCamera(60, 1.5, 0.5, 2000);
  camera.position.set(mvv[0] + 20, 6, mvv[1] + 30);
  camera.lookAt(mvv[0], 8, mvv[1]);
  for (let k = 0; k < 60; k++) {
    part.update!(k / 30);
    renderer.render(scene, camera);
    await new Promise((r) => setImmediate(r));
  }
  const drawn = group.children.filter((m) => m.visible && m.name.startsWith('vd-structure:')).length;
  const added = { modules: record.shaders.length - baseline.modules, pipelines: record.renderPipelines - baseline.pipelines };
  console.log(`structures drawn ${drawn} meshes; lane C added ${added.modules} shader modules, ${added.pipelines} pipelines`);
  assert.ok(drawn > 0, 'structures streamed in and drew');
  assert.ok(added.modules <= 90 && added.pipelines <= 90, `${added.modules} modules, ${added.pipelines} pipelines`);
  part.dispose();
});
