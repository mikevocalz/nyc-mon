// Living City PR08 — the streetscape quality pass. Pins the two real gaps
// it closed (record furniture never rendered though the ped sim avoided
// it; the facade lit share answered no daypart outside the glass lane)
// plus the budget invariants the rest of the evaluation left untouched.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { buildCityMeshes } from './city-mesh.ts';
import { litShareAt, litDensity } from './windows.ts';
import { createPbrCityMaterials } from './pbr-materials.ts';
import { buildStreetProps, placeStreetProps } from './street-props.ts';
import { placeHydrants, placeRecordProps } from './street-props-layout.ts';
import { placeStreetFurniture } from './street-furniture.ts';
import { syntheticTileV2, syntheticTileV3 } from './synthetic-tile.ts';
import { createStreetClearance } from './walkability.ts';

const SUN_AWAY: [number, number] = [0.5, -0.5];
const realTile = () =>
  parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));

const SOURCE = { url: 'https://www.openstreetmap.org/copyright', attribution: 'Test only', license: 'ODbL-1.0', retrievedAt: '2026-10-15T00:00:00Z' };

/** A v3 corner with furniture records: a hydrant and two bike racks, one of which lands in the carriageway. */
const furnitureTile = () =>
  parseCityDataset({
    version: 3, id: 'v3-furn', origin: [-73.95, 40.81], extentMeters: 200,
    sources: [SOURCE], notes: [],
    buildings: [{ id: 'b:1', p: [0, 0, 20, 0, 20, -15, 0, -15], h: 14, c: 'brick', e: 31, d: 1 }],
    roads: [{ id: 'r:1', c: 'residential', w: 9, s: 4.5, p: [-40, 10, 60, 10] }],
    areas: [], trees: { census: [], fill: [] }, landmarks: [],
    transit: { subway: [], shelters: [] },
    furniture: { hydrant: [2, 2, 0], linknyc: [8, 2, 0], bikeRack: [4, 3, 0, 12, 7, 0] },
  });

test('record furniture renders: LinkNYC kiosks and bike racks join the existing prop meshes', () => {
  const dataset = realTile();
  const clearance = createStreetClearance(dataset);
  const { signs, lights } = placeStreetFurniture(dataset, clearance);
  const placed = placeStreetProps(dataset, clearance, signs, lights);
  // The tile carries DOT/Link records for all three kinds.
  assert.ok(placed.linknyc.length > 0 && placed.linknyc.length <= 56, `linknyc ${placed.linknyc.length}`);
  assert.ok(placed.bikeRacks.length > 0 && placed.bikeRacks.length <= 567, `bikeRacks ${placed.bikeRacks.length}`);
  assert.ok(placed.report.hydrantsFromRecords, 'hydrants come from records on the v3 tile');
  assert.ok(placed.hydrants.length <= 687, 'record hydrants bounded by the record count');

  const materials = createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7] });
  const props = buildStreetProps(THREE, dataset, materials, clearance, signs, lights);
  // Merged into the existing buffers: still exactly four objects.
  assert.deepEqual(
    props.objects.map((m) => m.name).sort(),
    ['city:cars', 'city:street-props', 'city:transit', 'city:transit-lights'],
  );
  assert.equal(props.stats.linknyc, placed.linknyc.length);
  assert.equal(props.stats.bikeRacks, placed.bikeRacks.length);
  props.dispose();
  materials.dispose();
});

test('record triplets settle on the sidewalk: in-carriageway records nudge to the band or drop', () => {
  const dataset = furnitureTile();
  const clearance = createStreetClearance(dataset);
  const { signs, lights } = placeStreetFurniture(dataset, clearance);
  const placed = placeStreetProps(dataset, clearance, signs, lights);
  // One hydrant record, one kiosk record, and one of the two racks
  // (at z=7, inside the 4.5 m half-width road) moved inside the band.
  assert.equal(placed.hydrants.length, 1);
  assert.equal(placed.linknyc.length, 1);
  assert.equal(placed.bikeRacks.length, 2);
  assert.ok(placed.report.bikeRacksMoved >= 1, 'the in-road rack nudged onto the sidewalk');
  for (const p of [...placed.hydrants, ...placed.linknyc, ...placed.bikeRacks]) {
    assert.ok(clearance.standable(p.x, p.z), `prop standable at ${p.x},${p.z}`);
  }
});

