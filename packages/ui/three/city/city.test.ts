import assert from 'node:assert/strict';
import { test } from 'node:test';
import { d } from 'typegpu';
import { blockHash, FLOORS_PER_BLOCK, scrolledRow, terrainHeight } from './height.ts';
import { buildBlockArrays, INDICES_PER_BLOCK, VERTICES_PER_BLOCK } from './terrain-geometry.ts';
import { bumpInBlocks, cameraFov, PROFILES, terrainGrid, terrainPalette } from './terrain-config.ts';
import { approach, toNdc } from '../pointer.ts';

// The TypeGPU height function runs on the CPU too, so the same code the
// vertex shader uses is tested here directly.
const wave = (t = 0, scroll = 0) => d.vec4f(0.8, 1.5, t, scroll);
const profile = (district: keyof typeof PROFILES) => d.vec4f(...PROFILES[district]);
const noCursor = d.vec4f(0, 0, 0, 0);
const bump = d.vec4f(4, 3, 0, 0);

test('heights snap to whole floors and never drop below one floor', () => {
  for (let x = -20; x <= 20; x += 1) {
    for (let z = -30; z <= 30; z += 3) {
      const h = terrainHeight(d.vec2f(x + 0.5, z), wave(1.3), profile('midtown'), noCursor, bump);
      assert.ok(h >= 1 / FLOORS_PER_BLOCK, `height ${h} below one floor`);
      assert.equal(Math.round(h * FLOORS_PER_BLOCK), h * FLOORS_PER_BLOCK, `height ${h} is not a whole floor`);
    }
  }
});

test('districts keep their profiles: harlem low, megacity tall', () => {
  const mean = (district: keyof typeof PROFILES) => {
    let sum = 0;
    let n = 0;
    for (let x = -12; x <= 12; x++) for (let z = 0; z < 24; z++) {
      sum += terrainHeight(d.vec2f(x, z), wave(), profile(district), noCursor, bump);
      n++;
    }
    return sum / n;
  };
  assert.ok(mean('harlem') < mean('midtown'));
  assert.ok(mean('midtown') < mean('megacity'));
});

test('the pointer lifts the block under it and leaves far blocks alone', () => {
  const at = d.vec2f(2.5, 5);
  const cursor = (active: number, mode = 0) => d.vec4f(2.5, 5, active, mode);
  const still = terrainHeight(at, wave(), profile('downtown'), cursor(0), bump);
  const lifted = terrainHeight(at, wave(), profile('downtown'), cursor(1), bump);
  assert.ok(lifted > still, `lift ${lifted} <= ${still}`);
  const far = d.vec2f(30.5, 40);
  assert.equal(
    terrainHeight(far, wave(), profile('downtown'), cursor(1), bump),
    terrainHeight(far, wave(), profile('downtown'), cursor(0), bump),
  );
});

test('the lift follows the block as the city scrolls', () => {
  // A block at terrain z = 5 - scroll sits at local z 5; the cursor is in local units.
  const scroll = 3;
  const cursor = d.vec4f(0.5, 5, 1, 0);
  const lifted = terrainHeight(d.vec2f(0.5, 5 - scroll), wave(0, scroll), profile('midtown'), cursor, bump);
  const still = terrainHeight(d.vec2f(0.5, 5 - scroll), wave(0, scroll), profile('midtown'), d.vec4f(0.5, 5, 0, 0), bump);
  assert.ok(lifted > still);
});

test('rows wrap: local z stays in range, terrain z steps back by whole grids', () => {
  const rows = 10;
  for (const scroll of [0, 0.25, 3.5, 9.99, 10, 27.3]) {
    for (let row = 0; row < rows; row++) {
      const r = scrolledRow(row, scroll, rows);
      assert.ok(r.x >= 0 && r.x < rows, `local ${r.x}`);
      assert.ok(Math.abs(r.y - (r.x - scroll)) < 1e-4);
      // The terrain row is the instance row shifted by a whole number of grids.
      const grids = (row - r.y) / rows;
      assert.ok(Math.abs(grids - Math.round(grids)) < 1e-4, `row ${row} scroll ${scroll} -> ${r.y}`);
    }
  }
});

test('block hash is stable and in 0..1', () => {
  assert.equal(blockHash(3, 7), blockHash(3, 7));
  for (let i = 0; i < 50; i++) {
    const h = blockHash(i * 1.3, -i);
    assert.ok(h >= 0 && h < 1);
  }
});

test('block geometry: four faces per block, every index in range', () => {
  const a = buildBlockArrays(4, 3);
  assert.equal(a.vertexCount, 12 * VERTICES_PER_BLOCK);
  assert.equal(a.index.length, 12 * INDICES_PER_BLOCK);
  assert.ok(Math.max(...a.index) < a.vertexCount);
  // Wall UVs run up the wall: v equals the vertex height.
  for (let v = 0; v < a.vertexCount; v++) {
    if (a.normal[v * 3 + 1] === 0) assert.equal(a.uv[v * 2 + 1], a.position[v * 3 + 1]);
  }
});

test('grid: even columns, rows cover the depth', () => {
  const g = terrainGrid(48, 28, 55);
  assert.equal(g.cols % 2, 0);
  assert.equal(g.cell, 48 / g.cols);
  assert.ok(Math.abs(g.rows * g.cell - 28) <= g.cell);
  assert.equal(terrainGrid(48, 28, 1).cols, 8);
});

test('palette comes from the district theme, accent overridable', () => {
  const p = terrainPalette('harlem', '', '#00041C');
  assert.equal(p.bodies.length, 4);
  assert.notEqual(p.accent, '');
  assert.equal(terrainPalette('harlem', 'carolina', '#00041C').accent, 'carolina');
});

test('pointer helpers', () => {
  assert.deepEqual(toNdc(50, 25, 100, 50), { x: 0, y: 0, inside: true });
  assert.deepEqual(toNdc(0, 0, 100, 50), { x: -1, y: 1, inside: true });
  assert.equal(toNdc(120, 10, 100, 50).inside, false);
  assert.equal(toNdc(1, 1, 0, 0).inside, false);
  // Same result at 30 and 60 fps over the same time.
  const at30 = approach(approach(0, 1, 1 / 30, 7), 1, 1 / 30, 7);
  const at60 = [0, 0, 0, 0].reduce((v) => approach(v, 1, 1 / 60, 7), 0);
  assert.ok(Math.abs(at30 - at60) < 1e-9);
  assert.ok(bumpInBlocks(3.5, 2.5, 0.875).radius === 4);
  assert.ok(cameraFov(0.46) > cameraFov(1.6));
});
