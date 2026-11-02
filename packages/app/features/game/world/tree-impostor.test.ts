import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeTreeImpostors } from './tree-impostor.ts';
import { TREE_IMPOSTOR_ALPHA, TREE_IMPOSTOR_RGB565, TREE_IMPOSTOR_SIZE, TREE_IMPOSTOR_VIEWS } from './vd-tree-impostors.ts';
import { VD_TREES } from './vd-trees.ts';

const bytes = decodeTreeImpostors(TREE_IMPOSTOR_RGB565, TREE_IMPOSTOR_ALPHA);
const size = TREE_IMPOSTOR_SIZE;

test('far trees carry whole authored canopy silhouettes, not repeating leaf tiles', () => {
  assert.equal(bytes.length, size * size * 4 * TREE_IMPOSTOR_VIEWS * VD_TREES.length);
  assert.equal(TREE_IMPOSTOR_VIEWS, 2, 'one projection per crossed plane');
  for (let layer = 0; layer < VD_TREES.length * TREE_IMPOSTOR_VIEWS; layer++) {
    const offset = layer * size * size * 4;
    const alpha = (x: number, y: number) => bytes[offset + (y * size + x) * 4 + 3]!;
    let visible = 0, corners = 0, differentHalves = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (alpha(x, y) > 0) visible++;
      if ((x < size / 8 || x >= size * 7 / 8) && (y < size / 8 || y >= size * 7 / 8) && alpha(x, y) > 0) corners++;
      if (x < size / 2 && alpha(x, y) !== alpha(x + size / 2, y)) differentHalves++;
    }
    assert.ok(visible > size * size * 0.3 && visible < size * size * 0.65, `layer ${layer}: tree-shaped coverage, not empty or an opaque rectangle`);
    assert.ok(corners < size * size * 0.012, `layer ${layer}: crown does not fill the rectangular corners`);
    assert.ok(differentHalves > size * size * 0.08, `layer ${layer}: halves are distinct authored canopy regions, not a twice-tiled leaf`);
  }
});

test('the two far views preserve different authored branch and leaf placement', () => {
  const planeBytes = size * size * 4;
  for (let species = 0; species < VD_TREES.length; species++) {
    const front = bytes.subarray(species * 2 * planeBytes, (species * 2 + 1) * planeBytes);
    const side = bytes.subarray((species * 2 + 1) * planeBytes, (species * 2 + 2) * planeBytes);
    assert.notDeepEqual(front, side, `species ${species} retains distinct front and side views`);
  }
});

test('transparent canopy edges retain leaf color for filtering, with a clear outer gutter', () => {
  for (let layer = 0; layer < VD_TREES.length * TREE_IMPOSTOR_VIEWS; layer++) {
    const offset = layer * size * size * 4;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const at = offset + (y * size + x) * 4;
      if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) assert.equal(bytes[at + 3], 0, `layer ${layer}: transparent gutter`);
      if (bytes[at + 3] !== 0) continue;
      const touchesLeaf = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => {
        const u = x + dx!, v = y + dy!;
        return u >= 0 && v >= 0 && u < size && v < size && bytes[offset + (v * size + u) * 4 + 3] !== 0;
      });
      if (touchesLeaf) assert.ok(bytes[at]! + bytes[at + 1]! + bytes[at + 2]! > 0, `layer ${layer}: no black fringe beside a leaf`);
    }
  }
});

test('the mid crown keeps the near dimensions and a bounded card budget', () => {
  const f32 = (s: string) => new Float32Array(Uint8Array.from(Buffer.from(s, 'base64')).buffer);
  const bounds = (positions: Float32Array) => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i++) {
      lo[i % 3] = Math.min(lo[i % 3]!, positions[i]!);
      hi[i % 3] = Math.max(hi[i % 3]!, positions[i]!);
    }
    return [...lo, ...hi];
  };
  for (const tree of VD_TREES) {
    const near = f32(tree.leaf.position), mid = f32(tree.mid.position);
    const a = bounds(near), b = bounds(mid);
    for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i]! - b[i]!) < 0.001, `${tree.id}: mid crown retains near bound ${i}`);
    assert.ok(mid.length <= near.length * 2 / 3, `${tree.id}: mid stays under two thirds of the near leaf geometry`);
    assert.ok(mid.length >= near.length / 2, `${tree.id}: mid retains canopy density instead of sparse oversized leaves`);
  }
});


test('canopy alpha is independent of RGB565 including opaque black and edge color', () => {
  // black opaque, black transparent, and red transparent edge dilation.
  const rgb = Buffer.from([0, 0, 0, 0, 0, 0xf8]).toString('base64');
  const alpha = Buffer.from([0b001]).toString('base64');
  assert.deepEqual(Array.from(decodeTreeImpostors(rgb, alpha)), [
    0, 0, 0, 255,
    0, 0, 0, 0,
    255, 0, 0, 0,
  ]);
});
