import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptySave } from '@acme/core/save';
import { createSaveIO } from './save-io.ts';
import type { KeyValueStorage } from './storage.types.ts';

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getString: (k) => data.get(k),
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
}

const KEY = 'nyc-mon-save';

describe('save IO last-good copy (M22)', () => {
  it('copies every intact write to the last-good key', () => {
    const storage = memory();
    const io = createSaveIO(storage, KEY);
    const save = createEmptySave('device-a', 1_000);
    io.write(save);
    assert.equal(storage.data.get(`${KEY}:last-good`), JSON.stringify(save));
    assert.equal(io.lastGood().status, 'available');
  });

  it('does not copy a write that storage did not keep intact', () => {
    const storage = memory();
    const io = createSaveIO({ ...storage, set: (k, v) => storage.set(k, k === KEY ? v.slice(0, 5) : v) }, KEY);
    io.write(createEmptySave('device-a', 1_000));
    assert.equal(storage.data.has(`${KEY}:last-good`), false);
    assert.deepEqual(io.lastGood(), { status: 'none' });
  });

  it('restores the last good save over a corrupt one and keeps the broken bytes', () => {
    const storage = memory();
    const io = createSaveIO(storage, KEY);
    const save = createEmptySave('device-a', 1_000);
    io.write(save);
    storage.set(KEY, '{broken');
    assert.equal(io.read(), undefined);
    const heard: unknown[] = [];
    io.addOnWriteListener((s) => heard.push(s));
    assert.deepEqual(io.restoreLastGood(), save);
    assert.deepEqual(io.read(), save);
    assert.equal(storage.data.get(`${KEY}:broken`), '{broken');
    assert.equal(heard.length, 1);
  });

  it('changes nothing when there is no readable copy to restore', () => {
    const storage = memory();
    const io = createSaveIO(storage, KEY);
    storage.set(KEY, '{broken');
    assert.equal(io.restoreLastGood(), undefined);
    assert.equal(storage.data.get(KEY), '{broken');
    assert.equal(storage.data.has(`${KEY}:broken`), false);
  });

  it('starts over with a fresh save and keeps the broken bytes', () => {
    const storage = memory();
    const io = createSaveIO(storage, KEY);
    storage.set(KEY, '{broken');
    const fresh = createEmptySave('device-b', 2_000);
    io.startOver(fresh);
    assert.deepEqual(io.read(), fresh);
    assert.equal(storage.data.get(`${KEY}:broken`), '{broken');
  });
});
