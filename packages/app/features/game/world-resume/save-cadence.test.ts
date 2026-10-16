import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { INITIAL_CITY_CAMERA } from '../city-camera.ts';
import type { CityDataset } from '../city-dataset.ts';
import { decideSave, draftRevision, SAVE_INTERVAL_MS } from './save-cadence.ts';
import { createWorldSaveStore, readWorldSaveSnapshot, WORLD_SAVE_KEY, type WorldSaveStorage } from './world-save.store.shared.ts';
import { createWorldSessionStore } from './world-session.store.ts';
import { buildWorldSave, cameraChangedSince, datasetOriginOf, mintSessionId, mintWorldInstanceId } from './world-snapshot.ts';

const T0 = Date.UTC(2026, 9, 15, 12, 0, 0);
const identity = { playerId: 'caller-1', deviceId: 'device-a' };
const dataset: CityDataset = {
  version: 1,
  id: 'harlem-apollo-20261014',
  origin: [-73.94975, 40.81005],
  source: { url: 'https://example.invalid/tile', attribution: 'test', license: 'ODbL', retrievedAt: '2026-10-14T00:00:00Z' },
  features: [],
};

function memoryStorage(): WorldSaveStorage & { readonly writes: string[] } {
  const map = new Map<string, string>();
  const writes: string[] = [];
  return {
    writes,
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
      writes.push(value);
    },
    remove: (key) => {
      map.delete(key);
    },
  };
}

describe('save cadence: bounded, never per frame, idempotent by revision', () => {
  const base = { pill: 'playing' as const, now: T0, lastSavedAt: T0 - SAVE_INTERVAL_MS, storedRevision: 3, draftRevision: 4 };

  it('a tick saves only while playing and only once the interval elapsed', () => {
    assert.deepEqual(decideSave({ ...base, trigger: 'tick' }), { save: true, revision: 4 });
    assert.deepEqual(decideSave({ ...base, trigger: 'tick', lastSavedAt: T0 - SAVE_INTERVAL_MS + 1 }), { save: false, why: 'interval-not-elapsed' });
    assert.deepEqual(decideSave({ ...base, trigger: 'tick', pill: 'paused' }), { save: false, why: 'not-playing' });
    assert.deepEqual(decideSave({ ...base, trigger: 'tick', lastSavedAt: null }), { save: true, revision: 4 });
  });

  it('pause, background, stop and exit save as soon as the draft is dirty, whatever the interval says', () => {
    for (const trigger of ['pause', 'background', 'stop', 'exit'] as const) {
      assert.deepEqual(decideSave({ ...base, trigger, pill: 'paused', lastSavedAt: T0 - 1 }), { save: true, revision: 4 });
    }
  });

  it('an unchanged draft never writes, from any trigger', () => {
    for (const trigger of ['tick', 'pause', 'background', 'stop', 'exit'] as const) {
      assert.deepEqual(decideSave({ ...base, trigger, draftRevision: 3 }), { save: false, why: 'unchanged' });
    }
    assert.equal(draftRevision(3, false), 3);
    assert.equal(draftRevision(3, true), 4);
    assert.equal(draftRevision(0, true), 1);
  });

  it('one thousand gesture-rate decisions between ticks produce exactly one write', () => {
    let writes = 0;
    let stored = 3;
    let lastSavedAt: number | null = T0 - SAVE_INTERVAL_MS;
    for (let i = 0; i < 1000; i++) {
      // The camera moved before every decision (draft is always dirty), as it would at gesture rate.
      const d = decideSave({ ...base, trigger: 'tick', now: T0 + i, lastSavedAt, storedRevision: stored, draftRevision: draftRevision(stored, true) });
      if (d.save) {
        writes++;
        stored = d.revision;
        lastSavedAt = T0 + i;
      }
    }
    assert.equal(writes, 1);
    assert.equal(stored, 4);
  });
});

