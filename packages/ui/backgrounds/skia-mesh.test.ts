import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCity, QuadKind } from './city-blocks-model.ts';
import { appendCityQuads, appendQuads, Band, LIT_BAND, LIT_LEVELS, MAX_CHUNK_VERTICES, MeshBuilder, packColor } from './skia-mesh.ts';
import { Kind, QuadWriter } from './quad-writer.ts';

const RED: [number, number, number, number] = [1, 0, 0, 1];

function build(fill: (w: QuadWriter) => void) {
  const w = new QuadWriter();
  fill(w);
  const mesh = new MeshBuilder();
  appendQuads(mesh, w.data, w.count, 0.5);
  return mesh.finish();
}

test('packColor makes Skia ARGB ints', () => {
  assert.equal(packColor(1, 0, 0, 1), 0xffff0000);
  assert.equal(packColor(0, 0, 1, 0.5), 0x800000ff);
  assert.equal(packColor(2, -1, 0, 1), 0xffff0000);
});

test('a flat quad is two triangles with the solid band', () => {
  const [chunk] = build((w) => w.rect(0, 0, 10, 20, RED));
  assert.ok(chunk);
  assert.equal(chunk.colors.length, 4);
  assert.deepEqual(Array.from(chunk.indices), [0, 1, 2, 0, 2, 3]);
  assert.deepEqual(Array.from(chunk.texs), [0, -1, 0, -1, 0, -1, 0, -1]);
  assert.ok(chunk.colors.every((c) => c === 0xffff0000));
});

test('a facade carries its window grid, seed and lit level in the overlay texcoords', () => {
  const [chunk] = build((w) => w.facade(0, 0, 40, 60, RED, 4, 6, 17, 0.5, [0, 1, 0, 1]));
  assert.ok(chunk);
  // Base quad, then the overlay quad.
  assert.equal(chunk.colors.length, 8);
  const level = Math.round(0.5 * LIT_LEVELS) * LIT_BAND;
  // Overlay corners: (seed, level) at the top-left to (cols + seed, level + rows) at the bottom-right.
  assert.deepEqual(Array.from(chunk.texs.slice(8, 16)), [17, level, 21, level, 21, level + 6, 17, level + 6]);
  assert.equal(chunk.colors[4], packColor(0, 1, 0, 1));
});

test('a streak fades from its tail to its head through vertex colour', () => {
  const [chunk] = build((w) => w.streak(0, 0, 0, 100, 4, RED, 0.25));
  assert.ok(chunk);
  assert.equal(chunk.colors[0], packColor(1, 0, 0, 0.25));
  assert.equal(chunk.colors[2], packColor(1, 0, 0, 1));
});

test('glows become a halo and a white core in their own bands', () => {
  const [chunk] = build((w) => w.glow(50, 50, 10, RED));
  assert.ok(chunk);
  assert.equal(chunk.colors.length, 8);
  assert.equal(chunk.texs[1], Band.GLOW);
  assert.equal(chunk.texs[9], Band.CORE);
  assert.equal(chunk.colors[4], packColor(1, 1, 1, 0.4));
});

test('round shapes feather to transparent at the edge', () => {
  const [chunk] = build((w) => w.disc(50, 50, 8, RED));
  assert.ok(chunk);
  const alphas = new Set(Array.from(chunk.colors, (c) => c >>> 24));
  assert.deepEqual([...alphas].sort((a, b) => a - b), [0, 255]);
  assert.ok(Array.from(chunk.texs).every((v, i) => (i % 2 ? v === Band.SOLID : v === 0)));
});

test('glyphs expand to one quad per lit pixel', () => {
  const [chunk] = build((w) => w.glyph(0, 0, 9, 15, RED, 0b111));
  assert.ok(chunk);
  assert.equal(chunk.colors.length, 3 * 4);
});

test('meshes split into chunks that uint16 indices can address', () => {
  const chunks = build((w) => {
    for (let i = 0; i < 20000; i++) w.rect(i % 100, Math.floor(i / 100), 1, 1, RED);
  });
  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.ok(chunk.colors.length <= MAX_CHUNK_VERTICES);
    assert.ok(Math.max(...chunk.indices) < chunk.colors.length);
  }
  assert.equal(chunks.reduce((sum, c) => sum + c.colors.length, 0), 80000);
});

test('transparent quads are skipped', () => {
  const w = new QuadWriter();
  w.quad(0, 0, 1, 0, 1, 1, 0, 1, [1, 1, 1, 1], Kind.FLAT);
  w.data[11] = 0;
  const mesh = new MeshBuilder();
  appendQuads(mesh, w.data, w.count, 1);
  assert.ok(mesh.empty);
});

test('CityBlocks quads: facades get overlays, roofs a parapet band', () => {
  const city = buildCity({ width: 400, height: 300, district: 'midtown', blockSize: 48, streetWidth: 10, seed: 3, lightColor: '#ffaa00', accentColor: '#ff6600', windowLights: true });
  const facades = city.quads.filter((q) => q.win[0] > 0.5 && q.color[3] > 0).length;
  const roofs = city.quads.filter((q) => q.win[0] === QuadKind.ROOF).length;
  assert.ok(facades > 0 && roofs > 0);
  const mesh = new MeshBuilder();
  appendCityQuads(mesh, city.quads, city.light);
  const overlays = mesh.finish().reduce((sum, c) => sum + Array.from(c.texs).filter((v, i) => i % 2 === 1 && v >= 0).length, 0);
  assert.equal(overlays, facades * 4);
});
