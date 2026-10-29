// The physical city's night light pools (night-lights.ts): Slop's LIGHT_CELL index and nearest ranking, the lampScale
// ramp on the preset's interior glow, pool sizes held to the tier row, and every light an unshadowed PointLight so
// three r186's ClusteredLighting clusters it. Then the wiring: city-mesh.ts hands back the awnings, and buildCityWorld
// mounts the pools only when asked under the physical flag.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { physicalCityLight, physicalFacelift } from '@acme/theme';
import { parseCityDataset } from '../../city-dataset.ts';
import { TIER } from '../../perf/tier.ts';
import { buildCityMeshes } from '../city-mesh.ts';
import { buildCityWorld } from '../index.ts';
import { createPbrCityMaterials } from '../pbr-materials.ts';
import { PHYSICAL_LIGHT, PHYSICAL_PRESET_IDS } from '../physical-look.ts';
import { syntheticTileV3 } from '../synthetic-tile.ts';
import { createStreetClearance } from '../walkability.ts';
import {
  LIGHT_BEHIND_SLACK,
  LIGHT_BEHIND_WEIGHT,
  LightSiteGrid,
  STOREFRONT_LIGHT,
  STREETLAMP_LIGHT,
  createNightLights,
  lampScale,
  rankSites,
  storefrontSites,
  streetlampSites,
  type LightCamera,
  type LightSite,
  type RankedSite,
} from './night-lights.ts';

const realTile = () => parseCityDataset(JSON.parse(readFileSync(new URL('../../data/harlem-apollo.json', import.meta.url), 'utf8')));

/** A deterministic scatter of sites over ±400 m. */
function scatter(n: number): LightSite[] {
  let seed = 7;
  const rand = () => ((seed = (seed * 16_807) % 2_147_483_647) / 2_147_483_647);
  return Array.from({ length: n }, (_, i) => ({ x: (rand() - 0.5) * 800, y: 6, z: (rand() - 0.5) * 800, tint: i % 5 }));
}

const CAMERA: LightCamera = { x: 10, y: 12, z: -20, fwdX: 0, fwdZ: 1 };
const glow = (id: (typeof PHYSICAL_PRESET_IDS)[number]) => PHYSICAL_LIGHT[id].interiorGlow;

test('lampScale: off at midday, on at twilight and midnight, Slop\'s ramp and cap', () => {
  assert.equal(lampScale(glow('midday')), 0);
  assert.ok(lampScale(glow('twilight')) > 0.9);
  assert.equal(lampScale(glow('midnight')), 1.25);
  assert.ok(lampScale(glow('golden')) > 0 && lampScale(glow('golden')) < 0.2, 'golden hour: a first glimmer, as in Slop');
});

test('rankSites: the nearest by effective distance, from the grid, matching a brute-force scan', () => {
  const sites = scatter(2000);
  const grid = new LightSiteGrid(sites);
  const ranked = rankSites(grid, CAMERA, STREETLAMP_LIGHT.range, 24, [], []);
  const brute = sites
    .map((s, index) => {
      const dx = s.x - CAMERA.x;
      const dz = s.z - CAMERA.z;
      const d = Math.sqrt(dx * dx + dz * dz + CAMERA.y * CAMERA.y);
      return { index, eff: d + Math.max(0, LIGHT_BEHIND_SLACK - dx * CAMERA.fwdX - dz * CAMERA.fwdZ) * LIGHT_BEHIND_WEIGHT, d };
    })
    .filter((r) => r.d <= STREETLAMP_LIGHT.range && r.eff < STREETLAMP_LIGHT.range)
    .sort((a, b) => a.eff - b.eff);
  assert.ok(brute.length > 24, `the scatter puts more than a pool's worth in range (${brute.length})`);
  assert.equal(ranked.length, 24, 'capped at the pool');
  assert.deepEqual(ranked.map((r) => r.index), brute.slice(0, 24).map((r) => r.index), 'the 24 closest, nearest first');
  assert.equal(ranked[0]!.fade, 1, 'the nearest is at full strength');
  assert.ok(ranked.every((r) => r.fade >= 0 && r.fade <= 1));
  // Reused buffers give the same answer; nothing in range gives nothing.
  const scratch: RankedSite[] = [];
  const out: RankedSite[] = [];
  rankSites(grid, CAMERA, STREETLAMP_LIGHT.range, 24, scratch, out);
  assert.deepEqual(rankSites(grid, CAMERA, STREETLAMP_LIGHT.range, 24, scratch, out).map((r) => r.index), ranked.map((r) => r.index));
  assert.deepEqual(rankSites(grid, { ...CAMERA, x: 5000 }, STREETLAMP_LIGHT.range, 24, [], []), []);
});

test('sites: streetlamp light below and street-side of the head, storefront light under the canopy', () => {
  const [lamp] = streetlampSites([{ x: 10, z: 20, face: [1, 0] }], 7.55);
  assert.ok(Math.abs(lamp!.x - (10 + 0.6 + STREETLAMP_LIGHT.reach)) < 1e-12);
  assert.ok(Math.abs(lamp!.y - (7.55 - STREETLAMP_LIGHT.drop)) < 1e-12);
  assert.equal(lamp!.z, 20);
  const stores = storefrontSites(Array.from({ length: 7 }, (_, i) => ({ x: i, z: 0, outX: 0, outZ: -1 })));
  assert.ok(Math.abs(stores[0]!.z + STOREFRONT_LIGHT.out) < 1e-12);
  assert.equal(stores[0]!.y, STOREFRONT_LIGHT.height);
  assert.deepEqual(stores.map((s) => s.tint), [0, 1, 2, 3, 4, 0, 1], 'colours cycle like Slop\'s sign themes');
});