describe('world snapshot', () => {
  const camera = { x: 412.5, z: -187.25, yaw: Math.PI / 3, distance: 160 };

  it('a new game mints revision 1 and a world instance; later saves keep the world and bump the revision', () => {
    const sessionId = mintSessionId(identity, T0);
    const first = buildWorldSave({ previous: null, identity, sessionId, camera, dataset, pill: 'playing', now: T0 });
    assert.equal(first.revision, 1);
    assert.equal(first.worldInstanceId, mintWorldInstanceId(identity, dataset, T0));
    assert.equal(first.sync.pendingSince, T0);
    assert.deepEqual(first.camera, camera);
    assert.deepEqual(first.dataset, { datasetId: dataset.id, datasetVersion: 1, originRef: datasetOriginOf(dataset) });
    const second = buildWorldSave({ previous: first, identity, sessionId, camera: { ...camera, x: 1 }, dataset, pill: 'paused', now: T0 + 1 });
    assert.equal(second.revision, 2);
    assert.equal(second.worldInstanceId, first.worldInstanceId);
    assert.equal(second.sessionId, sessionId);
    assert.equal(second.sync.pendingSince, T0);
    assert.notEqual(mintSessionId(identity, T0 + 1), sessionId);
  });

  it('the canonical position is the camera target unprojected through the dataset origin', () => {
    const save = buildWorldSave({ previous: null, identity, sessionId: 's', camera, dataset, pill: 'playing', now: T0 });
    assert.equal(save.position.crs, 'EPSG:4326');
    assert.ok(Math.abs(save.position.longitude - dataset.origin[0]) < 0.01);
    assert.ok(save.position.longitude > dataset.origin[0]);
    assert.ok(save.position.latitude > dataset.origin[1]);
    assert.ok(Math.abs(save.headingRadians - (2 * Math.PI - Math.PI / 3)) < 1e-12);
  });

  it('cameraChangedSince is the dirty flag the cadence reads', () => {
    const save = buildWorldSave({ previous: null, identity, sessionId: 's', camera, dataset, pill: 'playing', now: T0 });
    assert.equal(cameraChangedSince(null, camera, 'playing'), true);
    assert.equal(cameraChangedSince(save, camera, 'playing'), false);
    assert.equal(cameraChangedSince(save, { ...camera, distance: 161 }, 'playing'), true);
    assert.equal(cameraChangedSince(save, camera, 'paused'), true);
  });
});

describe('world save store (shared)', () => {
  it('reads synchronously at creation, commits forward only, and rejects an invalid save before the disk sees it', () => {
    const storage = memoryStorage();
    assert.deepEqual(readWorldSaveSnapshot(storage), { status: 'missing' });
    const store = createWorldSaveStore(storage, readWorldSaveSnapshot(storage));
    const sessionId = mintSessionId(identity, T0);
    const first = buildWorldSave({ previous: null, identity, sessionId, camera: INITIAL_CITY_CAMERA, dataset, pill: 'playing', now: T0 });
    assert.equal(store.getState().commit(first), 'written');
    assert.equal(store.getState().commit(first), 'skipped-stale');
    const second = buildWorldSave({ previous: first, identity, sessionId, camera: { ...INITIAL_CITY_CAMERA, x: 5 }, dataset, pill: 'playing', now: T0 + 1 });
    assert.equal(store.getState().commit(second), 'written');
    assert.equal(store.getState().commit(first), 'skipped-stale');
    assert.equal(storage.writes.length, 2);
    assert.throws(() => store.getState().commit({ ...second, revision: 99, camera: { ...second.camera, x: 2001 } }));
    assert.equal(storage.writes.length, 2);
    const reopened = createWorldSaveStore(storage, readWorldSaveSnapshot(storage));
    assert.deepEqual(reopened.getState().snapshot, { status: 'loaded', save: second });
    storage.set(WORLD_SAVE_KEY, '{broken');
    assert.deepEqual(readWorldSaveSnapshot(storage), { status: 'unreadable', reason: 'corrupt', raw: '{broken' });
  });
});

describe('world session store', () => {
  it('holds the core machine and returns effects for the caller to run', () => {
    const store = createWorldSessionStore();
    assert.equal(store.getState().pill, 'start');
    assert.deepEqual(store.getState().dispatch({ type: 'start', sessionId: 's1', at: T0 }), []);
    assert.equal(store.getState().pill, 'playing');
    const effects = store.getState().dispatch({ type: 'pillPress', at: T0 + 1 });
    assert.deepEqual(effects, [{ kind: 'request-save', reason: 'pause', sessionId: 's1', at: T0 + 1 }]);
    assert.equal(store.getState().pill, 'paused');
    assert.deepEqual(store.getState().dispatch({ type: 'confirmStop', at: T0 + 2 }), []);
    assert.equal(store.getState().pill, 'paused');
  });
});
