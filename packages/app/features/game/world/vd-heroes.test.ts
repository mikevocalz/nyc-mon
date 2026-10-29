// The real 125th Street on the bundled tile (vd lane, default on): the four landmarks get their measured hero front
// and lettering, the measured buildings wear Valdrada's wall material and colour, the futuristic facelift leaves them
// alone, and the Park Avenue Viaduct stands over the tile's east edge — all inside the city's existing draws.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { buildCityMeshes } from './city-mesh.ts';
import { FACELIFT_BLOCKS } from './future-layer.ts';
import { createPbrCityMaterials } from './pbr-materials.ts';
import { faceliftPlanner } from './physical/facelift.ts';
import { VD_FACADE_SPECS, VD_VIADUCT } from './vd-facade-specs.ts';
import { facadeSpec, specPhoto } from './vd-facades.ts';
import { createStreetClearance } from './walkability.ts';

const tile = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
const materials = createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7] });
const built = buildCityMeshes(THREE, tile, materials, [0.5, -0.5], createStreetClearance(tile));
const landmark = (key: string) => tile.landmarks.find((l) => l.key === key)!.buildingId;

test('each named landmark wears its hero front and its real lettering', () => {
  const byKey = new Map(built.heroes.map((h) => [h.key, h]));
  assert.equal(byKey.get('apollo')?.buildingId, landmark('apollo-theater'));
  assert.equal(byKey.get('theresa')?.buildingId, landmark('hotel-theresa'));
  assert.equal(byKey.get('sob')?.buildingId, landmark('acp-state-office'));
  // The Studio Museum is no dataset landmark; Valdrada's spec at 144 W 125th St finds its footprint.
  assert.equal(byKey.get('studio')?.buildingId, 'osm:way:271798921');
  assert.ok(byKey.get('apollo')!.signs.includes('APOLLO'), 'the APOLLO marquee and blade');
  assert.deepEqual(['HOTEL', 'THERESA'].filter((w) => byKey.get('theresa')!.signs.includes(w)), ['HOTEL', 'THERESA']);
  assert.ok(byKey.get('sob')!.signs.includes('ADAM CLAYTON POWELL JR. STATE OFFICE BUILDING'), 'the base band lettering');
  assert.ok(byKey.get('studio')!.signs.includes('STUDIO MUSEUM IN HARLEM'), 'the bronze fascia');
  assert.ok(byKey.get('studio')!.signs.includes('STUDIO MUSEUM'), 'the blade');
  assert.equal(built.stats.heroes, 4);
});

test('measured 125th Street shops carry their real signs', () => {
  const signs = new Set(built.texts.map((t) => t.text));
  for (const name of ['CAPITAL ONE BANK', 'BLICK', 'BANANA REPUBLIC FACTORY STORE', 'APOLLO BEAUTY', 'H&M', 'MCDONALD\'S']) {
    assert.ok(signs.has(name), `${name} lettered on its storefront`);
  }
});

test('measured buildings take Valdrada\'s wall material and colour, and every one of them is in the tile', () => {
  const ids = new Set(tile.buildings.map((b) => b.id));
  const specs = Object.entries(VD_FACADE_SPECS);
  assert.ok(specs.length >= 150, `${specs.length} measured facades`);
  for (const [id, spec] of specs) {
    assert.ok(ids.has(id), `${id} is a tile building`);
    assert.ok(spec.c.every((v) => v >= 0 && v <= 1), `${id} tint is display RGB`);
  }
  // The Apollo's lot is tan brick, the Theresa white glazed brick, the Studio Museum charcoal precast.
  assert.deepEqual(specPhoto(facadeSpec(landmark('hotel-theresa'))!)[0], 2);
  assert.ok(facadeSpec('osm:way:271798921')!.c.every((v) => v < 0.3), 'the Studio Museum is charcoal');
  assert.ok(built.stats.realFacades >= specs.length, `${built.stats.realFacades} buildings drew a measured facade`);
});

test('the facelift leaves every measured building as it is', () => {
  const plan = faceliftPlanner(tile);
  let avenue = 0;
  for (const building of tile.buildings) {
    const p = plan(building);
    assert.ok(FACELIFT_BLOCKS.includes(p.block));
    if (!facadeSpec(building.id)) { if (p.block === 'avenue') avenue++; continue; }
    const pieces = Object.entries(p).filter(([k, v]) => k !== 'block' && v === true).map(([k]) => k);
    assert.deepEqual(pieces, [], `${building.id} keeps its real front`);
  }
  // Off 125th Street the avenues keep the near-future layer.
  assert.ok(avenue > 50, `${avenue} unmeasured avenue buildings still take the facelift`);
});

test('the Park Avenue Viaduct stands over the tile\'s east edge', () => {
  assert.equal(VD_VIADUCT.length, 4, 'four Metro-North tracks');
  assert.ok(built.stats.viaductSpans > 10, `${built.stats.viaductSpans} spans`);
  assert.ok(built.stats.viaductBents > 3, `${built.stats.viaductBents} bents`);
});

test('the real 125th adds no draw: one mesh per material, as before', () => {
  assert.equal(built.stats.drawCalls, 12);
  const names = built.meshes.map((m) => m.name);
  assert.equal(new Set(names).size, names.length);
  built.dispose(); materials.dispose();
});
