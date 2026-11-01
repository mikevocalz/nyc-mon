import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createStreetLabelSource } from './walk-street.ts';

// A real baked pack: the home tile's own labels, read off disk like the other systems tests.
const PACK = readFileSync(new URL('../world/vd-port/systems/data/labels/-1_0.bin', import.meta.url));

test('a cell pack decodes to named streets, fetched once and cached', async () => {
  let calls = 0;
  const source = createStreetLabelSource(async (key) => {
    calls++;
    return key === '-1_0' ? new Uint8Array(PACK) : null;
  });
  const labels = await source.ensure(-1, 0);
  assert.ok(labels.length > 0, 'the baked cell carries street names');
  assert.ok(labels.every((l) => l.name.length > 0));
  await source.ensure(-1, 0);
  assert.equal(calls, 1, 'the second ask hits the cache');
});

test('a missing pack caches as an empty cell', async () => {
  let calls = 0;
  const source = createStreetLabelSource(async () => {
    calls++;
    return null;
  });
  assert.deepEqual(await source.ensure(4, 4), []);
  await source.ensure(4, 4);
  assert.equal(calls, 1);
});

test('nearest() answers with the closest decoded name', async () => {
  const source = createStreetLabelSource(async (key) => (key === '-1_0' ? new Uint8Array(PACK) : null));
  await source.ensure(-1, 0);
  const first = (await source.ensure(-1, 0))[0]!;
  const near = source.nearest(first.x, first.z)!;
  assert.equal(near.label.name, first.name);
  assert.ok(near.meters < 1);
});
