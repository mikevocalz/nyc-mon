import { describe, expect, it } from 'vitest';
import { SaveCurrentSchema, SaveV1Schema } from '../schemas/index.ts';
import { createEmptySave, loadSave, migrateSaveBlob, SaveLoadError, type SaveMigration } from '../save/migrate.ts';
import { createInitialCareState } from '../sim/care.ts';
import { createEggRecord, createHatchState, mintMonInstance } from '../sim/hatch.ts';
import { T0 } from './harness.ts';

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
    ...createEmptySave('device-a', T0),
    caller: { callerId: 'caller-1', callerName: 'Dee', birthYear: 2011, consentStatus: 'not-required' as const, createdAt: T0 },
    eggs: [egg],
    hatches: [createHatchState(egg)],
    mons: [mon],
    care: [createInitialCareState(mon.monInstanceId, mon.hatchedAt)],
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
  it('a v1 blob migrates to the current shape and round-trips', () => {
    const v1 = SaveV1Schema.parse(fullV1Save());
    const loaded = loadSave(JSON.stringify(v1));
    expect(SaveCurrentSchema.parse(loaded)).toEqual(loaded);
    expect(loaded).toEqual(v1);
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
    expect(failureOf(() => migrateSaveBlob(fullV1Save(), 3, table.slice(1)))).toBe('missing-migration');
  });
});
