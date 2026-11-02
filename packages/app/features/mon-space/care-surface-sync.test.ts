import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { createCareSurfaceSync } from './care-surface-sync.ts';
import type { MonCareSurfacesInput } from './publish-mon-care.ts';

const input = (id: string): MonCareSurfacesInput => ({
  monInstanceId: id, monName: id, now: 1000, predictions: [],
  view: { hearts: { fullness: 2, energy: 4, social: 3 }, poop: 0, cold: null, asleep: false, paused: false, attention: 'none' },
});

test('hydrate/action ticks coalesce and a Mon switch clears the old schedule before publishing the new one', async () => {
  let current: MonCareSurfacesInput | null = input('a');
  const calls: string[] = [];
  const sync = createCareSurfaceSync({
    read: () => current,
    publish: async (value) => { calls.push(`publish:${value.monInstanceId}`); },
    clear: async () => { calls.push('clear'); }, report: (error) => { throw error; },
  });
  sync.refresh(); sync.refresh();
  await setImmediate();
  assert.deepEqual(calls, ['clear', 'publish:a']);
  current = input('b'); sync.refresh();
  await setImmediate();
  assert.deepEqual(calls.slice(-2), ['clear', 'publish:b']);
  current = null; sync.refresh();
  await setImmediate();
  assert.equal(calls.at(-1), 'clear');
});

test('sign-out cancels an already queued refresh and clears surfaces', async () => {
  const calls: string[] = [];
  const sync = createCareSurfaceSync({ read: () => input('a'), publish: async () => { calls.push('publish'); },
    clear: async () => { calls.push('clear'); }, report: (error) => { throw error; } });
  sync.refresh(); sync.stop();
  await setImmediate();
  assert.deepEqual(calls, ['clear']);
  sync.refresh();
  await setImmediate();
  assert.deepEqual(calls, ['clear']);
});

test('preference refresh republishes unchanged care so enabling Mon calls schedules immediately', async () => {
  let publishes = 0;
  const sync = createCareSurfaceSync({ read: () => input('a'), publish: async () => { publishes++; }, clear: async () => {}, report: (error) => { throw error; } });
  sync.refresh(); await setImmediate();
  sync.refresh(); await setImmediate();
  assert.equal(publishes, 2);
});
