import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Node can't load .webp; stand in a Next-style StaticImageData for each import.
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.webp')) return nextLoad(url, context);
    const data = { src: new URL(url).pathname, width: 1200, height: 800 };
    return { format: 'module', source: `export default ${JSON.stringify(data)};`, shortCircuit: true };
  },
});

const { ART_SLOTS, WORLD_SLOTS, art, artHref, starterArt } = await import('./art.ts');

const EXPECTED = [
  'hero',
  'world.primary',
  'world.secondary',
  'world.detail',
  'hlynk.static',
  'hlynk.scanner',
  'hlynk.controls',
  'care',
  'hatch',
];

test('the map covers exactly the slot union', () => {
  assert.deepEqual([...ART_SLOTS].sort(), [...EXPECTED].sort());
});

test('every slot resolves to a local asset with positive dimensions and sizes', () => {
  for (const slot of ART_SLOTS) {
    const entry = art(slot);
    assert.ok(entry.src, `${slot}: src`);
    assert.ok(entry.width > 0 && entry.height > 0, `${slot}: dimensions`);
    assert.ok(entry.sizes.length > 0, `${slot}: sizes`);
    assert.doesNotMatch(artHref(entry), /^https?:/, `${slot}: hotlinked`);
  }
});

test('alt text is present unless the slot is decorative with a reason', () => {
  for (const slot of ART_SLOTS) {
    const entry = art(slot);
    if (entry.decorative) {
      assert.equal(entry.alt, '', `${slot}: decorative art has empty alt`);
      assert.ok(entry.decorative.reason.trim().length > 0, `${slot}: decorative reason`);
    } else {
      assert.ok(entry.alt.trim().length > 0, `${slot}: alt`);
    }
  }
});

test('world frames are the dominant frame then the supporting one, in DOM order', () => {
  assert.deepEqual([...WORLD_SLOTS], ['world.primary', 'world.secondary']);
});

test('world sizes describe the grid columns each frame occupies', () => {
  assert.match(art('world.primary').sizes, /47rem/);
  assert.match(art('world.secondary').sizes, /33rem/);
});

test('starter art keys off @acme/content slot numbers; every starter Baby has its own art', () => {
  for (const id of [1, 2, 3, 4] as const) assert.ok(starterArt(id), `slot ${id}: art`);
  assert.match(starterArt(4)!.alt, /^Fye Dot/, 'slot 4 is Fye Dot, never another Mon');
});

test('creature art fills the starter and hatch slots and carries no place caption (PS-028)', () => {
  const entries = [
    ['starter 1', starterArt(1)],
    ['starter 2', starterArt(2)],
    ['starter 3', starterArt(3)],
    ['starter 4', starterArt(4)],
    ['hatch', art('hatch')],
  ] as const;
  for (const [slot, entry] of entries) {
    assert.ok(entry, `${slot}: art`);
    assert.match(artHref(entry), /creatures\//, `${slot}: reads @acme/assets/creatures`);
    assert.equal(entry.caption, undefined, `${slot}: a Mon is not a place`);
    assert.equal(entry.district, undefined, `${slot}: no district disc`);
    assert.ok(entry.focalPoint, `${slot}: focal point for the crops`);
    assert.ok(entry.blurDataURL?.startsWith('data:image/webp;base64,'), `${slot}: blur placeholder`);
  }
});

test('each starter poster names its own Baby form, with no pronoun for the Mon (PS-005)', () => {
  const names = { 1: 'Squeaklet', 2: 'Kittee Cee', 3: 'Yotito' } as const;
  for (const [slot, name] of Object.entries(names)) {
    const alt = starterArt(Number(slot) as 1 | 2 | 3)?.alt ?? '';
    assert.ok(alt.startsWith(`${name}, `), `${slot}: alt names ${name}`);
    assert.doesNotMatch(alt, /\b(it|its|he|his|him|she|her)\b/i, `${slot}: no pronoun`);
  }
});
