// Lane C: the baked furniture against Valdrada's own placements, the pooled instancer's cull against a brute-force
// sphere test, and the GPU budget (one pipeline per material kind, shader modules, texture bytes).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { valdradaToScene } from '../transform.ts';
import { decodeAtlas, decodeInstances, INSTANCE_FLOATS } from './pool-data.ts';
import { cullPool, indexCells, type CullView } from './pool-cull.ts';
import { VD_POOLS } from './data/instances.ts';
import { VD_POOL_GEOMETRY } from './data/geometry.ts';
import { VD_PLACEMENT_SAMPLES } from './data/placement-fixture.ts';
import { VD_PANEL_ATLAS } from './data/panel-atlas.ts';
import { vdLampSites } from './index.ts';

const ORIGIN = [-73.94975, 40.81005] as const;
const flat = () => 0;

test('every baked instance sits where Valdrada claimed it, within 5 cm (every pool)', () => {
  const toScene = valdradaToScene(ORIGIN);
  for (const pool of VD_POOLS) {
    const samples = VD_PLACEMENT_SAMPLES[pool.name];
    assert.ok(samples && samples.length > 0, `${pool.name}: no placement samples`);
    const inst = decodeInstances(pool, flat);
    for (const [vx, vz] of samples) {
      const [x, z] = toScene(vx!, vz!);
      let best = Infinity;
      for (let i = 0; i < inst.count; i++) {
        best = Math.min(best, Math.hypot(inst.record[i * INSTANCE_FLOATS]! - x, inst.record[i * INSTANCE_FLOATS + 2]! - z));
      }
      assert.ok(best <= 0.05, `${pool.name}: Valdrada (${vx}, ${vz}) -> (${x.toFixed(3)}, ${z.toFixed(3)}), nearest instance ${best.toFixed(3)} m`);
    }
  }
});

test('the street-sign poles are Valdrada\'s placements: no two poles at one spot', () => {
  const poles: [number, number, string][] = [];
  for (const pool of VD_POOLS.filter((p) => p.name === 'signPole' || p.name === 'signPoleOneWay' || p.name === 'streetSign')) {
    const inst = decodeInstances(pool, flat);
    for (let i = 0; i < inst.count; i++) poles.push([inst.record[i * INSTANCE_FLOATS]!, inst.record[i * INSTANCE_FLOATS + 2]!, pool.name]);
  }
  assert.ok(poles.length > 100, `${poles.length} poles`);
  const grid = new Map<string, [number, number, string][]>();
  for (const p of poles) {
    const k = `${Math.floor(p[0] / 2)}_${Math.floor(p[1] / 2)}`;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const q of grid.get(`${Math.floor(p[0] / 2) + dx}_${Math.floor(p[1] / 2) + dz}`) ?? []) {
        assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.3, `${p[2]} and ${q[2]} at (${p[0].toFixed(2)}, ${p[1].toFixed(2)})`);
      }
    }
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(p);
  }
});

test('street pieces stand on the ground they are given; roof pieces keep their baked height', () => {
  const hydrant = VD_POOLS.find((p) => p.name === 'hydrant')!;
  const a = decodeInstances(hydrant, () => 0), b = decodeInstances(hydrant, () => 0.14);
  for (let i = 0; i < a.count; i++) assert.ok(Math.abs(b.record[i * INSTANCE_FLOATS + 1]! - a.record[i * INSTANCE_FLOATS + 1]! - 0.14) < 1e-6);
  const tank = VD_POOLS.find((p) => p.name === 'waterTower')!;
  const c = decodeInstances(tank, () => 0), d = decodeInstances(tank, () => 0.14);
  for (let i = 0; i < c.count; i++) {
    assert.equal(c.record[i * INSTANCE_FLOATS + 1], d.record[i * INSTANCE_FLOATS + 1]);
    assert.ok(c.record[i * INSTANCE_FLOATS + 1]! > 4, 'a water tank stands on a roof');
  }
});

test('the lamp sites are one per cobra head', () => {
  const cobra = VD_POOLS.find((p) => p.name === 'lampCobra')!;
  const sites = vdLampSites();
  assert.equal(sites.length, cobra.count + (VD_POOLS.find((p) => p.name === 'lampCrook')?.count ?? 0));
  for (const s of sites) assert.ok(s.kind >= -1 && s.kind <= 3 && s.head > 5);
});

