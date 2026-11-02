// city-mesh.ts under the physical lane's options: off by default and
// byte-identical when off; with `facadeAttributes` the wall buffers carry
// aFacadeWall / aFacadeGrid in step with every vertex, deterministic per
// building id, without a single new draw; with `fireEscapes` the baked D18
// escapes become placements. Measured on the real Harlem tile.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset, type CityDatasetV3 } from '../../city-dataset.ts';
import { buildCityMeshes, type PhysicalMeshOptions } from '../city-mesh.ts';
import { createPbrCityMaterials } from '../pbr-materials.ts';
import { syntheticTileV3 } from '../synthetic-tile.ts';
import { createStreetClearance } from '../walkability.ts';
import { buildingFacade } from './class-family.ts';
import { FACADE_FLOATS_PER_VERTEX, FACADE_GRID_ATTRIBUTE, FACADE_WALL_ATTRIBUTE, packFamilyPier, WALL_KINDS } from './facade-attributes.ts';

const SUN_AWAY: [number, number] = [0.5, -0.5];
const realTile = () => parseCityDataset(JSON.parse(readFileSync(new URL('../../data/harlem-apollo.json', import.meta.url), 'utf8')));

function bake(dataset: CityDatasetV3, physical?: PhysicalMeshOptions) {
  const materials = createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7] });
  const clearance = createStreetClearance(dataset);
  const built = physical === undefined
    ? buildCityMeshes(THREE, dataset, materials, SUN_AWAY, clearance)
    : buildCityMeshes(THREE, dataset, materials, SUN_AWAY, clearance, undefined, physical);
  return { built, dispose: () => { built.dispose(); materials.dispose(); } };
}
type Built = ReturnType<typeof bake>['built'];
const mesh = (built: Built, name: string) => {
  const m = built.meshes.find((x) => x.name === name);
  assert.ok(m, name);
  return m;
};
const attributesOf = (built: Built) =>
  new Map(built.meshes.map((m) => [m.name, Object.fromEntries(Object.entries(m.geometry.attributes).map(([k, a]) => [k, Array.from(a.array as Float32Array)]))]));

test('options default off: the bake writes the same attributes as before, and no facade attributes', () => {
  const tile = realTile();
  const plain = bake(tile);
  const empty = bake(tile, {});
  assert.deepEqual(attributesOf(empty.built), attributesOf(plain.built));
  for (const m of plain.built.meshes) {
    assert.equal(m.geometry.getAttribute(FACADE_WALL_ATTRIBUTE), undefined, `${m.name} has no aFacadeWall`);
    assert.equal(m.geometry.getAttribute(FACADE_GRID_ATTRIBUTE), undefined, `${m.name} has no aFacadeGrid`);
  }
  assert.equal(plain.built.physical, undefined);
  plain.dispose(); empty.dispose();
});

test('facade attributes cover every wall vertex, change no other byte and add no draw (real tile)', () => {
  const tile = realTile();
  const off = bake(tile);
  const on = bake(tile, { facadeAttributes: true });
  assert.equal(on.built.stats.drawCalls, 12);
  assert.equal(on.built.stats.drawCalls, off.built.stats.drawCalls);
  // Every pre-existing attribute is unchanged.
  const before = attributesOf(off.built);
  const after = attributesOf(on.built);
  for (const [name, attrs] of before) {
    for (const [key, data] of Object.entries(attrs)) assert.deepEqual(after.get(name)![key], data, `${name}.${key}`);
  }
  let vertices = 0;
  for (const name of ['city:walls-masonry', 'city:walls-glass']) {
    const g = mesh(on.built, name).geometry;
    const n = g.getAttribute('position').count;
    assert.equal(g.getAttribute(FACADE_WALL_ATTRIBUTE).count, n);
    assert.equal(g.getAttribute(FACADE_GRID_ATTRIBUTE).count, n);
    vertices += n;
    // Every window module is positive and every kind is one of Slop's five.
    const wall = g.getAttribute(FACADE_WALL_ATTRIBUTE).array as Float32Array;
    const grid = g.getAttribute(FACADE_GRID_ATTRIBUTE).array as Float32Array;
    for (let i = 0; i < n; i++) {
      assert.ok(wall[i * 4 + 1]! > 0 && grid[i * 4]! > 0 && grid[i * 4 + 1]! > 0, `${name} vertex ${i} module`);
      assert.ok(Object.values(WALL_KINDS).includes(wall[i * 4 + 3]! as never), `${name} vertex ${i} kind`);
    }
  }
  // The measured cost on this tile, 32 bytes on each wall vertex.
  assert.equal(on.built.physical!.facadeBytes, vertices * FACADE_FLOATS_PER_VERTEX * 4);
  assert.equal(vertices, 247_812);
  assert.equal(on.built.physical!.facadeBytes, 7_929_984);
  // Other meshes get nothing.
  for (const m of on.built.meshes) {
    if (m.name === 'city:walls-masonry' || m.name === 'city:walls-glass') continue;
    assert.equal(m.geometry.getAttribute(FACADE_WALL_ATTRIBUTE), undefined, m.name);
  }
  // Every kind occurs on the real tile.
  const kinds = new Set<number>();
  const wall = mesh(on.built, 'city:walls-masonry').geometry.getAttribute(FACADE_WALL_ATTRIBUTE).array as Float32Array;
  for (let i = 3; i < wall.length; i += 4) kinds.add(wall[i]!);
  for (const k of Object.values(WALL_KINDS)) assert.ok(kinds.has(k), `kind ${k} present`);
  off.dispose(); on.dispose();
});