test('pools: tier-sized, unshadowed PointLights, dark by day, the nearest sites lit at night', () => {
  const lamps = scatter(500);
  const stores = scatter(300).map((s) => ({ ...s, y: STOREFRONT_LIGHT.height }));
  for (const tier of ['phone', 'high'] as const) {
    const row = TIER[tier].physical;
    const night = createNightLights(THREE, {
      streetlamps: lamps, storefronts: stores, streetlampCount: row.streetlampLights, storefrontCount: row.storefrontLights,
    });
    const all = [...night.streetlampLights, ...night.storefrontLights];
    assert.equal(night.streetlampLights.length, row.streetlampLights);
    assert.equal(night.storefrontLights.length, row.storefrontLights);
    assert.equal(night.group.children.length, all.length);
    for (const light of all) {
      assert.equal((light as THREE.PointLight).isPointLight, true);
      assert.equal(light.castShadow, false, 'ClusteredLighting drops shadowed lights to the per-material path');
      assert.equal(light.intensity, 0, 'off until the first update');
    }
    assert.equal(night.streetlampLights[0]!.color.getHexString(), new THREE.Color().setStyle(physicalCityLight.streetlamp).getHexString());

    night.update(CAMERA, glow('midday'));
    assert.ok(all.every((l) => l.intensity === 0 && l.position.y < -100), 'midday: every light off and parked');

    night.update(CAMERA, glow('midnight'));
    const lit = night.streetlampLights.filter((l) => l.intensity > 0);
    assert.ok(lit.length > 0 && lit.length <= row.streetlampLights, `${tier}: ${lit.length} lamps lit`);
    assert.ok(lit.every((l) => l.intensity <= STREETLAMP_LIGHT.intensity * 1.25 + 1e-9));
    const expected = rankSites(new LightSiteGrid(lamps), CAMERA, STREETLAMP_LIGHT.range, row.streetlampLights, [], []);
    const first = lamps[expected[0]!.index]!;
    assert.deepEqual(night.streetlampLights[0]!.position.toArray(), [first.x, first.y, first.z], 'the nearest lamp gets the first light');
    const shops = night.storefrontLights.filter((l) => l.intensity > 0);
    assert.ok(shops.length > 0 && shops.length <= row.storefrontLights);
    assert.ok(shops.every((l) => l.intensity <= STOREFRONT_LIGHT.intensity + 1e-9));

    night.update(CAMERA, glow('twilight'));
    assert.ok(night.streetlampLights.some((l) => l.intensity > 0), 'twilight: lamps on');
    night.update(CAMERA, glow('midday'));
    assert.ok(all.every((l) => l.intensity === 0), 'and off again at midday');
    night.dispose();
  }
});

test('the facelift lights the streetlamps in the LED colour', () => {
  const night = createNightLights(THREE, { streetlamps: [], storefronts: [], streetlampCount: 2, storefrontCount: 0, led: true });
  assert.equal(night.streetlampLights[0]!.color.getHexString(), new THREE.Color().setStyle(physicalFacelift.streetLed).getHexString());
  night.dispose();
});

test('city-mesh hands back one storefront placement per procedural awning, and the bake is unchanged', () => {
  const tile = realTile();
  const materials = createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7] });
  const clearance = createStreetClearance(tile);
  const plain = buildCityMeshes(THREE, tile, materials, [0.5, -0.5], clearance, undefined, {});
  const on = buildCityMeshes(THREE, tile, materials, [0.5, -0.5], clearance, undefined, { storefronts: true });
  const placements = on.physical!.storefronts;
  assert.ok(placements.length > 50, `the Harlem tile has awnings (${placements.length})`);
  assert.equal(placements.length, on.stats.awnings);
  assert.ok(placements.every((p) => Math.abs(Math.hypot(p.outX, p.outZ) - 1) < 1e-6), 'unit outward normals');
  const arrays = (built: typeof plain) => built.meshes.map((m) => Array.from(m.geometry.getAttribute('position').array as Float32Array));
  assert.deepEqual(arrays(on), arrays(plain), 'collecting placements changes no vertex');
  assert.equal(plain.physical, undefined);
  plain.dispose(); on.dispose(); materials.dispose();
});

test('world: night pools mount only under physical with nightLights, sized by the tier row', () => {
  const tile = parseCityDataset(syntheticTileV3());
  const pools = { streetlamps: TIER.phone.physical.streetlampLights, storefronts: TIER.phone.physical.storefrontLights };
  const lit = buildCityWorld(THREE, tile, { physical: true, pbr: true, nightLights: pools });
  const group = lit.group.getObjectByName('city:night-lights');
  assert.ok(group, 'city:night-lights');
  assert.equal(group.children.length, pools.streetlamps + pools.storefronts);
  assert.ok(group.children.every((c) => (c as THREE.PointLight).isPointLight && c.castShadow === false));
  lit.updateNightLights(0, 12, 0, 0, 1, glow('midday'));
  assert.ok(group.children.every((c) => (c as THREE.PointLight).intensity === 0));
  lit.updateNightLights(0, 12, 0, 0, 1, glow('midnight'));
  assert.ok(lit.stats.streetlights > 0, 'the synthetic tile has streetlights');
  assert.ok(group.children.some((c) => (c as THREE.PointLight).intensity > 0), 'a lamp near the origin lights');
  lit.dispose();
  for (const options of [{ physical: true, pbr: true }, { physical: false, nightLights: pools }]) {
    const world = buildCityWorld(THREE, tile, options);
    assert.equal(world.group.getObjectByName('city:night-lights'), undefined, JSON.stringify(options));
    assert.equal(world.nightLights, null);
    world.updateNightLights(0, 12, 0, 0, 1, glow('midnight'));
    world.dispose();
  }
});
