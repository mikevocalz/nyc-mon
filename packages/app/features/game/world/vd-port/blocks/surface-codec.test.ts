import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { configureVdCellSource } from '../../cell-source/index.ts';
import { createMemoryStore } from '../../cell-source/store.ts';
import { sourceNearPackage } from './on-demand.ts';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  decodeNearCell, decodeSurfaceHalf, lazyNearPackage, nearCellAttributes, nearCellBytes, nearCellPreparation,
  VDN3_FLAGS, VDN3_HEADER_BYTES, VDN3_VERTEX_STRIDE, type NearCellInfo,
} from './codec.ts';

const require = createRequire(import.meta.url);
// Reuse the already pinned meshoptimizer dependency of @types/three; no installation or runtime dependency added.
const meshoptRequire = createRequire(require.resolve('@types/three/package.json'));
const { MeshoptEncoder } = await import(pathToFileURL(meshoptRequire.resolve('meshoptimizer')).href);
const { encodeSurfaceCell } = await import(new URL('../../../../../../../tooling/city/vd-port/surface-codec.mjs', import.meta.url).href);
await MeshoptEncoder.ready;
const registry = { sha256: 'ab'.repeat(32), materialCount: 5, variantCount: 9 };
const normal = [0.3, -0.4, Math.sqrt(0.75)];
const vertices = Array.from({ length: 600 }, (_, i) => ({
  position: [64 + (i % 3), 15.5 + Math.floor(i / 3) / 128, 64 + (i % 2)],
  color: [0.005842, 1.3, 2.4465523], uv: [-3.75 + i / 32, 8.125], normal,
  material: 2, variant: 7, grime: 1.335714,
  flags: VDN3_FLAGS.uv | VDN3_FLAGS.normal | VDN3_FLAGS.color | VDN3_FLAGS.grime | VDN3_FLAGS.weather | VDN3_FLAGS.weather4,
  weather: [0.3125, 1.75, 24.25, -1],
}));
const indices = Array.from({ length: vertices.length }, (_, i) => i);
const fixture = await encodeSurfaceCell({ cx: 0, cz: 0, vertices, indices, registry, encoder: MeshoptEncoder });
const info: NearCellInfo = { key: '0_0-f2', cx: 0, cz: 0, family: 2, surface: registry, vertices: vertices.length, triangles: indices.length / 3, wide: false, bounds: [64, 15, 64, 67, 19, 66], bytes: fixture.bytes.length };

function alteredVertex(change: (raw: DataView) => void, wide = false): Uint8Array {
  const raw = fixture.vertexBytes.slice(); change(new DataView(raw.buffer));
  const vb = MeshoptEncoder.encodeVertexBuffer(raw, vertices.length, VDN3_VERTEX_STRIDE);
  const index = wide ? Uint32Array.from(indices) : Uint16Array.from(indices);
  const ib = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(index.buffer), index.length, wide ? 4 : 2);
  const bytes = new Uint8Array(VDN3_HEADER_BYTES + vb.length + ib.length);
  bytes.set(fixture.bytes.subarray(0, VDN3_HEADER_BYTES));
  new DataView(bytes.buffer).setUint32(12, vb.length + (wide ? 0x80000000 : 0), true);
  bytes.set(vb, VDN3_HEADER_BYTES); bytes.set(ib, VDN3_HEADER_BYTES + vb.length);
  return bytes;
}

test('VDN3 preserves source UV/HDR color/grime/weather, oct normals, IDs and exact encoded GPU footprint', () => {
  const a = decodeNearCell(fixture.bytes, 0, 0, 'absolute', registry);
  assert.ok(a.surface);
  assert.ok(a.color instanceof Float32Array);
  assert.equal(a.emissive.length, 0, 'source emission lives in the registry, not legacy emission bytes');
  for (let i = 0; i < vertices.length; i++) {
    assert.deepEqual(Array.from(a.position.subarray(i * 3, i * 3 + 3)), vertices[i]!.position);
    assert.deepEqual(Array.from(a.surface.uv.subarray(i * 2, i * 2 + 2)), vertices[i]!.uv);
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(a.color[i * 3 + c]! - vertices[i]!.color[c]!) <= 0.002);
    const n: number[] = Array.from(a.surface.normal.subarray(i * 3, i * 3 + 3));
    assert.ok(Math.hypot(...n.map((v, c) => v - normal[c]!)) < 0.0001);
    assert.deepEqual(Array.from(a.surface.surface.subarray(i * 4, i * 4 + 2)), [2, 7]);
    assert.ok(Math.abs(a.surface.surface[i * 4 + 2]! - 1.335714) <= 0.001);
    assert.equal(a.surface.surface[i * 4 + 3], 0);
    assert.deepEqual(Array.from(a.surface.weather.subarray(i * 4, i * 4 + 4)), vertices[i]!.weather);
  }
  const attributes = nearCellAttributes(a);
  assert.equal(Object.keys(attributes).length, 6, 'six native-compatible float buffers, below A12X eight-buffer limit');
  assert.ok(Object.values(attributes).every((attribute) => attribute.array instanceof Float32Array && !attribute.normalized));
  assert.equal(Object.values(attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, a.index.byteLength), nearCellBytes(info));
  assert.deepEqual(a.index, Uint16Array.from(indices));
  assert.ok(a.color[2]! > 2, 'HDR source factors are not clipped or multiplied by a material color');
});

