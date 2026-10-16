import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset, type CityRoad } from '../city-dataset.ts';
import {
  BLADE_HEIGHTS, CORNER_SETBACKS, findIntersections, LIGHT_SPACING, MAX_BLADE_LENGTH, placeSigns, placeStreetlights, signText,
} from './signage.ts';
import { measureText } from './street-furniture.ts';

const road = (id: string, name: string | undefined, points: number[], cls: CityRoad['class'] = 'residential', width = 10): CityRoad => ({
  id, class: cls, widthMeters: width, sidewalkMeters: 4, points, widthEstimated: false, ...(name ? { name } : {}),
});

test('names abbreviate the way Manhattan blades print them', () => {
  assert.equal(signText('West 125th Street'), 'W 125 ST');
  assert.equal(signText('5th Avenue'), '5 AV');
  assert.equal(signText('Malcolm X Boulevard'), 'MALCOLM X BLVD');
  assert.equal(signText('Adam Clayton Powell Jr. Boulevard'), 'ADAM CLAYTON POWELL JR BLVD');
  assert.equal(signText('Saint Nicholas Terrace'), 'ST NICHOLAS TER');
  assert.equal(signText('East 122nd Street'), 'E 122 ST');
  assert.equal(signText('Mount Morris Park West'), 'MT MORRIS PARK W');
});

test('intersections: one per crossing of two names; same-name, parallel, unnamed and footway crossings are skipped', () => {
  const roads = [
    road('a', 'West 125th Street', [-100, 0, 0, 0, 100, 0]),
    road('b', 'Malcolm X Boulevard', [20, -80, 20, 80], 'primary', 18),
    // The same avenue as two carriageways 12 m apart: one intersection, not two.
    road('b2', 'Malcolm X Boulevard', [32, -80, 32, 80], 'primary', 9),
    road('c', 'West 125th Street', [100, 0, 150, 0]),
    road('d', 'West 124th Street', [-100, 5, 100, 5]),
    road('e', undefined, [-50, -50, -50, 50]),
    road('f', 'A Footpath', [-60, -50, -60, 50], 'footway', 3),
  ];
  const found = findIntersections(roads);
  const pairs = found.map((x) => x.streets.map((s) => s.name).join(' / ')).sort();
  assert.deepEqual(pairs, ['Malcolm X Boulevard / West 124th Street', 'Malcolm X Boulevard / West 125th Street']);
  const at125 = found.find((x) => x.streets[1].name === 'West 125th Street')!;
  assert.ok(Math.abs(at125.z) < 1e-9 && (Math.abs(at125.x - 20) < 1e-9 || Math.abs(at125.x - 32) < 1e-9));
});

test('signs stand on the corner nearest the centre, clear of both carriageways, blades along their streets', () => {
  const crosses = findIntersections([
    road('a', 'West 125th Street', [-100, 0, 100, 0], 'secondary', 14),
    road('b', 'Malcolm X Boulevard', [0, -100, 0, 100], 'primary', 18),
  ]);
  const [sign] = placeSigns(crosses, [-50, -50], measureText);
  assert.ok(sign);
  // Corner toward (-50, -50): x and z both negative, outside each half width plus the setback.
  assert.ok(Math.abs(sign.x + 9 + CORNER_SETBACKS[0]) < 1e-6, `x ${sign.x}`);
  assert.ok(Math.abs(sign.z + 7 + CORNER_SETBACKS[0]) < 1e-6, `z ${sign.z}`);
  const [lower, upper] = sign.blades;
  assert.equal(lower.y, BLADE_HEIGHTS[0]);
  assert.equal(upper.y, BLADE_HEIGHTS[1]);
  const byText = Object.fromEntries(sign.blades.map((b) => [b.text, b]));
  assert.equal(Math.abs(byText['W 125 ST']!.dir[0]), 1, 'the 125th Street blade runs east-west');
  assert.equal(Math.abs(byText['MALCOLM X BLVD']!.dir[1]), 1);
});

test('long names condense to the longest blade; the cap keeps the nearest signs', () => {
  const crosses = findIntersections([
    road('a', 'Adam Clayton Powell Jr. Boulevard', [0, -300, 0, 300], 'primary', 18),
    ...[0, 1, 2, 3, 4].map((i) => road(`s${i}`, `West ${120 + i}th Street`, [-100, i * 60, 100, i * 60])),
  ]);
  const signs = placeSigns(crosses, [0, 0], measureText, 3);
  assert.equal(signs.length, 3);
  assert.ok(signs[0]!.distance <= signs[1]!.distance && signs[1]!.distance <= signs[2]!.distance);
  const acp = signs[0]!.blades.find((b) => b.text.startsWith('ADAM'))!;
  assert.ok(acp.condense < 1 && acp.condense >= 0.55);
  assert.ok(acp.length <= MAX_BLADE_LENGTH + 1e-9);
  const short = signs[0]!.blades.find((b) => b.text.startsWith('W '))!;
  assert.equal(short.condense, 1);
});

test('streetlights every LIGHT_SPACING metres, alternating sides, facing the road', () => {
  const lights = placeStreetlights([road('a', 'X', [0, 0, 200, 0], 'secondary', 14)], [0, 0]);
  const xs = lights.map((l) => l.x).sort((a, b) => a - b);
  assert.equal(lights.length, Math.floor((200 - LIGHT_SPACING / 2) / LIGHT_SPACING) + 1);
  for (let i = 1; i < xs.length; i++) assert.ok(Math.abs(xs[i]! - xs[i - 1]! - LIGHT_SPACING) < 1e-6);
  const sides = new Set(lights.map((l) => Math.sign(l.z)));
  assert.deepEqual([...sides].sort(), [-1, 1]);
  for (const l of lights) assert.ok(Math.sign(l.face[1]) === -Math.sign(l.z), 'the head reaches over the carriageway');
  assert.equal(placeStreetlights([road('f', 'Path', [0, 0, 200, 0], 'footway', 3)], [0, 0]).length, 0);
});

test('the baked tile signs the Apollo corner of 125th Street', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const apollo = dataset.landmarks.find((l) => l.key === 'apollo-theater')!;
  const signs = placeSigns(findIntersections(dataset.roads), [apollo.x, apollo.z], measureText);
  assert.ok(signs.length > 100 && signs.length <= 400, `${signs.length} signs`);
  const nearest = signs.slice(0, 6).flatMap((s) => s.blades.map((b) => b.text));
  assert.ok(nearest.includes('W 125 ST'), nearest.join(', '));
  for (const s of signs) for (const b of s.blades) assert.ok(b.length <= MAX_BLADE_LENGTH + 1e-9, b.text);
});
