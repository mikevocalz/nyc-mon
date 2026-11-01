// Every BuildingClass has exactly one Slop facade family, and the STYLE ids
// each class cites are exactly the ones tooling/city/build.mjs STYLE_CLASS
// sends to that class (read from the build script, not restated).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BUILDING_CLASSES } from '../../city-dataset.ts';
import { CURTAIN_WALL, MASONRY_FAMILY, PRE_WAR } from '../physical-materials-constants.ts';
import { buildingFacade, CLASS_FAMILY, FACADE_FAMILIES } from './class-family.ts';

const STYLE_IDS: Record<string, number> = {
  TENEMENT: 0, PREWAR_APT: 1, POSTWAR_BRICK: 2, MODERN_GLASS: 3, DECO_MASONRY: 4,
  ROWHOUSE: 5, LOFT_CASTIRON: 6, INDUSTRIAL: 7, CIVIC_STONE: 8, CHURCH: 9,
  RETAIL_STRIP: 10, GLASS_TOWER_BLUE: 11, PROJECT_BRICK: 12, RETAIL_MODERN: 13,
  FRAME_HOUSE: 14, CONDO_NEW: 15,
};

test('the STYLE ids per class match build.mjs STYLE_CLASS', () => {
  const decode = readFileSync(new URL('../../../../../../tooling/city/valdrada/decode.mjs', import.meta.url), 'utf8');
  for (const [name, id] of Object.entries(STYLE_IDS)) assert.match(decode, new RegExp(`${name}: ${id}\\b`), `decode.mjs STYLE.${name}`);
  const build = readFileSync(new URL('../../../../../../tooling/city/build.mjs', import.meta.url), 'utf8');
  const table = build.slice(build.indexOf('const STYLE_CLASS = {'), build.indexOf('};', build.indexOf('const STYLE_CLASS = {')));
  const styleClass = new Map<number, string>();
  for (const m of table.matchAll(/\[STYLE\.(\w+)\]: '(\w+)'/g)) styleClass.set(STYLE_IDS[m[1]!]!, m[2]!);
  assert.equal(styleClass.size, 16, 'all 16 STYLE ids mapped in build.mjs');
  for (const cls of BUILDING_CLASSES) {
    const expected = [...styleClass].filter(([, c]) => c === cls).map(([id]) => id).sort((a, b) => a - b);
    assert.deepEqual([...CLASS_FAMILY[cls].styles].sort((a, b) => a - b), expected, cls);
  }
});

test("every class lands on one of Slop's four families; nycha is brick with the facelift kit", () => {
  for (const cls of BUILDING_CLASSES) assert.ok(FACADE_FAMILIES.includes(CLASS_FAMILY[cls].family), cls);
  assert.equal(CLASS_FAMILY.nycha.family, 'brick');
  assert.equal(CLASS_FAMILY.nycha.facelift, true);
  for (const cls of BUILDING_CLASSES) if (cls !== 'nycha') assert.equal(CLASS_FAMILY[cls].facelift, false, cls);
  assert.equal(CLASS_FAMILY.glass.family, 'curtainWall');
  assert.equal(CLASS_FAMILY.brownstone.family, 'brownstone');
});

test('the building facade falls back to the Slop family module and is a pure function of the id', () => {
  const plain = buildingFacade({ id: 'x:1', class: 'brick' });
  assert.equal(plain.floorHeight, MASONRY_FAMILY.brick.floorHeight);
  assert.equal(plain.windowWidth, MASONRY_FAMILY.brick.windowWidth);
  assert.equal(plain.cornerPier, PRE_WAR.cornerPier);
  assert.deepEqual(buildingFacade({ id: 'x:1', class: 'brick' }), plain);
  assert.notEqual(buildingFacade({ id: 'x:2', class: 'brick' }).seedTone, plain.seedTone);
  // Slop's seed packing: the fraction stays inside 0.1..0.9 so floor() is stable on varyings.
  for (let i = 0; i < 200; i++) {
    const frac = buildingFacade({ id: `b:${i}`, class: 'civic' }).seedTone % 1;
    assert.ok(frac >= 0.1 - 1e-9 && frac <= 0.9 + 1e-9, String(frac));
  }
  const glass = buildingFacade({ id: 'g', class: 'glass', windowWidthMeters: 3, floorHeightMeters: 4.2 });
  assert.deepEqual([glass.windowWidth, glass.floorHeight, glass.cornerPier, glass.masonryIndex], [3, 4.2, 0, -1]);
  assert.equal(buildingFacade({ id: 'g', class: 'glass' }).floorHeight, CURTAIN_WALL.floorHeight);
});