test('the pool cull draws exactly the instances whose sphere meets the padded frustum (and the roof rule)', () => {
  const camera = new THREE.PerspectiveCamera(60, 1.5, 0.5, 900);
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
  for (const [name, pos, look] of [
    ['hydrant', [0, 1.7, 0], [40, 1.5, 30]],
    ['roofAC', [10, 1.7, -20], [200, 20, -300]],
    ['roofAC', [10, 160, -20], [200, 0, -300]],
    ['lampCobra', [-300, 30, 200], [0, 0, 0]],
  ] as const) {
    const pool = VD_POOLS.find((p) => p.name === name)!;
    const inst = decodeInstances(pool, flat);
    const radius = VD_POOL_GEOMETRY[name]!.radius;
    const index = indexCells(inst.record, inst.count, radius);
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(look[0], look[1], look[2]);
    camera.updateMatrixWorld();
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    const planes = new Float32Array(24);
    frustum.planes.forEach((p, i) => { planes.set([p.normal.x, p.normal.y, p.normal.z, p.constant], i * 4); });
    const view: CullView = { planes, x: pos[0], y: pos[1], z: pos[2] };
    const near = new Float32Array(inst.count * INSTANCE_FLOATS);
    const [n] = cullPool(index, view, { pad: 4, roofLow: pool.roofLow, lodDistance: Infinity }, near, null);
    // brute force, instancer.js's own per-instance test
    let want = 0;
    const s = new THREE.Sphere();
    for (let i = 0; i < inst.count; i++) {
      const o = i * INSTANCE_FLOATS;
      s.center.set(inst.record[o]!, inst.record[o + 1]!, inst.record[o + 2]!);
      s.radius = radius * inst.record[o + 7]! + 4;
      if (!frustum.intersectsSphere(s)) continue;
      const dx = s.center.x - pos[0], dz = s.center.z - pos[2];
      if (pool.roofLow && pos[1] < s.center.y - 1.5 && dx * dx + dz * dz > 625) continue;
      want++;
    }
    assert.equal(n, want, `${name} from ${pos}: ${n} drawn, ${want} expected`);
  }
});

test('GPU budget: one pipeline per material kind across every pool, few shader modules, texture growth', async () => {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../../../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(64, 64), device } as never);
  await renderer.init();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight());
  const group = new THREE.Group();
  scene.add(group);
  const { build } = await import('./index.ts');
  const night = THREE.TSL.uniform(0.5);
  const part = build({
    THREE: THREE as never, group: group as never, night: night as never, physical: true, groundY: () => 0.14,
    toScene: valdradaToScene(ORIGIN), inBounds: () => true, register: () => {},
  });
  // a high oblique view over the square: every material kind in frame
  const camera = new THREE.PerspectiveCamera(70, 1.5, 1, 4000);
  camera.position.set(-200, 400, 600);
  camera.lookAt(0, 0, 0);
  const before = record.renderPipelines;
  renderer.render(scene, camera);   // the driver culls: the pools with instances in view show
  renderer.render(scene, camera);   // ...and draw
  const kinds = new Set(VD_POOLS.map((p) => p.material));
  const visible = group.children.filter((m) => m.visible).length;
  assert.ok(visible > 20, `${visible} pools in view`);
  const pipelines = record.renderPipelines - before;
  console.log(`pools drawn ${visible}, pipelines ${pipelines}, shader modules ${record.shaders.length}, draws ${record.draws}`);
  assert.ok(record.draws >= visible, `${record.draws} draws for ${visible} visible pools`);
  assert.ok(pipelines >= 2, `the lit and the glow shader built (${pipelines})`);
  // five kinds, two shaders (materials.ts: the lit kinds and the glow kinds differ only in uniforms); the frame's
  // output pass and its quad come on top
  assert.ok(pipelines <= 4, `${pipelines} pipelines for ${visible} pools of ${kinds.size} material kinds`);
  assert.ok(record.shaders.length <= 12 + 2, `${record.shaders.length} shader modules`);
  part.dispose();
  // the one texture this lane adds: the panel atlas, RGBA8 with its mip chain
  const atlasBytes = decodeAtlas(VD_PANEL_ATLAS).byteLength * (4 / 3);
  assert.ok(atlasBytes <= 16 * 1024 * 1024, `${(atlasBytes / 1048576).toFixed(1)} MB`);
});

test('GPU budget with the sun casting: the shadow pass adds one depth pipeline for the lit shader, modules stay within 12', async () => {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../../../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const count = async (withPools: boolean) => {
    const { device, record } = recordingGpuDevice();
    const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(64, 64), device } as never);
    await renderer.init();
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight();
    sun.castShadow = true;
    sun.position.set(-300, 400, 300);
    scene.add(new THREE.HemisphereLight(), sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshStandardNodeMaterial());
    ground.receiveShadow = true;
    scene.add(ground);
    const group = new THREE.Group();
    scene.add(group);
    const { build } = await import('./index.ts');
    const part = withPools ? build({
      THREE: THREE as never, group: group as never, night: THREE.TSL.uniform(0) as never, physical: true, groundY: () => 0.14,
      toScene: valdradaToScene(ORIGIN), inBounds: () => true, register: () => {},
    }) : null;
    const camera = new THREE.PerspectiveCamera(70, 1.5, 1, 4000);
    camera.position.set(-200, 400, 600);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    renderer.render(scene, camera);
    part?.dispose();
    return { modules: record.shaders.length, pipelines: record.renderPipelines };
  };
  const without = await count(false), withPools = await count(true);
  const added = { modules: withPools.modules - without.modules, pipelines: withPools.pipelines - without.pipelines };
  console.log(`added by the pools: ${added.modules} shader modules, ${added.pipelines} pipelines`);
  assert.ok(added.modules <= 12, `${added.modules} shader modules added`);
  assert.ok(added.pipelines <= 5, `${added.pipelines} pipelines added (the lit and glow shaders and their shadow-pass variants)`);
});
