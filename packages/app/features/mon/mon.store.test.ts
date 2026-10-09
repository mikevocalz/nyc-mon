import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptySave } from '@acme/core/save';
import { createInitialCareState, resolveSceneMode } from '@acme/core/sim';
import type { MonInstance, SaveCurrent } from '@acme/core/types';
import type { KeyValueStorage } from '../onboarding/storage.types';
import { createSaveIO } from '../onboarding/save-io.ts';
import {
  createMonStore,
  selectActiveCare,
  selectActiveMon,
  selectEvolutionProgress,
  selectLastSeen,
  selectSceneInput,
  selectStage,
  selectStarterBloodlineId,
} from './create-mon-store.ts';
import { MON_MODEL_SLOTS } from './model-slots.ts';

const T0 = Date.UTC(2026, 9, 8, 12, 0, 0);
const PHONE = resolveSceneMode({ platform: 'phone', capabilities: null, anchors: undefined, preference: 'room' });
const KEY = 'save';

function memoryStorage(): KeyValueStorage & { readonly writes: number } {
  const values = new Map<string, string>();
  let writes = 0;
  return {
    getString: (key) => values.get(key),
    set: (key, value) => {
      writes += 1;
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
    get writes() {
      return writes;
    },
  };
}

function mon(id: string, speciesId: string): MonInstance {
  return {
    monInstanceId: id,
    speciesId,
    nickname: null,
    callerId: 'caller-1',
    hatchedAt: T0,
    bond: 0,
    stage: 'Baby',
    voiceLineageId: null,
    originBlock: null,
    habitatTags: [],
    activeHours: null,
  };
}

function seededSave(): SaveCurrent {
  return {
    ...createEmptySave('device-1', T0),
    mons: [mon('mon_a', 'dex-002'), mon('mon_b', 'dex-009')],
    care: [createInitialCareState('mon_a', T0), createInitialCareState('mon_b', T0)],
  };
}

function setup(save: SaveCurrent | null = seededSave()) {
  const storage = memoryStorage();
  const io = createSaveIO(storage, KEY);
  if (save !== null) io.write(save);
  const store = createMonStore(io);
  store.getState().hydrate();
  return { storage, io, store };
}

describe('one Mon store', () => {
  it('two subscribers see the same state object on every change', () => {
    const { store } = setup();
    const seenA: unknown[] = [];
    const seenB: unknown[] = [];
    const offA = store.subscribe((s) => seenA.push(s));
    const offB = store.subscribe((s) => seenB.push(s));
    store.getState().applyCare({ kind: 'play', quality: 1 }, T0 + 60_000);
    store.getState().setActiveMon('mon_b');
    offA();
    offB();
    assert.equal(seenA.length, 2);
    assert.equal(seenA.length, seenB.length);
    seenA.forEach((state, i) => assert.equal(state, seenB[i]));
    assert.equal(seenA.at(-1), store.getState());
  });

  it('queues the effective timestamp after a device-clock rollback', () => {
    const { io, store } = setup();
    store.getState().applyCare({ kind: 'rest' }, T0 + 60_000);
    store.getState().applyCare({ kind: 'wake' }, T0 + 30_000);
    const persisted = io.read();
    assert.ok(persisted);
    assert.equal(persisted.queue.entries.length, 2);
    assert.equal(persisted.queue.entries[0]?.at, T0 + 60_000);
    assert.equal(persisted.queue.entries[1]?.at, T0 + 60_000);
    assert.equal(persisted.savedAt, persisted.care[0]?.updatedAt);
    assert.equal(persisted.queue.entries[1]?.action.kind, 'wake');
  });

  it('writes persist through the save, and a fresh store reads them back', () => {
    const { storage, io, store } = setup();
    const before = storage.writes;
    store.getState().applyCare({ kind: 'play', quality: 1 }, T0 + 60_000);
    assert.equal(storage.writes, before + 1);
    const persisted = io.read();
    assert.deepEqual(persisted, store.getState().save);
    assert.equal(persisted?.queue.entries.length, 1);
    assert.equal(persisted?.queue.entries[0]?.action.kind, 'play');

    const second = createMonStore(io);
    second.getState().hydrate();
    assert.deepEqual(selectActiveCare(second.getState()), selectActiveCare(store.getState()));
  });

  it('keeps a write another feature made after hydrate', () => {
    const { io, store } = setup();
    const outside = io.read();
    assert.ok(outside !== undefined);
    io.write({ ...outside, caller: { ...callerFixture } });
    store.getState().applyCare({ kind: 'rest' }, T0 + 60_000);
    assert.deepEqual(io.read()?.caller, callerFixture);
  });

  it('a profile written by another feature shows up without hydrate()', () => {
    const { io, store } = setup();
    let notified = 0;
    const off = store.subscribe(() => (notified += 1));
    const outside = io.read();
    assert.ok(outside !== undefined);
    io.write({ ...outside, caller: { ...callerFixture } });
    off();
    assert.equal(notified, 1);
    assert.deepEqual(store.getState().save?.caller, callerFixture);
  });

  it('a removed write listener stops receiving writes', () => {
    const { io } = setup();
    let calls = 0;
    const sub = io.addOnWriteListener(() => (calls += 1));
    sub.remove();
    sub.remove();
    const save = io.read();
    assert.ok(save !== undefined);
    io.write(save);
    assert.equal(calls, 0);
  });

  it('holds no second persisted copy: the save key is the only key written', () => {
    const storage = memoryStorage();
    const keys = new Set<string>();
    const spy: KeyValueStorage = { ...storage, set: (k, v) => (keys.add(k), storage.set(k, v)) };
    const io = createSaveIO(spy, KEY);
    io.write(seededSave());
    const store = createMonStore(io);
    store.getState().hydrate();
    store.getState().applyCare({ kind: 'wake' }, T0 + 1);
    assert.deepEqual([...keys], [KEY]);
  });
});

const callerFixture = {
  callerId: 'caller-1',
  callerName: 'Malik',
  birthYear: 2000,
  consentStatus: 'not-required',
  createdAt: T0,
} as const;

describe('hydrate and the active Mon', () => {
  it('is empty with no save', () => {
    const { store } = setup(null);
    assert.equal(store.getState().save, undefined);
    assert.equal(selectActiveMon(store.getState()), undefined);
    assert.throws(() => store.getState().applyCare({ kind: 'rest' }, T0), /hydrate the store first/);
  });

  it('treats an unreadable save as missing', () => {
    const storage = memoryStorage();
    storage.set(KEY, '{not json');
    const store = createMonStore(createSaveIO(storage, KEY));
    store.getState().hydrate();
    assert.equal(store.getState().save, undefined);
  });

  it('defaults to the first Mon and keeps a chosen one across hydrate', () => {
    const { store } = setup();
    assert.equal(store.getState().activeMonInstanceId, 'mon_a');
    store.getState().setActiveMon('mon_b');
    store.getState().hydrate();
    assert.equal(store.getState().activeMonInstanceId, 'mon_b');
  });

  it('refuses an unknown Mon', () => {
    const { store } = setup();
    assert.throws(() => store.getState().setActiveMon('nobody'), /No Mon nobody/);
  });

  it('a care action only touches the active Mon', () => {
    const { store } = setup();
    const before = store.getState().save?.care.find((c) => c.monInstanceId === 'mon_b');
    store.getState().applyCare({ kind: 'play', quality: 1 }, T0 + 60_000);
    assert.deepEqual(store.getState().save?.care.find((c) => c.monInstanceId === 'mon_b'), before);
  });
});

describe('selectors', () => {
  it('read identity, starter, stage and evolution progress', () => {
    const { store } = setup();
    const state = store.getState();
    assert.equal(selectActiveMon(state)?.monInstanceId, 'mon_a');
    assert.equal(selectStarterBloodlineId(state), 'F01');
    assert.equal(selectStage(state), 'Baby');
    assert.deepEqual(selectEvolutionProgress(state), { stage: 'Baby', bond: 0, evolutionEnabled: false });
    store.getState().setActiveMon('mon_b');
    assert.equal(selectStarterBloodlineId(store.getState()), 'F02');
  });

  it('returns undefined for a species content does not ship', () => {
    const { store } = setup({ ...seededSave(), mons: [mon('mon_a', 'dex-999')] });
    assert.equal(selectStarterBloodlineId(store.getState()), undefined);
    assert.equal(selectSceneInput(PHONE)(store.getState()), undefined);
  });

  it('last-seen follows care writes and is stable between them', () => {
    const { store } = setup();
    const first = selectLastSeen(store.getState());
    assert.equal(selectLastSeen(store.getState()), first);
    assert.equal(first?.careUpdatedAt, T0);
    store.getState().applyCare({ kind: 'play', quality: 1 }, T0 + 60_000);
    const after = selectLastSeen(store.getState());
    assert.notEqual(after, first);
    assert.equal(after?.lastSocialAt, T0 + 60_000);
  });

  it('scene input is stable until the Mon or its care changes', () => {
    const { store } = setup();
    const select = selectSceneInput(PHONE);
    const first = select(store.getState());
    assert.equal(select(store.getState()), first);
    assert.equal(first?.mon.bloodlineId, 'F01');
    assert.equal(first?.mode, 'screen');
    assert.equal(first?.placement, null);
    assert.equal(first?.legend, null);
    assert.equal(first !== undefined && 'anchors' in first, false);
    store.getState().applyCare({ kind: 'rest' }, T0 + 60_000);
    const asleep = select(store.getState());
    assert.notEqual(asleep, first);
    assert.equal(asleep?.mon.mood, 'asleep');
    assert.equal(asleep?.mon.intent, 'sleep');
  });
});

describe('model slots', () => {
  it('ship one empty slot per bloodline × stage', () => {
    assert.equal(MON_MODEL_SLOTS.length, 3 * 5);
    for (const slot of MON_MODEL_SLOTS) {
      assert.equal(slot.glbUri, null);
      assert.ok(Object.values(slot.clips).every((clip) => clip === null));
    }
  });
});