test('VDN3 sliced preparation, cancellation and 32-bit indices reproduce the same data', () => {
  const expected = decodeNearCell(fixture.bytes, 0, 0, 'cell-local', registry);
  let reads = 0;
  const pkg = lazyNearPackage(info, () => { reads++; return fixture.bytes; }, 'cell-local');
  let time = 0, frames = 0;
  while (!pkg.prepare!(time + 2, () => time++)) assert.ok(++frames < 1000);
  assert.ok(frames > 2);
  assert.deepEqual(pkg.attributes, nearCellAttributes(expected));
  assert.equal(pkg.attributes.uv!.array, pkg.attributes.uv!.array, 'decoded UV storage is retained');
  pkg.release!();
  assert.equal(pkg.prepare!(2, (() => { let clock = 0; return () => clock++; })()), false);
  pkg.release!();
  assert.deepEqual(pkg.attributes, nearCellAttributes(expected));
  assert.equal(reads, 3, 'cancelled partial work restarts from the verified source');
  const wide = decodeNearCell(alteredVertex(() => {}, true), 0, 0, 'absolute', registry);
  assert.ok(wide.index instanceof Uint32Array);
  assert.deepEqual(Array.from(wide.index), indices);
});

test('VDN3 rejects unpaired registry, wrong layout, invalid IDs, non-finite fields and mixed triangle IDs', () => {
  assert.throws(() => decodeNearCell(fixture.bytes, 0, 0), /registry is required/);
  assert.throws(() => decodeNearCell(fixture.bytes, 0, 0, 'absolute', { ...registry, sha256: 'cd'.repeat(32) }), /identity mismatch/);
  const layout = fixture.bytes.slice(); new DataView(layout.buffer).setUint16(22, 48, true);
  assert.throws(() => decodeNearCell(layout, 0, 0, 'absolute', registry), /unsupported/);
  assert.throws(() => decodeNearCell(fixture.bytes.slice(0, 32), 0, 0, 'absolute', registry), /truncated/);
  const invalid = [
    [(v: DataView) => v.setUint16(28, 5, true), /bounds/],
    [(v: DataView) => v.setUint32(32, 9, true), /bounds/],
    [(v: DataView) => v.setUint16(8, 0x7c00, true), /non-finite half/],
    [(v: DataView) => v.setFloat32(16, Number.NaN, true), /UV/],
    [(v: DataView) => v.setFloat32(36, Infinity, true), /weather/],
    [(v: DataView) => v.setUint16(14, 128, true), /flags/],
    [(v: DataView) => v.setUint32(32 + VDN3_VERTEX_STRIDE, 6, true), /constant per triangle/],
  ] as const;
  for (const [change, message] of invalid) assert.throws(() => decodeNearCell(alteredVertex(change), 0, 0, 'absolute', registry), message);
  assert.throws(() => decodeSurfaceHalf(0xfc00), /non-finite/);
  assert.equal(decodeSurfaceHalf(1), 2 ** -24);
  assert.equal(decodeSurfaceHalf(0x7bff), 65504);
});

test('a failed VDN3 decode retries cleanly and legacy zero UVs stay cached without new shader attributes', () => {
  let file = alteredVertex(v => v.setUint16(28, 5, true));
  const decoder = nearCellPreparation(() => file, 0, 0, 'absolute', registry);
  for (let i = 0; i < 2; i++) assert.throws(() => decoder.get(), /bounds/);
  file = fixture.bytes;
  assert.deepEqual(decoder.get(), decodeNearCell(file, 0, 0, 'absolute', registry));
  const legacy = decodeNearCell(readFileSync(new URL('./data/lite/-1_-1.bin', import.meta.url)), -1, -1);
  const first = nearCellAttributes(legacy), second = nearCellAttributes(legacy);
  assert.equal(first.uv!.array, second.uv!.array);
  assert.equal(Object.keys(first).length, 4);
  assert.ok(first.color!.array instanceof Uint8Array && first.color!.normalized);
});

