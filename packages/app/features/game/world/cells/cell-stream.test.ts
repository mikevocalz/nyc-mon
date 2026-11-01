import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { Three } from '@acme/ui/three';
import { WORLD_PRESETS, type WorldPreset } from '../../perf/tier-presets.ts';
import { createCellStream } from './cell-stream.ts';
import type { CellPackage } from './cell-rules.ts';

const T = THREE as unknown as Three;

/** A street-detail layer: one small triangle in each 256 m chunk along x, at z = 10. */
function detailLayer(chunks: number, material = new THREE.MeshStandardNodeMaterial()) {
  const pos: number[] = [];
  for (let i = 0; i < chunks; i++) {
    const x = i * 256 + 10;
    pos.push(x, 0, 10, x + 2, 0, 10, x, 1, 12);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map(() => 0), 3));
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'city:street-detail';
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return { group, mesh, material, source: g };
}

const preset = (over: Partial<WorldPreset> = {}): WorldPreset => ({ ...WORLD_PRESETS['ipad-a12x'], ...over });
/** K for a 2048 px tall buffer at fov 50. */
const K = 2048 / (2 * Math.tan((50 * Math.PI) / 360));
const cells = (group: THREE.Group) => group.children.filter((o) => o.userData.cell !== undefined) as THREE.Mesh[];

function trianglePackage(over: Partial<CellPackage> & Pick<CellPackage, 'num' | 'bounds' | 'attributes'>): CellPackage {
  return {
    cx: 0, cz: 0, size: 128, vertexCount: 3, triangles: 1, bytes: 54, index: new Uint16Array([0, 1, 2]),
    ...over,
  };
}

function externalFixture(material = new THREE.MeshStandardNodeMaterial()) {
  const root = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(12).fill(255), 4, true));
  const template = new THREE.Mesh(geometry, material);
  template.name = 'vd:test-framed';
  root.add(template);
  const spec = { errorM: 1, chunk: 128, fade: false, pin: false, sharedMaterial: true, reachM: 100 };
  return { root, template, material, spec };
}

test('packages the layer, drops the source geometry and keeps a one-triangle template with the same layout', () => {
  const { group, mesh, source } = detailLayer(4);
  let disposed = 0;
  source.addEventListener('dispose', () => { disposed++; });
  const stream = createCellStream(T, [mesh], { preset: preset() });
  assert.equal(disposed, 1, 'the full-tile geometry is disposed before upload');
  assert.equal(stream.stats.packages, 4);
  assert.notEqual(mesh.geometry, source);
  assert.deepEqual(Object.keys(mesh.geometry.attributes).sort(), ['normal', 'position']);
  assert.equal(mesh.geometry.getAttribute('position').count, 3);
  assert.equal(cells(group).length, 0);
  assert.ok((mesh.material as THREE.Material & { maskNode: unknown }).maskNode, 'the fade mask is on the material');
});

test('prime builds the START set only, and update streams the rest nearest first within the per-frame budget', () => {
  const { group, mesh } = detailLayer(3);
  // 0.25 m * K / 2 px reaches ~275 m: chunks at x 10 and 266 are wanted from x = 0, the one at 522 is not.
  const stream = createCellStream(T, [mesh], { preset: preset({ stream: { msPerFrame: 1e9, uploadBytesPerFrame: 1 } }) });
  stream.prime({ x: 0, y: 2, z: 10 }, K, 100);
  assert.equal(cells(group).length, 1, 'only the chunk within the start radius');
  assert.equal(cells(group)[0]!.castShadow, true, 'a cell copies the template');
  assert.equal(stream.stats.pending, 1);
  assert.equal(stream.update({ x: 0, y: 2, z: 10 }, K, 0), true, 'work left: the fade and the pending cell');
  assert.equal(cells(group).length, 2);
  assert.equal(stream.stats.pending, 0);
});

