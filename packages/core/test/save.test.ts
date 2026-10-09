import { describe, expect, it } from 'vitest';
import { CURRENT_SAVE_VERSION, SaveCurrentSchema, SaveV1Schema } from '../schemas/index.ts';
import { loadSave, migrateSaveBlob, SaveLoadError, type SaveMigration } from '../save/migrate.ts';
import { createInitialCareState } from '../sim/care.ts';
import { createEggRecord, createHatchState, mintMonInstance } from '../sim/hatch.ts';
import { journalEntryId } from '../sim/journal.ts';
import { T0 } from './harness.ts';

/** A v1 blob exactly as a v1 build wrote it: no journal, care-only queue, flat feed actions. */
function fullV1Save() {
  const egg = createEggRecord({
    eggId: 'egg-1',
    speciesId: 'dex-egg-test',
    hatchesIntoSpeciesId: 'dex-baby-test',
    callerId: 'caller-1',
    nickname: 'Testy',
    incubationMinutes: 15,
    createdAt: T0,
  });
  const mon = mintMonInstance(egg);
  return {
    version: 1 as const,
    savedAt: T0,
    caller: { callerId: 'caller-1', callerName: 'Dee', birthYear: 2011, consentStatus: 'not-required' as const, createdAt: T0 },
    eggs: [egg],
    hatches: [createHatchState(egg)],
    mons: [mon],
    care: [createInitialCareState(mon.monInstanceId, mon.hatchedAt)],
    queue: {
      deviceId: 'device-a',
      nextSeq: 3,
      entries: [
        { deviceId: 'device-a', seq: 1, monInstanceId: mon.monInstanceId, at: T0 + 1, action: { kind: 'feed' as const, foodClassId: 'food-x', nutrition: 0.3 } },
        { deviceId: 'device-a', seq: 2, monInstanceId: mon.monInstanceId, at: T0 + 2, action: { kind: 'play' as const, quality: 0.8 } },
      ],
    },
  };
}

const failureOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    if (error instanceof SaveLoadError) return error.reason;
    throw error;
  }
  return 'none';
};

describe('save blob and migrations', () => {
  it('a v1 blob migrates to v2 losslessly: every v1 field kept, journal seeded, feed food nested', () => {
    const v1 = SaveV1Schema.parse(fullV1Save());
    const loaded = loadSave(JSON.stringify(v1));
    expect(SaveCurrentSchema.parse(loaded)).toEqual(loaded);
    expect(loaded.version).toBe(CURRENT_SAVE_VERSION);
    const { version: _v1, queue: v1Queue, ...v1Rest } = v1;
    const { version: _v2, queue: v2Queue, journal, ...v2Rest } = loaded;
    expect(v2Rest).toEqual(v1Rest);
    expect(v2Queue.deviceId).toBe(v1Queue.deviceId);
    expect(v2Queue.nextSeq).toBe(v1Queue.nextSeq);
    expect(v2Queue.eggCreates).toEqual([]);
    expect(v2Queue.entries.map((w) => w.seq)).toEqual([1, 2]);
    expect(v2Queue.entries[0]?.action).toEqual({ kind: 'feed', food: { foodClassId: 'food-x', nutrition: 0.3 } });
    expect(v2Queue.entries[1]?.action).toEqual(v1Queue.entries[1]?.action);
    const mon = v1.mons[0];
    expect(journal).toEqual([
      { entryId: journalEntryId(mon!.monInstanceId, 'hatched', mon!.hatchedAt), monInstanceId: mon!.monInstanceId, at: mon!.hatchedAt, kind: 'hatched', first: true },
    ]);
  });

  it('preserves legacy 1–64-character nicknames even when M09 would reject them', () => {
    const v1 = fullV1Save();
    const legacyNickname = 'Old Nickname ✨ '.repeat(3).slice(0, 48);
    const old = { ...v1, mons: v1.mons.map((mon) => ({ ...mon, nickname: legacyNickname })) };
    const migrated = loadSave(JSON.stringify(old));
    expect(migrated.mons[0]?.nickname).toBe(legacyNickname);
    expect(loadSave(JSON.stringify(migrated)).mons[0]?.nickname).toBe(legacyNickname);
  });

  it('a v2 save round-trips unchanged', () => {
    const v2 = loadSave(JSON.stringify(fullV1Save()));
    expect(loadSave(JSON.stringify(v2))).toEqual(v2);
  });

  it('a v1 save with no Mon migrates to an empty journal', () => {
    const { mons: _m, care: _c, ...rest } = fullV1Save();
    const loaded = loadSave(JSON.stringify({ ...rest, mons: [], care: [], queue: { ...rest.queue, entries: [] } }));
    expect(loaded.journal).toEqual([]);
  });

  it('reports corrupt, future and invalid saves with a typed reason', () => {
    expect(failureOf(() => loadSave('{not json'))).toBe('corrupt');
    expect(failureOf(() => loadSave(JSON.stringify({ hello: 1 })))).toBe('corrupt');
    expect(failureOf(() => loadSave(JSON.stringify({ ...fullV1Save(), version: 99 })))).toBe('future-version');
    expect(failureOf(() => loadSave(JSON.stringify({ ...fullV1Save(), mons: [{ monInstanceId: '' }] })))).toBe('invalid');
  });

  it('walks a migration chain step by step to the target version', () => {
    const table: SaveMigration[] = [
      { from: 1, migrate: (b) => ({ ...b, addedInV2: true }) },
      { from: 2, migrate: (b) => ({ ...b, addedInV3: 'x' }) },
    ];
    expect(migrateSaveBlob(fullV1Save(), 3, table)).toMatchObject({ version: 3, addedInV2: true, addedInV3: 'x' });
    expect(migrateSaveBlob(fullV1Save())).toMatchObject({ version: CURRENT_SAVE_VERSION });
    expect(failureOf(() => migrateSaveBlob(fullV1Save(), 3, table.slice(1)))).toBe('missing-migration');
  });
});