test('on-demand family keys use hash-verified bundled bytes and the same paired-registry decoder', async () => {
  configureVdCellSource({
    baseUrl: 'https://cells.example', store: createMemoryStore(),
    manifest: { version: 1, cells: { 'near/0_0-f2': { path: 'near/0_0-f2.bin', bytes: fixture.bytes.length, sha256: createHash('sha256').update(fixture.bytes).digest('hex'), bundled: true } } },
    io: { fetchBytes: async () => { throw new Error('bundled family cell must not fetch the network'); }, now: () => 0, sha256Hex: async (bytes) => createHash('sha256').update(bytes).digest('hex') },
  });
  const pkg = sourceNearPackage(info, 'near', async () => fixture.bytes.buffer as ArrayBuffer, 'cell-local');
  assert.equal(pkg.ready?.(), false);
  assert.equal(await pkg.prefetch?.(), true);
  assert.equal(pkg.ready?.(), true);
  assert.deepEqual(pkg.attributes, nearCellAttributes(decodeNearCell(fixture.bytes, 0, 0, 'cell-local', registry)));
  pkg.release!();
  assert.equal(pkg.ready?.(), true, 'eviction drops decoded arrays while verified source bytes remain reusable');
  assert.deepEqual(pkg.index, Uint16Array.from(indices));
});

test('material resource readiness gates attachment, retries after failure and retains verified source bytes', async () => {
  configureVdCellSource({
    baseUrl: 'https://cells.example', store: createMemoryStore(),
    manifest: { version: 1, cells: { 'near/0_0-f2': { path: 'near/0_0-f2.bin', bytes: fixture.bytes.length, sha256: createHash('sha256').update(fixture.bytes).digest('hex'), bundled: true } } },
    io: { fetchBytes: async () => { throw new Error('unexpected network'); }, now: () => 0, sha256Hex: async (bytes) => createHash('sha256').update(bytes).digest('hex') },
  });
  let ready = false, sourceReads = 0, attempts = 0;
  const resources = { ready: () => ready, async prefetch() { attempts++; if (attempts === 1) throw new Error('page load failed'); ready = attempts > 2; return ready; } };
  const pkg = sourceNearPackage(info, 'near', async () => { sourceReads++; return fixture.bytes.buffer as ArrayBuffer; }, 'cell-local', undefined, resources);
  await assert.rejects(Promise.resolve(pkg.prefetch!()), /page load failed/);
  assert.equal(pkg.ready!(), false);
  assert.equal(pkg.prepare!(Infinity, () => 0), false);
  assert.throws(() => pkg.attributes, /resources are not ready/);
  assert.equal(await pkg.prefetch!(), false, 'a pending page cannot expose geometry');
  assert.equal(await pkg.prefetch!(), true);
  assert.equal(sourceReads, 1, 'page retries do not fetch verified geometry again');
  assert.equal(pkg.ready!(), true);
  assert.ok(pkg.attributes.aVdSurface);
  pkg.release!();
  assert.equal(ready, true, 'package eviction does not dispose scene-owned pages');
  const lazy = lazyNearPackage(info, () => fixture.bytes, 'cell-local', resources);
  ready = false;
  assert.equal(lazy.ready!(), false);
  assert.equal(lazy.prepare!(Infinity, () => 0), false);
  assert.equal(await lazy.prefetch!(), true);
  assert.ok(lazy.attributes.color!.array instanceof Float32Array);
});

test('eviction releases only the package material lease and reacquires pages without fetching geometry again', async () => {
  configureVdCellSource({
    baseUrl: 'https://cells.example', store: createMemoryStore(),
    manifest: { version: 1, cells: { 'near/0_0-f2': { path: 'near/0_0-f2.bin', bytes: fixture.bytes.length, sha256: createHash('sha256').update(fixture.bytes).digest('hex'), bundled: true } } },
    io: { fetchBytes: async () => { throw new Error('unexpected network'); }, now: () => 0, sha256Hex: async (bytes) => createHash('sha256').update(bytes).digest('hex') },
  });
  let held = false, acquired = 0, released = 0, sourceReads = 0;
  const resources = {
    ready: () => held,
    async prefetch() { if (!held) acquired++; held = true; return true; },
    release() { if (held) released++; held = false; },
  };
  const pkg = sourceNearPackage(info, 'near', async () => { sourceReads++; return fixture.bytes.buffer as ArrayBuffer; }, 'cell-local', undefined, resources);
  await pkg.prefetch!(false);
  assert.equal(acquired, 0, 'the prefetch ring fetches geometry without pinning texture pages');
  assert.equal(sourceReads, 1);
  assert.equal(pkg.ready!(), false);
  await pkg.prefetch!();
  assert.ok(pkg.attributes.color);
  pkg.release!(); pkg.release!();
  assert.equal(released, 0, 'CPU upload cleanup keeps the live page lease');
  assert.equal(pkg.ready!(), true);
  pkg.releaseResources!(); pkg.releaseResources!();
  assert.equal(released, 1);
  assert.equal(pkg.ready!(), false);
  assert.throws(() => pkg.attributes, /resources are not ready/);
  await pkg.prefetch!();
  assert.equal(acquired, 2);
  assert.equal(sourceReads, 1);
  assert.ok(pkg.attributes.color);
  pkg.release!(); pkg.releaseResources!();
  assert.equal(released, 2);
});