test('tiles without records keep the rule-spaced hydrants, unchanged', () => {
  const wires = [
    syntheticTileV2(),
    { ...syntheticTileV3(), furniture: { hydrant: [], linknyc: [], bikeRack: [] } },
  ];
  for (const wire of wires) {
    const dataset = parseCityDataset(wire);
    const clearance = createStreetClearance(dataset);
    const { signs, lights } = placeStreetFurniture(dataset, clearance);
    const placed = placeStreetProps(dataset, clearance, signs, lights);
    const rule = placeHydrants(dataset, clearance, lights);
    assert.equal(placed.report.hydrantsFromRecords, false);
    assert.deepEqual(
      placed.hydrants.map((p) => [p.x, p.z]),
      rule.map((p) => [p.x, p.z]),
    );
    assert.equal(placed.linknyc.length, 0);
    assert.equal(placed.bikeRacks.length, 0);
  }
});

test('placeRecordProps drops what the sidewalk cannot take', () => {
  const dataset = furnitureTile();
  const clearance = createStreetClearance(dataset);
  // A record at the building centre can never be standable.
  const far = placeRecordProps([10, -7.5, 0, 5, 5, 0], clearance, 3);
  assert.equal(far.dropped, 1);
  assert.equal(far.placed.length, 1);
  const all = placeRecordProps([10, -7.5, 0], clearance, 3);
  assert.equal(all.placed.length, 0);
});

test('the parapet lip rides the cornice rule, v3 bit included', () => {
  const tile = (d?: number) =>
    parseCityDataset({
      version: 3, id: `v3-par-${d}`, origin: [-73.95, 40.81], extentMeters: 200,
      sources: [SOURCE], notes: [],
      buildings: [{ id: 'b:1', p: [0, 0, 20, 0, 20, -15, 0, -15], h: 14, c: 'brick', e: 31, ...(d === undefined ? {} : { d }) }],
      roads: [{ id: 'r:1', c: 'residential', w: 9, s: 4.5, p: [-40, 10, 60, 10] }],
      areas: [], trees: { census: [], fill: [] }, landmarks: [],
      transit: { subway: [], shelters: [] }, furniture: { hydrant: [], linknyc: [], bikeRack: [] },
    });
  const materials = () => createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7] });
  // Hash path (no d): brick under 45 m cornices the street face, so it parapets it.
  const m1 = materials();
  const on = buildCityMeshes(THREE, tile(undefined), m1, SUN_AWAY, createStreetClearance(tile(undefined)));
  assert.ok(on.stats.cornices > 0 && on.stats.parapets === on.stats.cornices, `${on.stats.cornices} cornices, ${on.stats.parapets} parapets`);
  on.dispose(); m1.dispose();
  // Bit on: same pairing through the record path.
  const m2 = materials();
  const bit = buildCityMeshes(THREE, tile(1), m2, SUN_AWAY, createStreetClearance(tile(1)));
  assert.ok(bit.stats.parapets === bit.stats.cornices && bit.stats.cornices > 0);
  bit.dispose(); m2.dispose();
  // Bit off: neither.
  const m3 = materials();
  const off = buildCityMeshes(THREE, tile(0), m3, SUN_AWAY, createStreetClearance(tile(0)));
  assert.equal(off.stats.parapets, 0);
  off.dispose(); m3.dispose();
});

test('the daypart scales the lit-window share on every material lane', () => {
  // Pure half of the formula every lane's shader mirrors (windows.ts).
  for (const seed of [0.1, 0.5, 0.9]) {
    const d = litDensity(seed);
    assert.ok(litShareAt(d, 0) < litShareAt(d, 0.8), 'day < dusk');
    assert.ok(litShareAt(d, 0.8) <= litShareAt(d, 1), 'dusk <= night');
  }
  assert.ok(Math.abs(litShareAt(0.5, 0) - 0.125) < 1e-9);
  assert.ok(litShareAt(0.5, 1) <= 0.95 && litShareAt(0.9, 1) === 0.95, 'capped under certainty');
  // The option reaches the factories without throwing — the graph compiles
  // in shader-graphs.test.ts; here we pin that the parameter exists.
  const m = createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7], timeOfDay: 0.1 });
  assert.ok(m.masonry && m.glass);
  m.dispose();
});

test('world code keeps the palette-only rule: no raw hex literals outside palette.ts', () => {
  const dir = new URL('./', import.meta.url);
  const hex = /#[0-9a-fA-F]{3,8}\b/;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts') || file === 'palette.ts' || file.endsWith('.test.ts')) continue;
    const source = readFileSync(new URL(file, dir), 'utf8');
    assert.ok(!hex.test(source), `${file} holds a raw hex colour — palette.ts owns those`);
  }
});
