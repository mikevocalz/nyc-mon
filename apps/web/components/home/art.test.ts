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

const { ART_SLOTS, WORLD_SLOTS, art, artHref, starterSlot } = await import('./art.ts');

const EXPECTED = [
  'hero',
  'world.primary',
  'world.secondary',
  'world.detail',
  'hlynk.static',
  'hlynk.scanner',
  'hlynk.controls',
  'starter.1',
  'starter.2',
  'starter.3',
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

test('starter slots key off @acme/content slot numbers', () => {
  assert.equal(starterSlot(1), 'starter.1');
  assert.equal(starterSlot(3), 'starter.3');
});
