import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONTROLLER_PROFILE } from '@acme/ui/game-controls/parts';
import {
  STORAGE_KEY,
  createControllerProfileStore,
  readControllerProfile,
  type ControllerProfileStorage,
} from './controller-profile.store.shared.ts';

function memoryStorage(seed: Record<string, string> = {}): ControllerProfileStorage & { values: Map<string, string> } {
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

test('an empty store reads as the contract default and writes nothing', () => {
  const storage = memoryStorage();
  const store = createControllerProfileStore(storage, readControllerProfile(storage));
  assert.equal(store.getState().profile, DEFAULT_CONTROLLER_PROFILE);
  assert.equal(storage.values.size, 0);
});

test('set persists a validated patch, nested stick tuning included, and survives a re-read', () => {
  const storage = memoryStorage();
  const store = createControllerProfileStore(storage, readControllerProfile(storage));
  store.getState().set({ handedness: 'left', scale: 1.2 });
  store.getState().set({ stick: { ...DEFAULT_CONTROLLER_PROFILE.stick, deadZone: 0.3 } });
  const reread = createControllerProfileStore(storage, readControllerProfile(storage));
  assert.deepEqual(reread.getState().profile, {
    ...DEFAULT_CONTROLLER_PROFILE,
    handedness: 'left',
    scale: 1.2,
    stick: { ...DEFAULT_CONTROLLER_PROFILE.stick, deadZone: 0.3 },
  });
});

test('an out-of-range patch is dropped whole and persists nothing', () => {
  const storage = memoryStorage();
  const store = createControllerProfileStore(storage, readControllerProfile(storage));
  const before = store.getState().profile;
  store.getState().set({ scale: 3, handedness: 'left' });
  assert.equal(store.getState().profile, before, 'handedness did not sneak through with the bad scale');
  store.getState().set({ stick: { ...before.stick, sensitivity: Number.NaN } });
  assert.equal(store.getState().profile, before);
  assert.equal(storage.values.size, 0);
});

test('a malformed blob is removed and reads as the default', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{not json' });
  assert.equal(readControllerProfile(storage), DEFAULT_CONTROLLER_PROFILE);
  assert.equal(storage.getString(STORAGE_KEY), undefined);
});

test('a well-formed blob that fails the schema is removed and reads as the default', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ ...DEFAULT_CONTROLLER_PROFILE, opacity: 0.1 }) });
  assert.equal(readControllerProfile(storage), DEFAULT_CONTROLLER_PROFILE);
  assert.equal(storage.getString(STORAGE_KEY), undefined);
});

test('a newer build\'s extra keys are stripped on read', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ ...DEFAULT_CONTROLLER_PROFILE, haptics: 'strong', placement: {} }) });
  assert.deepEqual(readControllerProfile(storage), { ...DEFAULT_CONTROLLER_PROFILE, haptics: 'strong' });
});

test('reset returns to the default and clears storage', () => {
  const storage = memoryStorage();
  const store = createControllerProfileStore(storage, readControllerProfile(storage));
  store.getState().set({ stickMode: 'dpad', haptics: 'off' });
  assert.equal(storage.values.size, 1);
  store.getState().reset();
  assert.equal(store.getState().profile, DEFAULT_CONTROLLER_PROFILE);
  assert.equal(storage.getString(STORAGE_KEY), undefined);
});
