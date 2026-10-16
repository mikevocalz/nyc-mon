import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset } from '../city-dataset.ts';
import { wallTone } from './city-mesh.ts';
import { bays, FLOOR_HEIGHT, fireEscapeFloors, hasFireEscape, hasWaterTower, SHOP_WORDS, towerSpot } from './facade-detail.ts';
import { WALL_TONES } from './palette.ts';

test('fire escapes only on brick walk-ups of four to nine storeys, serving every upper floor', () => {
  assert.equal(hasFireEscape('a', 0, 20, 'brownstone'), false);
  assert.equal(hasFireEscape('a', 0, 9, 'brick'), false);
  assert.equal(hasFireEscape('a', 0, 60, 'brick'), false);
  const share = Array.from({ length: 400 }, (_, i) => hasFireEscape(`b${i}`, 0, 18, 'brick')).filter(Boolean).length / 400;
  assert.ok(share > 0.5 && share < 0.7, `${share}`);
  assert.equal(fireEscapeFloors(5 * FLOOR_HEIGHT + 1), 4, 'five storeys: floors 2 to 5');
});

test('water towers sit on five storeys and up, never on glass, inside the roof', () => {
  assert.equal(hasWaterTower('x', 12, 'brick'), false);
  assert.equal(Array.from({ length: 50 }, (_, i) => hasWaterTower(`g${i}`, 80, 'glass')).some(Boolean), false);
  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const inside = (x: number, z: number) => x > 0 && x < 10 && z > 0 && z < 10;
  assert.deepEqual(towerSpot(square, inside, 2), [5, 5]);
  assert.equal(towerSpot(square, inside, 6), null, 'too small a roof for the tank');
});

test('bays are centred and fit the wall', () => {
  const b = bays(20, 4.5);
  assert.equal(b.length, 4);
  assert.ok(Math.abs(b[0]! + b[3]!) < 1e-9);
  assert.ok(b[3]! + 4.5 / 2 <= 10);
  assert.deepEqual(bays(3, 4.5), []);
});

test('shop signs name trades, not brands', () => {
  for (const words of SHOP_WORDS) assert.match(words, /^[A-Z0-9 &]+$/);
});

test('facade tones vary inside every class on the real tile', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const used = new Map<string, Set<string>>();
  for (const b of dataset.buildings) {
    const tone = wallTone(b);
    assert.ok((WALL_TONES[b.class] as readonly string[]).includes(tone));
    const set = used.get(b.class) ?? new Set();
    set.add(tone);
    used.set(b.class, set);
  }
  for (const [cls, tones] of used) if (WALL_TONES[cls as keyof typeof WALL_TONES].length > 1) assert.ok(tones.size > 1, cls);
});