test('a near cell fades in over fadeS, and the template hides from the second update', () => {
  const { group, mesh } = detailLayer(2);
  const stream = createCellStream(T, [mesh], { preset: preset({ fadeS: 0.5 }) });
  stream.prime({ x: 0, y: 2, z: 10 }, K, 0);
  stream.update({ x: 0, y: 2, z: 10 }, K, 0);
  const cell = cells(group).find((c) => c.geometry.boundingBox!.min.x < 100)!;
  assert.equal(cell.userData.cellFade, 0);
  assert.equal(mesh.visible, true, 'the template draws through the START compile and the first frame');
  // Frames 50 ms apart (a frame's dt is capped at 0.1 s, as Valdrada caps it).
  for (let i = 1; i <= 5; i++) stream.update({ x: 0, y: 2, z: 10 }, K, i * 0.05);
  assert.ok(Math.abs(cell.userData.cellFade - 0.5) < 1e-9, String(cell.userData.cellFade));
  assert.equal(mesh.visible, false);
  for (let i = 6; i <= 11; i++) stream.update({ x: 0, y: 2, z: 10 }, K, i * 0.05);
  assert.equal(cell.userData.cellFade, 1);
});

test('eviction waits evictAfterS past the hysteresis, fades out, then disposes the geometry and the render objects', () => {
  const { group, mesh } = detailLayer(1);
  const stream = createCellStream(T, [mesh], { preset: preset({ fadeS: 0.1, evictAfterS: 4 }) });
  stream.prime({ x: 0, y: 2, z: 10 }, K, 1000);
  const cell = cells(group)[0]!;
  let geometryDisposed = 0, objectDisposed = 0;
  cell.geometry.addEventListener('dispose', () => { geometryDisposed++; });
  cell.addEventListener('dispose' as never, () => { objectDisposed++; });
  // 300 m out: the 0.25 m layer's error is 0.25 * K / 290 ~ 1.9 px, under the 2 px threshold but over 0.8 x it.
  stream.update({ x: 300, y: 2, z: 10 }, K, 0);
  stream.update({ x: 300, y: 2, z: 10 }, K, 10);
  assert.equal(cells(group).length, 1, 'kept inside the hysteresis band');
  // 1000 m out: unwanted. It stays for evictAfterS, then fades and goes.
  stream.update({ x: 1000, y: 2, z: 10 }, K, 20);
  stream.update({ x: 1000, y: 2, z: 10 }, K, 23);
  assert.equal(cells(group).length, 1, 'not before evictAfterS');
  stream.update({ x: 1000, y: 2, z: 10 }, K, 24.01);
  for (let t = 24.05; t < 24.5; t += 0.05) stream.update({ x: 1000, y: 2, z: 10 }, K, t);
  assert.equal(cells(group).length, 0);
  assert.equal(geometryDisposed, 1);
  assert.equal(objectDisposed, 1);
  assert.equal(stream.stats.evictions, 1);
  assert.equal(stream.stats.bytes, 0);
});

test('a pinned chunk is built at prime and never evicted', () => {
  const { group, mesh } = detailLayer(3);
  const stream = createCellStream(T, [mesh], {
    preset: preset({ evictAfterS: 0 }),
    pinned: (x0) => x0 === 512,
  });
  stream.prime({ x: 0, y: 2, z: 10 }, K, 0);
  assert.equal(cells(group).length, 1);
  for (let t = 0; t < 10; t += 0.5) stream.update({ x: -5000, y: 2, z: 10 }, K, t);
  assert.equal(cells(group).length, 1);
  assert.ok(cells(group)[0]!.geometry.boundingBox!.min.x >= 512);
});

test('the budget refuses a load rather than exceed it', () => {
  const { group, mesh } = detailLayer(3);
  const stream = createCellStream(T, [mesh], { preset: preset({ residentRadiusM: 5000, budget: { geometryBytes: 1e9, cellDraws: 1, triangles: 1e9 } }) });
  // Every chunk wanted at this K.
  stream.prime({ x: 300, y: 2, z: 10 }, K * 100, 5000);
  assert.equal(cells(group).length, 1);
  assert.equal(stream.stats.overBudget, 2);
});

test('a material other meshes share is cloned for the fade mask, and disposed with the stream', () => {
  const shared = new THREE.MeshStandardNodeMaterial();
  const { group, mesh } = detailLayer(1, shared);
  const roofs = new THREE.Mesh(new THREE.BufferGeometry(), shared);
  group.add(roofs);
  const stream = createCellStream(T, [mesh], { preset: preset() });
  assert.notEqual(mesh.material, shared);
  assert.equal((shared as THREE.Material & { maskNode: unknown }).maskNode, null, 'the shared material keeps no mask');
  let disposed = 0;
  (mesh.material as THREE.Material).addEventListener('dispose', () => { disposed++; });
  stream.dispose();
  assert.equal(disposed, 1);
});

