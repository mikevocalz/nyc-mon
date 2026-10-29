import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { Three } from '@acme/ui/three';
import { WORLD_PRESETS, type WorldPreset } from '../../perf/tier-presets.ts';
import { createCellStream } from './cell-stream.ts';

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
