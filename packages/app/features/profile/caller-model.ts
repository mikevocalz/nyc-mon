// What the Caller screen says about the Caller, read from the save. Pure:
// node --test covers it. Phase 1 only: identity, the Mons raised, eggs
// hatched and the journal's highlights. Reputation, rankings, achievements,
// friends and battle history arrive with later canon phases, not as stubs.
// SOT: docs/canon/GAMEPLAY_BIBLE_V12.md "Native navigation canon" (CALLER)
// SOT-KEYWORDS: caller profile mons raised eggs hatched journal highlights member since
import { countDaysTogether } from '@acme/core/sim';
import type { JournalEntry, MonInstance, SaveCurrent } from '@acme/core/types';
import { localDayKey } from '../mon/create-mon-store.ts';
import { showsFirstBadge } from '../companion/journal-model.ts';

export interface CallerMonRow {
  readonly mon: MonInstance;
  /** Local days with at least one journal entry for this Mon (D-15a: never subtracts). */
  readonly daysTogether: number;
}

export interface CallerSummary {
  readonly callerName: string | null;
  /** When the Caller record was made (M07), epoch ms; null without a Caller. */
  readonly memberSinceMs: number | null;
  /** Every Mon in the save, oldest hatch first. */
  readonly mons: readonly CallerMonRow[];
  readonly eggsHatched: number;
  readonly journalHighlights: number;
  /** An egg is incubating and nothing has hatched yet. */
  readonly eggPending: boolean;
}

/**
 * A journal highlight: the hatch, the naming, and each first meal, nap and
 * game (the entries M18 marks "First"). Routine repeats are not highlights.
 */
export function isJournalHighlight(entry: Pick<JournalEntry, 'kind' | 'first'>): boolean {
  return entry.kind === 'hatched' || entry.kind === 'named' || showsFirstBadge(entry);
}

export function callerSummary(save: SaveCurrent | undefined, nowMs: number): CallerSummary {
  if (save === undefined) {
    return { callerName: null, memberSinceMs: null, mons: [], eggsHatched: 0, journalHighlights: 0, eggPending: false };
  }
  const mons = [...save.mons]
    .sort((a, b) => a.hatchedAt - b.hatchedAt)
    .map((mon) => ({ mon, daysTogether: countDaysTogether(save.journal, mon.monInstanceId, nowMs, localDayKey) }));
  const hatchedEggIds = new Set(save.hatches.filter((h) => h.kind === 'hatched').map((h) => h.eggId));
  return {
    callerName: save.caller?.callerName ?? null,
    memberSinceMs: save.caller?.createdAt ?? null,
    mons,
    eggsHatched: hatchedEggIds.size,
    journalHighlights: save.journal.filter(isJournalHighlight).length,
    eggPending: save.eggs.some((e) => !hatchedEggIds.has(e.eggId)) && save.mons.length === 0,
  };
}