test('layers it does not stream are left whole', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
  const walls = new THREE.Mesh(g, new THREE.MeshStandardNodeMaterial());
  walls.name = 'city:walls-masonry';
  new THREE.Group().add(walls);
  const stream = createCellStream(T, [walls], { preset: preset() });
  assert.equal(stream.stats.packages, 0);
  assert.equal(walls.geometry, g);
});

test('cell-local and absolute external packages share one material and layout, with local bounds and reconstructable world positions', () => {
  const f = externalFixture();
  const origin = [48960, 0, -48960] as const;
  const localPosition = new Float32Array([39.999, 0, -40.001, 40.001, 0, -40.001, 39.999, 1, -39.999]);
  const local = trianglePackage({
    num: 1, positionFrame: { kind: 'cell-local', origin },
    attributes: {
      position: { array: localPosition, itemSize: 3, normalized: false },
      color: { array: new Uint8Array(12).fill(255), itemSize: 4, normalized: true },
    },
    bounds: Float64Array.from([48999.999, 0, -49000.001, 49000.001, 1, -48999.999]),
  });
  const absolutePosition = new Float32Array([49010, 0, -49010, 49012, 0, -49010, 49010, 1, -49008]);
  const absolute = trianglePackage({
    num: 2,
    attributes: {
      position: { array: absolutePosition, itemSize: 3, normalized: false },
      color: { array: new Uint8Array(12).fill(128), itemSize: 4, normalized: true },
    },
    bounds: Float64Array.from([49010, 0, -49010, 49012, 1, -49008]),
  });
  const stream = createCellStream(T, [], {
    preset: preset({ residentRadiusM: 1000 }),
    external: [{ template: f.template, spec: f.spec, packages: [local, absolute] }],
  });
  stream.prime({ x: 49000, y: 0, z: -49000 }, K, 1000);
  const built = cells(f.root);
  assert.equal(built.length, 2);
  const localMesh = built.find((m) => m.userData.cell === 1)!;
  const absoluteMesh = built.find((m) => m.userData.cell === 2)!;
  assert.equal(localMesh.material, f.material);
  assert.equal(absoluteMesh.material, f.material);
  assert.deepEqual(Object.keys(localMesh.geometry.attributes), Object.keys(absoluteMesh.geometry.attributes));
  assert.equal(localMesh.matrixAutoUpdate, false);
  assert.equal(absoluteMesh.matrixAutoUpdate, false);
  assert.deepEqual([localMesh.position.x, localMesh.position.y, localMesh.position.z], [...origin]);
  assert.deepEqual([absoluteMesh.position.x, absoluteMesh.position.y, absoluteMesh.position.z], [0, 0, 0]);
  assert.deepEqual([localMesh.matrix.elements[12], localMesh.matrix.elements[13], localMesh.matrix.elements[14]], [...origin]);
  assert.ok(Math.abs(localMesh.geometry.boundingBox!.min.x - 39.999) < 1e-5);
  assert.ok(Math.abs(localMesh.geometry.boundingBox!.max.z + 39.999) < 1e-5);
  assert.equal(absoluteMesh.geometry.boundingBox!.min.x, 49010);
  localMesh.updateMatrixWorld(true);
  const v = new THREE.Vector3(localPosition[0], localPosition[1], localPosition[2]).applyMatrix4(localMesh.matrixWorld);
  assert.ok(Math.abs(v.x - 48999.999) <= 0.05);
  assert.ok(Math.abs(v.z + 49000.001) <= 0.05);
  stream.dispose();
});

