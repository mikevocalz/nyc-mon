import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eggs } from '@acme/content';
import { createEmptySave } from '@acme/core/save';
import {
  advanceCare,
  createEggRecord,
  createHatchState,
  createInitialCareState,
  DEFAULT_CARE_TUNING,
  deriveMonInstanceId,
  HatchIntegrityError,
  mintMonInstance,
  validateMonName,
} from '@acme/core/sim';
import type { CallerProfile, MonInstance, SaveCurrent } from '@acme/core/types';
import type { KeyValueStorage } from '../onboarding/storage.types';
import { createSaveIO } from '../onboarding/save-io.ts';
import {
  createMonStore,
  localDayKey,
  selectActiveMon,
  selectCallerIsUnder13,
  selectCareNow,
  selectDaysTogether,
  selectJournal,
  selectPendingEgg,
} from './create-mon-store.ts';
import { parseReadyNotificationData } from './ready-notification.ts';

const T0 = Date.UTC(2026, 9, 8, 12, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const KEY = 'save';

const caller: CallerProfile = {
  callerId: 'caller-1',
  callerName: 'Malik',
  birthYear: 2000,
  consentStatus: 'not-required',
  createdAt: T0,
};

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

function setup(save: SaveCurrent | null) {
  const storage = memoryStorage();
  const io = createSaveIO(storage, KEY);
  if (save !== null) io.write(save);
  let n = 0;
  const store = createMonStore(io, { newEggId: () => `egg-test-${++n}` });
  store.getState().hydrate();
  return { storage, io, store };
}

const withCaller = (overrides: Partial<SaveCurrent> = {}): SaveCurrent => ({
  ...createEmptySave('device-1', T0),
  caller,
  ...overrides,
});

const metroEgg = eggs[0];
assert.ok(metroEgg !== undefined);

function eggAt(createdAt = T0, eggId = 'egg-1') {
  return createEggRecord({
    eggId,
    speciesId: metroEgg!.speciesId,
    hatchesIntoSpeciesId: metroEgg!.hatchesIntoSpeciesId,
    callerId: caller.callerId,
    nickname: null,
    incubationMinutes: 15,
    createdAt,
  });
}

function hatchedSave(): { save: SaveCurrent; mon: MonInstance } {
  const egg = eggAt();
  const mon = mintMonInstance(egg);
  return {
    mon,
    save: withCaller({
      eggs: [egg],
      hatches: [{ kind: 'hatched', eggId: egg.eggId, mon, serverConfirmed: false }],
      mons: [mon],
      care: [createInitialCareState(mon.monInstanceId, egg.incubationEndsAt)],
      journal: [],
    }),
  };
}

describe('startIncubation (M10)', () => {
  it('writes one egg and one incubating hatch state, queues the create, nickname null', () => {
    const { store, storage, io } = setup(withCaller());
    const before = storage.writes;
    const egg = store.getState().startIncubation({ bloodlineId: metroEgg!.bloodlineId, minutes: 30, atMs: T0 });
    assert.equal(storage.writes, before + 1);
    const save = io.read();
    assert.deepEqual(save?.eggs, [egg]);
    assert.equal(egg.monInstanceId, deriveMonInstanceId(egg.eggId));
    assert.equal(egg.incubationEndsAt, T0 + 30 * MIN);
    assert.equal(egg.nickname, null);
    assert.equal(egg.speciesId, metroEgg!.speciesId);
    assert.deepEqual(save?.hatches, [createHatchState(egg)]);
    assert.deepEqual(save?.queue.eggCreates.map((e) => e.request.eggId), [egg.eggId]);
    assert.equal(save?.queue.entries.length, 0);
    assert.deepEqual(selectPendingEgg(store.getState())?.egg, egg);
  });

  it('a second call returns the same egg and writes nothing', () => {
    const { store, storage } = setup(withCaller());
    const first = store.getState().startIncubation({ bloodlineId: metroEgg!.bloodlineId, minutes: 15, atMs: T0 });
    const before = storage.writes;
    const second = store.getState().startIncubation({ bloodlineId: 'F02', minutes: 60, atMs: T0 + MIN });
    assert.deepEqual(second, first);
    assert.equal(storage.writes, before);
  });

  it('throws with no Caller, with a Mon, or for an unknown Bloodline', () => {
    assert.throws(() => setup(createEmptySave('d', T0)).store.getState().startIncubation({ bloodlineId: 'F01', minutes: 15, atMs: T0 }), /Caller/);
    assert.throws(() => setup(hatchedSave().save).store.getState().startIncubation({ bloodlineId: 'F01', minutes: 15, atMs: T0 }), /already has a Mon/);
    assert.throws(() => setup(withCaller()).store.getState().startIncubation({ bloodlineId: 'F99', minutes: 15, atMs: T0 }), /No starter egg/);
  });
});

describe('selectPendingEgg', () => {
  it('picks the earliest incubationEndsAt, like boot, and is stable per save', () => {
    const late = eggAt(T0 + 10 * MIN, 'egg-b');
    const early = eggAt(T0, 'egg-a');
    const { store } = setup(withCaller({ eggs: [late, early] }));
    const pending = selectPendingEgg(store.getState());
    assert.equal(pending?.egg.eggId, 'egg-a');
    assert.equal(pending?.hatch.kind, 'incubating');
    assert.equal(selectPendingEgg(store.getState()), pending);
  });

  it('is undefined once the egg has hatched', () => {
    assert.equal(selectPendingEgg(setup(hatchedSave().save).store.getState()), undefined);
  });
});

describe('applyHatch (M12)', () => {
  const run = () => {
    const egg = eggAt();
    const ctx = setup(withCaller({ eggs: [egg], hatches: [createHatchState(egg)] }));
    return { egg, ...ctx };
  };

  it('a tick before the end and a repeated open write nothing', () => {
    const { egg, store, storage } = run();
    const before = storage.writes;
    store.getState().applyHatch(egg.eggId, { type: 'tick', now: T0 + MIN }, T0 + MIN);
    assert.equal(storage.writes, before);
    const late = egg.incubationEndsAt + 6 * HOUR;
    store.getState().applyHatch(egg.eggId, { type: 'open', now: late }, late);
    const afterOpen = storage.writes;
    store.getState().applyHatch(egg.eggId, { type: 'open', now: late + 1 }, late + 1);
    assert.equal(storage.writes, afterOpen);
  });

  it('the hatched edge appends Mon, care (from the hatch moment) and the hatched entry in one write', () => {
    const { egg, store, storage, io } = run();
    const late = egg.incubationEndsAt + 6 * HOUR;
    const presenting = store.getState().applyHatch(egg.eggId, { type: 'open', now: late }, late);
    assert.equal(presenting.kind, 'presenting');
    assert.equal(io.read()?.mons.length, 0);
    const before = storage.writes;
    const hatchedAt = late + 20_000;
    const done = store.getState().applyHatch(egg.eggId, { type: 'skip' }, hatchedAt);
    assert.equal(storage.writes, before + 1);
    assert.equal(done.kind, 'hatched');
    const save = io.read();
    assert.equal(save?.mons.length, 1);
    const mon = save!.mons[0]!;
    assert.equal(mon.monInstanceId, deriveMonInstanceId(egg.eggId));
    assert.equal(mon.hatchedAt, egg.incubationEndsAt, 'hatchedAt stays deterministic');
    assert.equal(mon.nickname, null);
    assert.deepEqual(save?.care, [createInitialCareState(mon.monInstanceId, hatchedAt)], 'D-15f: care starts at the hatch');
    assert.deepEqual(save?.journal.map((e) => [e.kind, e.at, e.first]), [['hatched', hatchedAt, true]]);
    assert.equal(selectActiveMon(store.getState())?.monInstanceId, mon.monInstanceId);
  });

  it('a late Caller meets a Baby whose meters have not dropped (D-15f)', () => {
    const { egg, store } = run();
    const late = egg.incubationEndsAt + 6 * HOUR;
    store.getState().applyHatch(egg.eggId, { type: 'open', now: late }, late);
    store.getState().applyHatch(egg.eggId, { type: 'skip' }, late);
    const care = selectCareNow(late)(store.getState());
    assert.equal(care?.fullness, 0.5);
  });

  it('skip at every phase leaves exactly one Mon equal to the derived id', () => {
    for (let advances = 0; advances <= 6; advances++) {
      const { egg, store, io } = run();
      const at = egg.incubationEndsAt;
      store.getState().applyHatch(egg.eggId, { type: 'open', now: at }, at);
      for (let i = 0; i < advances; i++) store.getState().applyHatch(egg.eggId, { type: 'advance' }, at + i);
      store.getState().applyHatch(egg.eggId, { type: 'skip' }, at + 10);
      store.getState().applyHatch(egg.eggId, { type: 'skip' }, at + 11);
      assert.deepEqual(io.read()?.mons.map((m) => m.monInstanceId), [deriveMonInstanceId(egg.eggId)]);
      assert.equal(io.read()?.journal.length, 1);
    }
  });

  it('a server-confirmed Mon with another id throws HatchIntegrityError and writes nothing', () => {
    const { egg, store, storage } = run();
    const before = storage.writes;
    const other = { ...mintMonInstance(egg), monInstanceId: 'mon_other' };
    assert.throws(() => store.getState().applyHatch(egg.eggId, { type: 'server-confirmed', mon: other }, T0), HatchIntegrityError);
    assert.equal(storage.writes, before);
    assert.throws(() => store.getState().applyHatch('nope', { type: 'skip' }, T0), /No egg nope/);
  });
});

describe('nameActiveMon (M09)', () => {
  it('sets the name once, appends named, keeps identity; a second call writes nothing', () => {
    const { save, mon } = hatchedSave();
    const { store, storage, io } = setup(save);
    const name = validateMonName(' Pip ', { isBlocked: () => false });
    assert.ok(name.ok);
    const named = store.getState().nameActiveMon(name.name, T0 + DAY);
    assert.deepEqual(named, { ...mon, nickname: 'Pip' });
    assert.deepEqual(io.read()?.journal.map((e) => e.kind), ['named']);
    const before = storage.writes;
    assert.deepEqual(store.getState().nameActiveMon('Other', T0 + 2 * DAY), named);
    assert.equal(storage.writes, before);
    assert.equal(io.read()?.queue.entries.length, 0, 'no server write is queued: no nickname endpoint exists');
  });

  it('rejects a name not in stored form and needs an active Mon', () => {
    assert.throws(() => setup(hatchedSave().save).store.getState().nameActiveMon(' Pip', T0), RangeError);
    assert.throws(() => setup(hatchedSave().save).store.getState().nameActiveMon('a'.repeat(17), T0), RangeError);
    assert.throws(() => setup(withCaller()).store.getState().nameActiveMon('Pip', T0), /active Mon/);
  });
});

describe('care, journal and days together', () => {
  it('selectCareNow advances without writing and is stable for a nowMs', () => {
    const { save, mon } = hatchedSave();
    const { store, storage } = setup(save);
    const before = storage.writes;
    const select = selectCareNow(T0 + 3 * HOUR);
    const care = select(store.getState());
    assert.equal(select(store.getState()), care);
    assert.equal(storage.writes, before);
    const stored = save.care[0]!;
    assert.deepEqual(care, advanceCare({ mon, care: stored }, T0 + 3 * HOUR).state.care);
    assert.ok((care?.fullness ?? 1) < stored.fullness);
  });

  it('applyCare appends fed/rested/played with first flags; declines append nothing', () => {
    const { save } = hatchedSave();
    const { store, io } = setup(save);
    const s = store.getState();
    const start = save.care[0]!.updatedAt;
    s.applyCare({ kind: 'feed' }, start + HOUR);
    s.applyCare({ kind: 'feed' }, start + 2 * HOUR);
    s.applyCare({ kind: 'play', quality: 0.6 }, start + 3 * HOUR);
    s.applyCare({ kind: 'rest' }, start + 4 * HOUR);
    assert.equal(s.applyCare({ kind: 'play', quality: 1 }, start + 4 * HOUR + MIN).kind, 'declined');
    assert.deepEqual(
      io.read()?.journal.map((e) => [e.kind, e.first]),
      [
        ['fed', true],
        ['fed', false],
        ['played', true],
        ['rested', true],
      ],
    );
  });

  it('a feed with no food is a shared meal (D-15e)', () => {
    const { save } = hatchedSave();
    const { store, io } = setup(save);
    const at = save.care[0]!.updatedAt;
    assert.deepEqual(store.getState().applyCare({ kind: 'feed' }, at), { kind: 'eaten' });
    assert.equal(io.read()?.care[0]?.fullness, 0.5 + DEFAULT_CARE_TUNING.sharedMealNutrition);
    assert.deepEqual(io.read()?.queue.entries[0]?.action, { kind: 'feed' });
  });

  it('selectJournal is newest first; days together counts entry days and only rises', () => {
    const { save, mon } = hatchedSave();
    const { store } = setup(save);
    const start = save.care[0]!.updatedAt;
    store.getState().applyCare({ kind: 'feed' }, start + HOUR);
    store.getState().applyCare({ kind: 'play', quality: 1 }, start + 10 * DAY);
    const entries = selectJournal(mon.monInstanceId)(store.getState());
    assert.deepEqual(entries.map((e) => e.kind), ['played', 'fed']);
    assert.equal(selectJournal(mon.monInstanceId)(store.getState()).length, 2);
    assert.equal(selectDaysTogether(start + 11 * DAY)(store.getState()), new Set([start + HOUR, start + 10 * DAY].map(localDayKey)).size);
    let last = 0;
    for (let now = start; now <= start + 11 * DAY; now += 6 * HOUR) {
      const n = selectDaysTogether(now)(store.getState()) ?? -1;
      assert.ok(n >= last);
      last = n;
    }
  });

  it('selectCallerIsUnder13 reads the save Caller', () => {
    const { save } = hatchedSave();
    assert.equal(selectCallerIsUnder13(T0)(setup(save).store.getState()), false);
    const child = { ...save, caller: { ...caller, birthYear: 2016, consentStatus: 'approved' as const } };
    assert.equal(selectCallerIsUnder13(T0)(setup(child).store.getState()), true);
    assert.equal(selectCallerIsUnder13(T0)(setup(createEmptySave('d', T0)).store.getState()), undefined);
  });
});

describe('care replay with device clock rollback', () => {
  it('persists effective timestamps in order while retaining journal order', () => {
    const { save } = hatchedSave();
    const { store, io } = setup(save);
    const at = save.care[0]!.updatedAt + 4 * HOUR;
    store.getState().applyCare({ kind: 'rest' }, at);
    store.getState().applyCare({ kind: 'wake' }, at - 2 * HOUR);
    const persisted = io.read();
    assert.ok(persisted);
    assert.deepEqual(persisted.queue.entries.map((w) => w.at), [at, at]);
    assert.equal(persisted.savedAt, at);
    assert.deepEqual(persisted.queue.entries.map((w) => w.action.kind), ['rest', 'wake']);
    assert.equal(persisted.journal.at(-1)?.at, at);
  });
});

describe('parseReadyNotificationData (Law 5)', () => {
  it('accepts the scheduled payload and reports anything else', () => {
    assert.deepEqual(parseReadyNotificationData({ eggId: 'egg-1', url: '/(home)/hatch' }), {
      ok: true,
      data: { eggId: 'egg-1', url: '/(home)/hatch' },
    });
    for (const bad of [undefined, 'x', { eggId: 'egg-1' }, { eggId: 'egg-1', url: '/other' }]) {
      const parsed = parseReadyNotificationData(bad);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) assert.ok(parsed.issues.length > 0);
    }
  });
});
