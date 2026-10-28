import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptySave } from '@acme/core/save';
import { createEggRecord, createHatchState, mintMonInstance } from '@acme/core/sim';
import type { JournalEntry, SaveCurrent } from '@acme/core/types';
import { callerSummary, isJournalHighlight } from './caller-model.ts';

const DAY = 86_400_000;
const T0 = new Date(2026, 9, 1, 12, 0, 0).getTime();
const egg = createEggRecord({
  eggId: 'egg-1', speciesId: 'dex-001', hatchesIntoSpeciesId: 'dex-002', callerId: 'caller-1', nickname: null, incubationMinutes: 15, createdAt: T0,
});
const mon = mintMonInstance(egg);
const entry = (kind: JournalEntry['kind'], at: number, first = false): JournalEntry => ({
  entryId: `${kind}-${at}`, monInstanceId: mon.monInstanceId, at, kind, first,
});
const caller = { callerId: 'caller-1', callerName: 'Dre', birthYear: 2000, consentStatus: 'not-required' as const, createdAt: T0 - DAY };

function save(patch: Partial<SaveCurrent>): SaveCurrent {
  return { ...createEmptySave('device-1', T0), caller, ...patch };
}

describe('Caller: highlights', () => {
  it('counts the hatch, the naming and each first, never routine repeats', () => {
    assert.equal(isJournalHighlight({ kind: 'hatched', first: false }), true);
    assert.equal(isJournalHighlight({ kind: 'named', first: false }), true);
    assert.equal(isJournalHighlight({ kind: 'fed', first: true }), true);
    assert.equal(isJournalHighlight({ kind: 'fed', first: false }), false);
    assert.equal(isJournalHighlight({ kind: 'woke-rested', first: false }), false);
  });
});

describe('Caller: summary from the save', () => {
  it('is empty and honest with no save', () => {
    assert.deepEqual(callerSummary(undefined, T0), {
      callerName: null, memberSinceMs: null, mons: [], eggsHatched: 0, journalHighlights: 0, eggPending: false,
    });
  });

  it('reports an incubating egg with nothing raised yet', () => {
    const s = callerSummary(save({ eggs: [egg], hatches: [createHatchState(egg)] }), T0);
    assert.equal(s.callerName, 'Dre');
    assert.equal(s.memberSinceMs, T0 - DAY);
    assert.equal(s.eggPending, true);
    assert.equal(s.eggsHatched, 0);
    assert.deepEqual(s.mons, []);
  });

  it('counts the Mon raised, its days together, eggs hatched and highlights', () => {
    const journal = [
      entry('hatched', T0),
      entry('named', T0 + 1000),
      entry('fed', T0 + 2000, true),
      entry('fed', T0 + DAY),
      entry('rested', T0 + 3 * DAY, true),
    ];
    const hatched = { kind: 'hatched' as const, eggId: egg.eggId, mon, serverConfirmed: false };
    const s = callerSummary(save({ eggs: [egg], hatches: [hatched], mons: [mon], journal }), T0 + 3 * DAY);
    assert.equal(s.mons.length, 1);
    assert.equal(s.mons[0]?.daysTogether, 3);
    assert.equal(s.eggsHatched, 1);
    assert.equal(s.journalHighlights, 4);
    assert.equal(s.eggPending, false);
  });

  it('never counts days from entries after now', () => {
    const s = callerSummary(save({ mons: [mon], journal: [entry('hatched', T0), entry('fed', T0 + 5 * DAY)] }), T0 + DAY);
    assert.equal(s.mons[0]?.daysTogether, 1);
  });
});