test('a lazy local package keeps absolute stream bounds, decodes after ready, and preserves its origin across eviction and rebuild', () => {
  const f = externalFixture();
  const origin = [-49024, 3, 49024] as const;
  let ready = false;
  let prefetches = 0;
  const local = trianglePackage({
    num: 7, positionFrame: { kind: 'cell-local', origin },
    attributes: {
      position: { array: new Float32Array([24, -3, -24, 26, -3, -24, 24, -2, -22]), itemSize: 3, normalized: false },
      color: { array: new Uint8Array(12).fill(255), itemSize: 4, normalized: true },
    },
    bounds: Float64Array.from([-49000, 0, 49000, -48998, 1, 49002]),
    ready: () => ready,
    prefetch: () => { prefetches++; },
  });
  const stream = createCellStream(T, [], {
    preset: preset({ residentRadiusM: 1000, evictAfterS: 0, stream: { msPerFrame: 1e9, uploadBytesPerFrame: 1e9 } }),
    external: [{ template: f.template, spec: f.spec, packages: [local] }],
  });
  const camera = { x: -49000, y: 0, z: 49000 };
  stream.prime(camera, K, 1000);
  assert.equal(cells(f.root).length, 0);
  assert.equal(prefetches, 1);
  assert.equal(stream.stats.fetching, 1);
  assert.deepEqual(local.bounds, Float64Array.from([-49000, 0, 49000, -48998, 1, 49002]));
  ready = true;
  stream.update(camera, K, 1);
  const first = cells(f.root)[0]!;
  assert.deepEqual([first.position.x, first.position.y, first.position.z], [...origin]);
  stream.update({ x: 200000, y: 0, z: 200000 }, K, 2);
  stream.update({ x: 200000, y: 0, z: 200000 }, K, 3);
  assert.equal(cells(f.root).length, 0);
  stream.update(camera, K, 4);
  const rebuilt = cells(f.root)[0]!;
  assert.notEqual(rebuilt, first);
  assert.deepEqual([rebuilt.position.x, rebuilt.position.y, rebuilt.position.z], [...origin]);
  assert.ok(Math.abs(rebuilt.geometry.boundingBox!.min.x - 24) < 1e-5);
  assert.ok(Math.abs(rebuilt.geometry.boundingBox!.min.z + 24) < 1e-5);
  assert.equal(rebuilt.material, f.material);
  stream.dispose();
});

test('a prefetch that reports by promise lets the canvas rest, then wakes it once on arrival; a failed one never wakes', async () => {
  const f = externalFixture();
  let ready = false;
  let resolve!: (landed: boolean) => void;
  const fetch = new Promise<boolean>((r) => { resolve = r; });
  const polled = trianglePackage({
    num: 9, bounds: Float64Array.from([-49000, 0, 49000, -48998, 1, 49002]),
    attributes: {
      position: { array: new Float32Array([24, -3, -24, 26, -3, -24, 24, -2, -22]), itemSize: 3, normalized: false },
      color: { array: new Uint8Array(12).fill(255), itemSize: 4, normalized: true },
    },
    ready: () => ready,
    prefetch: () => fetch,
  });
  let wakes = 0;
  const stream = createCellStream(T, [], {
    preset: preset({ residentRadiusM: 1000, evictAfterS: 0, stream: { msPerFrame: 1e9, uploadBytesPerFrame: 1e9 } }),
    external: [{ template: f.template, spec: f.spec, packages: [polled] }],
    wake: () => { wakes++; },
  });
  const camera = { x: -49000, y: 0, z: 49000 };
  stream.prime(camera, K, 1000);
  assert.equal(stream.stats.fetching, 1);
  assert.equal(stream.update(camera, K, 1), false, 'bytes on their way through a promise do not hold the frame loop');
  assert.equal(wakes, 0);
  ready = true;
  resolve(true);
  await fetch;
  await Promise.resolve();
  assert.equal(wakes, 1, 'arrival asks for one frame');
  assert.equal(stream.update(camera, K, 1.01), false);
  assert.equal(cells(f.root).length, 1, 'the landed cell builds on that frame even inside the 0.25 s re-pick window');
  stream.dispose();

  const g = externalFixture();
  const failed = Promise.resolve(false);
  const lost = trianglePackage({
    num: 10, bounds: Float64Array.from([-49000, 0, 49000, -48998, 1, 49002]),
    attributes: {
      position: { array: new Float32Array([24, -3, -24, 26, -3, -24, 24, -2, -22]), itemSize: 3, normalized: false },
      color: { array: new Uint8Array(12).fill(255), itemSize: 4, normalized: true },
    },
    ready: () => false,
    prefetch: () => failed,
  });
  let lostWakes = 0;
  const s2 = createCellStream(T, [], {
    preset: preset({ residentRadiusM: 1000, evictAfterS: 0, stream: { msPerFrame: 1e9, uploadBytesPerFrame: 1e9 } }),
    external: [{ template: g.template, spec: g.spec, packages: [lost] }],
    wake: () => { lostWakes++; },
  });
  s2.prime(camera, K, 1000);
  await failed;
  await Promise.resolve();
  assert.equal(s2.update(camera, K, 1), false);
  assert.equal(lostWakes, 0, 'a fetch that ends without bytes (no host, host down) never loops the canvas');
  s2.dispose();
});

