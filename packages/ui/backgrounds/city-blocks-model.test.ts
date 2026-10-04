import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blockAt, buildCity, litWindows, packQuads, QUAD_FLOATS, QuadKind, trafficAt, trafficCapacity,
  type CityInput, type District,
} from './city-blocks-model.ts';

const input = (district: District, extra: Partial<CityInput> = {}): CityInput => ({
  width: 800, height: 500, district, blockSize: 56, streetWidth: 10, seed: 7,
  lightColor: '#FEBE80', accentColor: 'orange', windowLights: true, ...extra,
});

const roofs = (d: District) => buildCity(input(d)).quads.filter((q) => q.win[0] === QuadKind.ROOF);
const tallest = (d: District) => Math.max(...roofs(d).map((q) => -Math.min(q.p[1], q.p[3])));

test('the same seed builds the same city', () => {
  assert.deepEqual(buildCity(input('midtown')), buildCity(input('midtown')));
  assert.notDeepEqual(buildCity(input('midtown')).quads, buildCity(input('midtown', { seed: 8 })).quads);
});

test('districts differ in density and height', () => {
  // Harlem's rows stay low; Mega City's megastructures stand tallest.
  assert.ok(tallest('megacity') > tallest('midtown'));
  assert.ok(tallest('downtown') > tallest('harlem'));
  // Mega City merges blocks, so it has fewer of them than Midtown.
  assert.ok(buildCity(input('megacity')).blocks.length < buildCity(input('midtown')).blocks.length * 0.8);
});

test('the grid covers the viewport', () => {
  const city = buildCity(input('downtown'));
  assert.ok(city.blocks.some((b) => b.x <= 0));
  assert.ok(city.blocks.some((b) => b.x + b.w >= 800));
  assert.ok(city.blocks.some((b) => b.y <= 0));
  assert.ok(city.blocks.some((b) => b.y + b.h >= 500));
});

test('window lights can be turned off', () => {
  const lit = buildCity(input('midtown')).quads.filter((q) => q.win[0] > 0).length;
  const dark = buildCity(input('midtown', { windowLights: false })).quads.filter((q) => q.win[0] > 0).length;
  assert.ok(lit > 0);
  assert.equal(dark, 0);
});

test('blockAt finds the block under a point and misses the street', () => {
  const city = buildCity(input('midtown'));
  const b = city.blocks[5]!;
  assert.equal(blockAt(city, b.x + b.w / 2, b.y + b.h / 2), 5);
  assert.equal(blockAt(city, b.x - 0.5 * 10 * 1.8, b.y + b.h / 2), -1);
});

test('traffic is a pure function of time and stops when the clock stops', () => {
  const city = buildCity(input('midtown'));
  const opts = { density: 1, speed: 1, headlight: 'white', taillight: 'apple' };
  const a = trafficAt(city, 'midtown', 3, opts);
  assert.deepEqual(a, trafficAt(city, 'midtown', 3, opts));
  assert.notDeepEqual(a, trafficAt(city, 'midtown', 3.5, opts));
  assert.ok(a.length <= trafficCapacity(city, 1));
  assert.equal(trafficAt(city, 'midtown', 3, { ...opts, density: 0 }).length, 0);
});

test('packQuads lays out 16 floats per quad: corners, colour, win', () => {
  const city = buildCity(input('harlem'));
  const out = new Float32Array(city.quads.length * QUAD_FLOATS);
  packQuads(city.quads, out);
  const q = city.quads[3]!;
  assert.deepEqual(Array.from(out.slice(3 * 16, 3 * 16 + 8)), q.p.map((v) => Math.fround(v)));
  assert.deepEqual(Array.from(out.slice(3 * 16 + 8, 3 * 16 + 12)), q.color.map((v) => Math.fround(v)));
});

test('litWindows stays under its cap and is empty with lights off', () => {
  const city = buildCity(input('midtown'));
  const pts = litWindows(city, 500);
  assert.ok(pts.length > 0 && pts.length <= 500);
  assert.equal(litWindows(buildCity(input('midtown', { windowLights: false }))).length, 0);
});
