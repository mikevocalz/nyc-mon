import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeNearCell, lazyNearPackage, nearCellPreparation, type NearArrays, type NearCellInfo } from './codec.ts';
import { VD_BLOCKS } from './data/manifest.ts';

// Captured from the pre-cooperative codec, over position/color/emissive/index bytes in that order.
const fixtures = [
  ['near', '-1_-1', '027e3e1ba5cee4a6b916b4f952cc44bd9e23791c06171448d340b7bf08fac3e1'],
  ['near', '3_2', 'cc05508c65e6752102fe3cfab726491d99a2980e4e03557a2fd4dbe3e4fff91f'],
  ['lite', '-1_-1', 'dcaaf70407387e13cbf9f32e0f5bb54aebea8212e2d8143a6f58ac4eddc2e526'],
  ['lite', '3_2', '9186c2ff04a3a1735e2a533743203e2d6488f22fe4484149e9750ebc2bd65fa0'],
] as const;
const fingerprint = (a: NearArrays) => {
  const hash = createHash('sha256');
  for (const v of [a.position, a.color, a.emissive, a.index]) hash.update(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
  return hash.digest('hex');
};

for (const [level, key, hash] of fixtures) test(`${level}/${key}: sliced and synchronous decode retain every pre-change byte`, () => {
  const info = (VD_BLOCKS[level] as readonly NearCellInfo[]).find((i) => i.key === key)!;
  const bytes = readFileSync(new URL(`./data/${level}/${key}.bin`, import.meta.url));
  const expected = decodeNearCell(bytes, info.cx, info.cz, 'cell-local');
  assert.equal(fingerprint(expected), hash);
  const decoder = nearCellPreparation(() => bytes, info.cx, info.cz, 'cell-local');
  let now = 0, frames = 0;
  while (!decoder.prepare(now + 2, () => now++)) assert.ok(++frames < 10_000);
  assert.ok(frames > 20, 'real fixture spans many bounded steps');
  assert.equal(fingerprint(decoder.get()), hash);
  assert.deepEqual(decoder.get().positionFrame, expected.positionFrame);
  const pkg = lazyNearPackage(info, () => bytes, 'cell-local');
  assert.equal(pkg.prepare!(0, () => 0), false, 'expired frame does no decoding');
  assert.equal(pkg.prepare!(2, (() => { let t = 0; return () => t++; })()), false);
  pkg.release!();
  assert.deepEqual(pkg.attributes.position!.array, expected.position);
  assert.deepEqual(pkg.attributes.color!.array, expected.color);
  assert.deepEqual(pkg.attributes.emissive!.array, expected.emissive);
  assert.deepEqual(pkg.index, expected.index);
  assert.ok(pkg.attributes.uv!.array.every((v) => v === 0));
});

test('release abandons partial bitstream state and a rebuild restarts from verified bytes', () => {
  const bytes = readFileSync(new URL('./data/lite/-1_-1.bin', import.meta.url));
  let reads = 0;
  const decoder = nearCellPreparation(() => { reads++; return bytes; }, -1, -1, 'cell-local');
  let now = 0;
  assert.equal(decoder.prepare(2, () => now++), false);
  assert.equal(reads, 1);
  decoder.release();
  assert.equal(fingerprint(decoder.get()), fixtures[2][2]);
  assert.equal(reads, 2);
  decoder.release();
  assert.equal(fingerprint(decoder.get()), fixtures[2][2]);
  assert.equal(reads, 3);
});

test('VDN2 vertical origins preserve the same index and material streams across yields', () => {
  const file = readFileSync(new URL('./data/lite/-1_-1.bin', import.meta.url));
  const v2 = new Uint8Array(file.length + 4);
  v2.set(file.subarray(0, 16)); v2[3] = 0x32;
  new DataView(v2.buffer).setFloat32(16, 25.5, true);
  v2.set(file.subarray(16), 20);
  const original = decodeNearCell(file, -1, -1);
  const decoder = nearCellPreparation(() => v2, -1, -1, 'absolute');
  let now = 0;
  while (!decoder.prepare(now + 2, () => now++)) { /* one decode checkpoint per frame */ }
  const a = decoder.get();
  assert.deepEqual(a.index, original.index);
  assert.deepEqual(a.color, original.color);
  assert.deepEqual(a.emissive, original.emissive);
  for (let i = 0; i < a.position.length; i++) assert.equal(a.position[i], original.position[i]! + (i % 3 === 1 ? 25.5 : 0));
});


test('failed index decoding retries from fresh bytes twice, then recovers every attribute', () => {
  const good = new Uint8Array(readFileSync(new URL('./data/lite/-1_-1.bin', import.meta.url)));
  const bad = good.slice();
  const vertexBytes = new DataView(bad.buffer).getUint32(12, true) & 0x7fffffff;
  bad[16 + vertexBytes] = 0; // Invalid index stream, after successful vertex decoding.
  let reads = 0;
  const decoder = nearCellPreparation(() => ++reads <= 2 ? bad : good, -1, -1, 'cell-local');
  assert.throws(() => decoder.get(), /not an index buffer/);
  assert.throws(() => decoder.get(), /not an index buffer/);
  assert.equal(reads, 2, 'the second failure reads new bytes rather than accepting an exhausted generator');
  assert.equal(fingerprint(decoder.get()), fixtures[2][2]);
  assert.equal(reads, 3);
  assert.deepEqual(decoder.get(), decodeNearCell(good, -1, -1, 'cell-local'));
});
