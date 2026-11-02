// city-mesh.ts with the physical facelift's bake picks (facelift.ts
// faceliftBakePicks). With the future layer off the picks are ignored and
// the bake is byte-identical; with it on, only the wall quads of buildings
// whose plan carries the palette change colour, and the cel roofline trim
// is emitted exactly where the plan keeps it. Measured on the real tile.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset, type CityBuilding, type CityDatasetV3 } from '../../city-dataset.ts';
import { buildCityMeshes, neonTrimShare, wallTone, type PhysicalMeshOptions } from '../city-mesh.ts';
import { hashUnit } from '../geometry.ts';
import { CITY_COLORS, hexToRgb } from '../palette.ts';
import { createPbrCityMaterials } from '../pbr-materials.ts';
import { createStreetClearance } from '../walkability.ts';
import { faceliftBakePicks, faceliftPlanner } from './facelift.ts';

const SUN_AWAY: [number, number] = [0.5, -0.5];
const realTile = () => parseCityDataset(JSON.parse(readFileSync(new URL('../../data/harlem-apollo.json', import.meta.url), 'utf8')));
const materials = createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7] });

function bake(dataset: CityDatasetV3, future: boolean, physical: PhysicalMeshOptions) {
  return buildCityMeshes(THREE, dataset, materials, SUN_AWAY, createStreetClearance(dataset), future, physical);
}
type Built = ReturnType<typeof bake>;
const attributesOf = (built: Built) =>
  new Map(built.meshes.map((m) => [m.name, Object.fromEntries(Object.entries(m.geometry.attributes).map(([k, a]) => [k, Array.from(a.array as Float32Array)]))]));
const wallsOf = (b: CityBuilding) => (b.class === 'glass' ? 'city:walls-glass' : 'city:walls-masonry');
/** city-mesh.ts's wall colour for a tone: tint by the per-id variation, as Float32 the buffer stores. */
const wallRgb = (hex: string, id: string) => {
  const variation = 0.92 + hashUnit(id) * 0.16;
  return hexToRgb(hex).map((v) => Math.fround(Math.max(0, Math.min(1, v * variation))));
};

test('future off: the facelift picks change no byte of the physical bake', () => {
  const tile = realTile();
  const base = bake(tile, false, { facadeAttributes: true });
  const picked = bake(tile, false, { facadeAttributes: true, facelift: faceliftBakePicks(tile) });
  assert.deepEqual(attributesOf(picked), attributesOf(base));
  assert.deepEqual(picked.stats, base.stats);
  base.dispose(); picked.dispose();
});

test('future on, real tile: wall geometry and every other mesh are unchanged; trims follow the plan', () => {
  const tile = realTile();
  const plan = faceliftPlanner(tile);
  const landmarks = new Set(tile.landmarks.map((l) => l.buildingId));
  const base = bake(tile, true, { facadeAttributes: true });
  const picked = bake(tile, true, { facadeAttributes: true, facelift: faceliftBakePicks(tile) });
  const before = attributesOf(base);
  const after = attributesOf(picked);
  assert.deepEqual([...after.keys()], [...before.keys()]);
  for (const [name, attrs] of before) {
    for (const [key, data] of Object.entries(attrs)) {
      if ((name === 'city:walls-masonry' || name === 'city:walls-glass') && key === 'color') continue;
      if (name === 'city:neon') continue;
      assert.deepEqual(after.get(name)![key], data, `${name}.${key}`);
    }
  }
  const nonLandmark = tile.buildings.filter((b) => !landmarks.has(b.id));
  const celTrims = nonLandmark.filter((b) => hashUnit(`${b.id}:trim`) < neonTrimShare(b.heightMeters)).length;
  const keptTrims = nonLandmark.filter((b) => plan(b).trim).length;
  assert.equal(base.stats.neonTrims, celTrims);
  assert.equal(picked.stats.neonTrims, keptTrims);
  assert.ok(keptTrims < celTrims, `the plan drops trims: ${keptTrims} of ${celTrims}`);
  assert.notDeepEqual(after.get('city:walls-masonry')!.color, before.get('city:walls-masonry')!.color);
  assert.deepEqual(after.get('city:walls-glass')!.color, before.get('city:walls-glass')!.color, 'curtain wall has no refresh family');
  base.dispose(); picked.dispose();
});

test('future on, per building: only planned walls take the refreshed tone, and dropped trims are gone', () => {
  const tile = realTile();
  const plan = faceliftPlanner(tile);
  const picks = faceliftBakePicks(tile);
  const landmarks = new Set(tile.landmarks.map((l) => l.buildingId));
  const candidates = tile.buildings.filter((b) => !landmarks.has(b.id));
  const toned = candidates.filter((b) => picks(b).wallTone !== null).slice(0, 8);
  const plain = candidates.filter((b) => b.class !== 'glass' && picks(b).wallTone === null).slice(0, 8);
  const dropped = candidates.filter((b) => !plan(b).trim && hashUnit(`${b.id}:trim`) < neonTrimShare(b.heightMeters)).slice(0, 8);
  const kept = candidates.filter((b) => plan(b).trim).slice(0, 4);
  assert.equal(toned.length, 8); assert.equal(plain.length, 8); assert.equal(dropped.length, 8); assert.equal(kept.length, 4);

  for (const building of [...toned, ...plain, ...dropped, ...kept]) {
    const one: CityDatasetV3 = { ...tile, buildings: [building] };
    const base = bake(one, true, { facadeAttributes: true });
    const picked = bake(one, true, { facadeAttributes: true, facelift: picks });
    const name = wallsOf(building);
    const was = attributesOf(base).get(name)!.color!;
    const now = attributesOf(picked).get(name)!.color!;
    const tone = picks(building).wallTone;
    if (tone === null) {
      assert.deepEqual(now, was, `${building.id} keeps its wall colour`);
    } else {
      // Wall-quad vertices carry the record tone before and the refreshed one after; cornices keep theirs.
      const old = wallRgb(CITY_COLORS[wallTone(building)], building.id);
      const next = wallRgb(tone, building.id);
      let walls = 0;
      for (let i = 0; i < was.length; i += 3) {
        const isWall = was[i] === old[0] && was[i + 1] === old[1] && was[i + 2] === old[2];
        if (isWall) { walls++; assert.deepEqual(now.slice(i, i + 3), next, `${building.id} vertex ${i / 3}`); } else assert.deepEqual(now.slice(i, i + 3), was.slice(i, i + 3));
      }
      assert.ok(walls >= 6, `${building.id} has wall quads`);
    }
    assert.equal(picked.stats.neonTrims, plan(building).trim ? 1 : 0, `${building.id} trim`);
    assert.equal(base.stats.neonTrims, hashUnit(`${building.id}:trim`) < neonTrimShare(building.heightMeters) ? 1 : 0);
    base.dispose(); picked.dispose();
  }
});