test('facade attributes are deterministic per building id, whatever the tile order', () => {
  const tile = parseCityDataset(syntheticTileV3());
  const reversed: CityDatasetV3 = { ...tile, buildings: [...tile.buildings].reverse() };
  const a = bake(tile, { facadeAttributes: true });
  const b = bake(tile, { facadeAttributes: true });
  const c = bake(reversed, { facadeAttributes: true });
  for (const name of ['city:walls-masonry', 'city:walls-glass']) {
    for (const attr of [FACADE_WALL_ATTRIBUTE, FACADE_GRID_ATTRIBUTE]) {
      assert.deepEqual(
        Array.from(mesh(a.built, name).geometry.getAttribute(attr).array as Float32Array),
        Array.from(mesh(b.built, name).geometry.getAttribute(attr).array as Float32Array),
        `${name}.${attr} rebuild`,
      );
    }
  }
  // b:2 is the only glass building: its glass wall quads are identical when the tile order flips.
  const glassGrid = (built: Built) => Array.from(mesh(built, 'city:walls-glass').geometry.getAttribute(FACADE_GRID_ATTRIBUTE).array as Float32Array);
  assert.deepEqual(glassGrid(c.built), glassGrid(a.built));
  a.dispose(); b.dispose(); c.dispose();
});

test('one wall quad carries Slop box facts: along 0..L from its start corner, width, height, kind; the grid from the record', () => {
  const tile = parseCityDataset(syntheticTileV3());
  const on = bake(tile, { facadeAttributes: true });
  const b1 = tile.buildings.find((b) => b.id === 'b:1')!;
  const facade = buildingFacade(b1);
  // The record's `fh` and `ww` win over the family default.
  assert.equal(facade.floorHeight, 3.5);
  assert.equal(facade.windowWidth, 1.75);
  assert.equal(facade.family, 'brownstone');
  const g = mesh(on.built, 'city:walls-masonry').geometry;
  const wall = g.getAttribute(FACADE_WALL_ATTRIBUTE).array as Float32Array;
  const grid = g.getAttribute(FACADE_GRID_ATTRIBUTE).array as Float32Array;
  // First quad: b:1's first ccw edge. a, b, c, a, c, d with a and d at the start corner.
  const L = wall[1 * 4]!;
  assert.ok(L > 0);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((v) => wall[v * 4]), [0, L, L, 0, L, 0]);
  for (let v = 0; v < 6; v++) {
    assert.equal(wall[v * 4 + 1], L);
    assert.equal(wall[v * 4 + 2], b1.heightMeters);
    assert.deepEqual(Array.from(grid.subarray(v * 4, v * 4 + 4)), [
      Math.fround(3.5), Math.fround(1.75), Math.fround(facade.seedTone), Math.fround(packFamilyPier(facade.masonryIndex, facade.cornerPier)),
    ]);
  }
  // The recorded front edge (fi 0 faces the 125th-style road) is a street front: an entrance or a storefront.
  const kinds = new Set<number>();
  for (let v = 0; v < 24; v += 6) kinds.add(wall[v * 4 + 3]!);
  assert.ok(kinds.has(WALL_KINDS.entry) || kinds.has(WALL_KINDS.shop), `kinds ${[...kinds]}`);
  on.dispose();
});

test('fire escapes become placements on the same buildings, and leave the baked street detail', () => {
  const tile = realTile();
  const off = bake(tile);
  const on = bake(tile, { fireEscapes: true });
  const placements = on.built.physical!.fireEscapes;
  assert.equal(placements.length, off.built.stats.fireEscapes, 'one placement per baked escape');
  assert.equal(on.built.stats.fireEscapes, off.built.stats.fireEscapes);
  assert.ok(placements.length > 100, `${placements.length} escapes`);
  for (const p of placements) {
    assert.ok(p.landings >= 1 && p.storey > 2 && p.storey < 6);
    assert.ok(Math.abs(p.h - ((p.landings - 1) * p.storey + 1)) < 1e-9);
    assert.ok(Number.isFinite(p.facing) && Number.isFinite(p.x) && Number.isFinite(p.z));
  }
  const detail = (built: Built) => mesh(built, 'city:street-detail').geometry.getAttribute('position').count;
  assert.ok(detail(on.built) < detail(off.built), 'the baked escape floors are gone from the detail mesh');
  // Everything else is untouched.
  const before = attributesOf(off.built); const after = attributesOf(on.built);
  for (const [name, attrs] of before) {
    if (name === 'city:street-detail') continue;
    for (const [key, data] of Object.entries(attrs)) assert.deepEqual(after.get(name)![key], data, `${name}.${key}`);
  }
  off.dispose(); on.dispose();
});