test('a layer with pin: false is not pinned by the landmark rule and evicts; the default layer stays pinned', () => {
  const pinnedLayer = detailLayer(2);
  const detail = detailLayer(2, new THREE.MeshStandardNodeMaterial());
  detail.mesh.name = 'vd:test-unpinned';
  detail.mesh.userData.cellLayer = { errorM: 0.25, chunk: 256, fade: false, pin: false };
  const root = new THREE.Group();
  root.add(pinnedLayer.mesh, detail.mesh);
  const stream = createCellStream(T, [pinnedLayer.mesh, detail.mesh], { preset: preset({ evictAfterS: 0 }), pinned: () => true });
  stream.prime({ x: 10, y: 1.7, z: 10 }, K, 100);
  const byName = (n: string) => root.children.filter((o) => o.name === n && o.userData.cell !== undefined).length;
  assert.equal(byName('city:street-detail'), 2, 'the default layer is pinned everywhere: all its cells load');
  assert.equal(byName('vd:test-unpinned'), 1, 'the opted-out layer loads only what it wants');
  for (let t = 1; t < 10; t++) stream.update({ x: 5000, y: 1.7, z: 5000 }, K, t);
  assert.equal(byName('city:street-detail'), 2, 'pinned cells never evict');
  assert.equal(byName('vd:test-unpinned'), 0, 'the opted-out layer evicts');
  stream.dispose();
});

test('packages sharing one file: building the first releases the bytes, so the second waits and refetches instead of throwing', () => {
  // The far tier's landmarks (and a chunk's buildings + ground) decode off one shared file whose bytes release() drops
  // (far-tier/on-demand.ts). Both are ready at the pick; the first build releases the file before the second builds.
  const f = externalFixture();
  const shared: { bytes: Float32Array | null } = { bytes: null };
  let prefetches = 0;
  // A getter, like the far tier's packages: trianglePackage's spread would read it once, so it is defined after.
  const sibling = (num: number, x: number): CellPackage => Object.defineProperty(trianglePackage({
    num,
    attributes: {},
    bounds: Float64Array.from([x, 0, 0, x + 2, 1, 2]),
    ready: () => shared.bytes !== null,
    prefetch: () => { prefetches++; },
    release: () => { shared.bytes = null; },
  }), 'attributes', {
    get() {
      if (!shared.bytes) throw new Error(`package ${num} built before its bytes`);
      return {
        position: { array: shared.bytes, itemSize: 3, normalized: false },
        color: { array: new Uint8Array(12).fill(255), itemSize: 4, normalized: true },
      };
    },
  });
  const a = sibling(1, 0);
  const b = sibling(2, 4);
  const stream = createCellStream(T, [], {
    preset: preset({ residentRadiusM: 1000, stream: { msPerFrame: 1e9, uploadBytesPerFrame: 1e9 } }),
    external: [{ template: f.template, spec: f.spec, packages: [a, b] }],
  });
  const camera = { x: 2, y: 0, z: 1 };
  shared.bytes = new Float32Array([0, 0, 0, 2, 0, 0, 0, 1, 2]);
  assert.doesNotThrow(() => stream.prime(camera, K, 1000));
  assert.equal(cells(f.root).length, 1, 'one sibling built; the other lost its bytes to that build');
  assert.equal(prefetches, 1, 'the sibling asked for its bytes again');
  shared.bytes = new Float32Array([4, 0, 0, 6, 0, 0, 4, 1, 2]);
  assert.doesNotThrow(() => stream.update(camera, K, 1));
  assert.equal(cells(f.root).length, 2);
  stream.dispose();
});
