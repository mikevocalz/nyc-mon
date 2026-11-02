// The canyon AO's open-sky term comes from the tile's own open areas
// (replacing Slop's Central Park bounds): open over a park, closed over
// streets and roofs, a blurred ramp between, and the AO node compiles with
// and without the grid.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset, type CityArea } from '../../city-dataset.ts';
import { OPEN_SKY_GRID } from '../physical-materials-constants.ts';
import { bakeOpenSkyGrid, canyonSkyAO, openSkyTexture, OPEN_SKY_KINDS } from './canyon-ao.ts';
import { asNode } from './loose-tsl.ts';
import { compileWgsl, stubRenderer } from './physical.test-support.ts';

const square = (id: string, kind: CityArea['kind'], x0: number, z0: number, x1: number, z1: number): CityArea => ({
  id, kind, ring: [x0, z0, x1, z0, x1, z1, x0, z1], holes: [],
});
const at = (grid: ReturnType<typeof bakeOpenSkyGrid>, x: number, z: number) =>
  grid.values[Math.floor((z - grid.minZ) / grid.cellMeters) * grid.width + Math.floor((x - grid.minX) / grid.cellMeters)]!;

test('a park opens the sky inside it, ramps at its edge and leaves the street closed', () => {
  const grid = bakeOpenSkyGrid([square('p', 'park', -40, -40, 40, 40), square('s', 'school', 60, 60, 90, 90)], 100);
  assert.equal(grid.width, Math.ceil(200 / OPEN_SKY_GRID.cellMeters));
  assert.equal(at(grid, 0, 0), 255, 'park centre fully open');
  assert.equal(at(grid, -90, 90), 0, 'far street closed');
  assert.equal(at(grid, 75, 75), 0, 'school yards are not open sky');
  const edge = at(grid, 40, 0);
  assert.ok(edge > 0 && edge < 255, `edge ramps (${edge})`);
  assert.ok(!OPEN_SKY_KINDS.has('school'));
});

test('holes in an open area stay closed', () => {
  const park: CityArea = { ...square('p', 'park', -60, -60, 60, 60), holes: [[-20, -20, 20, -20, 20, 20, -20, 20]] };
  const grid = bakeOpenSkyGrid([park], 100, 4, 0);
  assert.equal(at(grid, 0, 0), 0);
  assert.equal(at(grid, 40, 40), 255);
});

test('the real tile has open sky over its parks, and the AO compiles with and without it', async () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const grid = bakeOpenSkyGrid(dataset.areas, dataset.extentMeters);
  const open = grid.values.reduce((n, v) => n + (v > 127 ? 1 : 0), 0);
  assert.ok(open > 0 && open < grid.values.length / 2, `${open} of ${grid.values.length} cells open`);
  const renderer = await stubRenderer();
  for (const openSky of [undefined, { texture: openSkyTexture(THREE, grid), grid }]) {
    const material = new THREE.MeshStandardNodeMaterial();
    material.aoNode = asNode(canyonSkyAO(THREE, openSky));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const out = compileWgsl(renderer, mesh, material);
    assert.ok(out.fragment.length > 0);
    if (openSky) assert.match(out.fragment, /textureSample/);
    material.dispose(); mesh.geometry.dispose();
  }
});
