import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STORAGE_KEY,
  createControllerLayoutStore,
  readControllerLayouts,
  type ControllerLayoutStorage,
} from './controller-layout.store.shared.ts';

function memoryStorage(seed: Record<string, string> = {}): ControllerLayoutStorage & { values: Map<string, string> } {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  };
}

test('an empty store reads as the empty map and writes nothing', () => {
  const storage = memoryStorage();
  const store = createControllerLayoutStore(storage, readControllerLayouts(storage));
  assert.deepEqual(store.getState().layouts, {});
  assert.equal(storage.values.size, 0);
});

test('setOffset and setScale persist per profile and survive a re-read', () => {
  const storage = memoryStorage();
  const store = createControllerLayoutStore(storage, readControllerLayouts(storage));
  store.getState().setOffset('phone-portrait', 'stick', { dx: 24, dy: -40 });
  store.getState().setScale('phone-portrait', 1.2);
  store.getState().setOffset('tablet', 'cluster', { dx: -10, dy: 0 });
  const reread = createControllerLayoutStore(storage, readControllerLayouts(storage));
  assert.deepEqual(reread.getState().layouts, {
    'phone-portrait': { stick: { dx: 24, dy: -40 }, scale: 1.2 },
    tablet: { cluster: { dx: -10, dy: 0 } },
  });
});

test('writes are clamped; non-finite input throws and persists nothing', () => {
  const storage = memoryStorage();
  const store = createControllerLayoutStore(storage, readControllerLayouts(storage));
  store.getState().setScale('web', 7);
  store.getState().setOffset('web', 'stick', { dx: 99999, dy: 0 });
  assert.deepEqual(store.getState().layouts.web, { scale: 1.4, stick: { dx: 4096, dy: 0 } });
  assert.throws(() => store.getState().setOffset('web', 'cluster', { dx: Number.NaN, dy: 0 }), RangeError);
  assert.equal(store.getState().layouts.web?.cluster, undefined);
});

test('a malformed blob is removed and reads as empty', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{not json' });
  assert.deepEqual(readControllerLayouts(storage), {});
  assert.equal(storage.getString(STORAGE_KEY), undefined);
});

test('invalid entries in a well-formed blob are dropped on read, valid ones kept', () => {
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      'phone-portrait': { stick: { dx: 'far', dy: 0 }, cluster: { dx: 5, dy: 5 } },
      'fold-tabletop': { scale: 99 },
      bogus: { stick: { dx: 1, dy: 1 } },
    }),
  });
  assert.deepEqual(readControllerLayouts(storage), { 'phone-portrait': { cluster: { dx: 5, dy: 5 } } });
});

test('reset(profile) forgets one profile; reset() forgets all and clears storage', () => {
  const storage = memoryStorage();
  const store = createControllerLayoutStore(storage, readControllerLayouts(storage));
  store.getState().setOffset('phone-portrait', 'stick', { dx: 1, dy: 1 });
  store.getState().setOffset('fold-book', 'stick', { dx: 2, dy: 2 });
  store.getState().reset('phone-portrait');
  assert.deepEqual(store.getState().layouts, { 'fold-book': { stick: { dx: 2, dy: 2 } } });
  store.getState().reset();
  assert.deepEqual(store.getState().layouts, {});
  assert.equal(storage.getString(STORAGE_KEY), undefined);
});
