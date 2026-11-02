import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { boxDistance, CELL, cellFromNum, cellKey, cellNum, cellOf, splitByCell, splittable } from './cell-rules.ts';

/** A non-indexed geometry of the given triangles (x, y, z per vertex) with a colour attribute per vertex. */
function triangles(...tris: number[][]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = tris.flat();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(pos.map((_, i) => i), 3));
  return g;
}

test('cellOf floors on the 128 m grid, negatives included', () => {
  assert.deepEqual(cellOf(0, 0), [0, 0]);
  assert.deepEqual(cellOf(127.9, 128), [0, 1]);
  assert.deepEqual(cellOf(-0.1, -128), [-1, -1]);
  assert.equal(CELL, 128);
  assert.equal(cellKey(-3, 4), '-3_4');
});

test('cellNum round-trips', () => {
  for (const [cx, cz] of [[0, 0], [-5, 7], [100, -100], [-32767, 32767]] as const) {
    assert.deepEqual(cellFromNum(cellNum(cx, cz)), [cx, cz]);
  }
});

test('a triangle goes to the cell of its plan centroid, with every attribute copied in order', () => {
  // Centroid (10, 10) -> cell (0, 0); centroid (-10, 140) -> cell (-1, 1), though one vertex lies in cell (0, 1).
  const g = triangles([0, 0, 0, 20, 0, 0, 10, 5, 30], [-30, 0, 130, -10, 0, 150, 10, 0, 140]);
  const pkgs = splitByCell(g);
  assert.equal(pkgs.length, 2);
  const a = pkgs.find((p) => p.cx === 0 && p.cz === 0)!;
  const b = pkgs.find((p) => p.cx === -1 && p.cz === 1)!;
  assert.equal(a.vertexCount, 3);
  assert.deepEqual([...a.attributes.position!.array], [0, 0, 0, 20, 0, 0, 10, 5, 30]);
  assert.deepEqual([...a.attributes.color!.array], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...b.attributes.color!.array], [9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.deepEqual([...a.bounds], [0, 0, 0, 20, 5, 30]);
  assert.equal(a.bytes, 9 * 4 * 2);
  assert.equal(a.size, CELL);
});

test('degenerate triangles are dropped and an indexed source comes out non-indexed', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 10, 0, 0, 0, 0, 10, 5, 5, 5], 3));
  g.setIndex([0, 1, 2, 3, 3, 3]);
  const pkgs = splitByCell(g);
  assert.equal(pkgs.length, 1);
  assert.equal(pkgs[0]!.vertexCount, 3);
  assert.deepEqual([...pkgs[0]!.attributes.position!.array], [0, 0, 0, 10, 0, 0, 0, 0, 10]);
});

test('a coarser chunk size groups cells', () => {
  const g = triangles([10, 0, 10, 12, 0, 10, 10, 0, 12], [200, 0, 200, 202, 0, 200, 200, 0, 202]);
  assert.equal(splitByCell(g).length, 2);
  const big = splitByCell(g, 2 * CELL);
  assert.equal(big.length, 1);
  assert.equal(big[0]!.size, 256);
  assert.equal(big[0]!.vertexCount, 6);
});

test('the cut keeps every triangle exactly once', () => {
  const tris: number[][] = [];
  for (let i = 0; i < 200; i++) {
    const x = (i * 37) % 900 - 450; const z = (i * 53) % 900 - 450;
    tris.push([x, 0, z, x + 3, 0, z, x, 2, z + 3]);
  }
  const pkgs = splitByCell(triangles(...tris));
  assert.equal(pkgs.reduce((n, p) => n + p.vertexCount, 0), 600);
  for (const p of pkgs) {
    const pos = p.attributes.position!.array;
    for (let t = 0; t < p.vertexCount; t += 3) {
      const cx = (pos[t * 3]! + pos[t * 3 + 3]! + pos[t * 3 + 6]!) / 3;
      const cz = (pos[t * 3 + 2]! + pos[t * 3 + 5]! + pos[t * 3 + 8]!) / 3;
      assert.deepEqual(cellOf(cx, cz), [p.cx, p.cz]);
    }
  }
});

test('splittable refuses groups and interleaved attributes', () => {
  const g = triangles([0, 0, 0, 1, 0, 0, 0, 0, 1]);
  assert.equal(splittable(g), true);
  g.addGroup(0, 3, 0);
  assert.equal(splittable(g), false);
  const i = new THREE.BufferGeometry();
  const buffer = new THREE.InterleavedBuffer(new Float32Array(18), 6);
  i.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  assert.equal(splittable(i), false);
});

test('boxDistance is zero inside and Euclidean outside', () => {
  const b = new Float64Array([0, 0, 0, 10, 10, 10]);
  assert.equal(boxDistance(b, 5, 5, 5), 0);
  assert.equal(boxDistance(b, 13, 14, 5), 5);
  assert.equal(boxDistance(b, -3, 5, -4), 5);
});
