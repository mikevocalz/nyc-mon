import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { WorldSave } from '@acme/core';
import { guardedSave } from './save-cadence.ts';
import {
  createWorldSaveStore,
  readOrMintDeviceId,
  WORLD_DEVICE_KEY,
  WORLD_SAVE_KEY,
  WORLD_SAVE_QUARANTINE_KEY,
  type WorldSaveStorage,
} from './world-save.store.shared.ts';
import { mintSessionId, ownedPrevious, pickDeviceId, sessionIdForStart } from './world-snapshot.ts';

const T0 = Date.UTC(2026, 9, 15, 12, 0, 0);
const callerA = { playerId: 'caller-a', deviceId: 'device-1' };
const callerB = { playerId: 'caller-b', deviceId: 'device-1' };

const saveOfA = {
  version: 1,
  revision: 4,
  savedAt: T0,
  deviceId: 'device-1',
  playerId: 'caller-a',
  sessionId: 'session-a',
  worldInstanceId: 'world-a',
  districtId: null,
  position: { crs: 'EPSG:4326', longitude: -73.95, latitude: 40.81 },
  dataset: { datasetId: 'harlem-apollo-20261014', datasetVersion: 1, originRef: { crs: 'EPSG:4326', longitude: -73.94975, latitude: 40.81005 } },
  headingRadians: 0,
  camera: { x: 0, z: 0, yaw: 0, distance: 200 },
  gameplay: { pill: 'paused' },
  sync: { syncedRevision: 0, pendingSince: T0 },
} as unknown as WorldSave;

function memory(): WorldSaveStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getString: (k) => map.get(k), set: (k, v) => { map.set(k, v); }, remove: (k) => { map.delete(k); } };
}

describe('world save ownership (finding M1)', () => {
  it("another Caller's save is never the previous one", () => {
    assert.equal(ownedPrevious(saveOfA, callerA), saveOfA);
    assert.equal(ownedPrevious(saveOfA, callerB), 'foreign');
    assert.equal(ownedPrevious(null, callerB), null);
  });
});

describe('session id on start (finding L5)', () => {
  it("continues the Caller's saved session and mints only for a new game", () => {
    assert.equal(sessionIdForStart(saveOfA, callerA, T0 + 5), 'session-a');
    assert.equal(sessionIdForStart(saveOfA, callerB, T0 + 5), mintSessionId(callerB, T0 + 5));
    assert.equal(sessionIdForStart(null, callerA, T0 + 5), mintSessionId(callerA, T0 + 5));
  });
});

describe('device id (finding M2)', () => {
  it('is minted once, persisted, and returned unchanged after', () => {
    const storage = memory();
    let minted = 0;
    const mint = () => `device-${++minted}`;
    const first = readOrMintDeviceId(storage, mint);
    assert.equal(storage.map.get(WORLD_DEVICE_KEY), first);
    assert.equal(readOrMintDeviceId(storage, mint), first);
    assert.equal(minted, 1);
  });

  it("prefers the Mon save's queue id, else the persisted world id", () => {
    assert.equal(pickDeviceId('device-q', () => 'device-w'), 'device-q');
    assert.equal(pickDeviceId('', () => 'device-w'), 'device-w');
    assert.equal(pickDeviceId(undefined, () => 'device-w'), 'device-w');
  });
});

describe('start new keeps an unreadable save for diagnosis (finding M20)', () => {
  it('quarantines the raw value before forgetting it', () => {
    const storage = memory();
    storage.set(WORLD_SAVE_KEY, '{not json');
    const store = createWorldSaveStore(storage, { status: 'unreadable', reason: 'corrupt', raw: '{not json' } as never);
    store.getState().clear();
    assert.equal(storage.map.get(WORLD_SAVE_KEY), undefined);
    assert.equal(storage.map.get(WORLD_SAVE_QUARANTINE_KEY), '{not json');
    assert.deepEqual(store.getState().snapshot, { status: 'missing' });
  });

  it('a readable save is cleared without a quarantine copy', () => {
    const storage = memory();
    const store = createWorldSaveStore(storage, { status: 'missing' });
    store.getState().clear();
    assert.equal(storage.map.has(WORLD_SAVE_QUARANTINE_KEY), false);
  });
});

describe('save failures are reported, never swallowed (finding L4)', () => {
  it('a throwing write is reported with where it happened and the cadence carries on', () => {
    const reports: [string, unknown][] = [];
    const boom = new Error('schema rejected the save');
    guardedSave('tick', () => { throw boom; }, (where, error) => { reports.push([where, error]); });
    let ran = false;
    guardedSave('tick', () => { ran = true; }, (where, error) => { reports.push([where, error]); });
    assert.deepEqual(reports, [['tick', boom]]);
    assert.equal(ran, true);
  });
});
