import type { JournalEntry, JournalEntryKind } from '../types/index.ts';
import { assertNever } from './assert-never.ts';
import type { CareOutcome } from './care.ts';
import type { CareEvent } from './state.ts';

// M18 journal: docs/design/screens/M18/04-components.md and D-15a. Events
// only: the journal records what happened and never what did not.

/** Deterministic entry id: one entry per (Mon, kind, instant). Appending the same one twice is a no-op. */
export function journalEntryId(monInstanceId: string, kind: JournalEntryKind, at: number): string {
  return `j_${monInstanceId}_${kind}_${at}`;
}

/** Input to {@linkcode appendJournalEntry}. */
export interface JournalAppend {
  readonly monInstanceId: string;
  readonly kind: JournalEntryKind;
  readonly at: number;
}

/**
 * Appends one entry. `first` is true when the journal holds no earlier entry
 * of this kind for this Mon. Idempotent: an entry with the same id is not
 * added again, and the input array is returned unchanged.
 */
export function appendJournalEntry(journal: readonly JournalEntry[], input: JournalAppend): readonly JournalEntry[] {
  const entryId = journalEntryId(input.monInstanceId, input.kind, input.at);
  if (journal.some((e) => e.entryId === entryId)) return journal;
  const first = !journal.some((e) => e.monInstanceId === input.monInstanceId && e.kind === input.kind);
  return [...journal, { entryId, monInstanceId: input.monInstanceId, at: input.at, kind: input.kind, first }];
}

/**
 * The journal kind a care outcome records, or `undefined` for outcomes the
 * journal never logs (declines, a Caller-woken Mon).
 */
export function journalKindForOutcome(outcome: CareOutcome): JournalEntryKind | undefined {
  switch (outcome.kind) {
    case 'eaten':
    case 'overfed':
      return 'fed';
    case 'fell-asleep':
      return 'rested';
    case 'played':
      return 'played';
    case 'woke':
    case 'declined':
      return undefined;
    default:
      return assertNever(outcome);
  }
}

/**
 * Appends what one applied care action means for the journal: the Mon
 * waking up rested inside the advanced window (at the event's own time),
 * then the action's outcome at `at`. Requests, needs-you crossings and
 * declines are never logged.
 */
export function appendCareToJournal(
  journal: readonly JournalEntry[],
  input: {
    readonly monInstanceId: string;
    readonly at: number;
    readonly outcome: CareOutcome;
    readonly events: readonly CareEvent[];
  },
): readonly JournalEntry[] {
  let next = journal;
  for (const event of input.events) {
    if (event.type === 'woke' && event.cause === 'rested') {
      next = appendJournalEntry(next, { monInstanceId: input.monInstanceId, kind: 'woke-rested', at: event.at });
    }
  }
  const kind = journalKindForOutcome(input.outcome);
  return kind === undefined ? next : appendJournalEntry(next, { monInstanceId: input.monInstanceId, kind, at: input.at });
}

/**
 * Days together (M18, D-15a): the number of distinct days with at least one
 * entry for this Mon, counting entries at or before `nowMs`. Gaps never
 * subtract; entries are never removed, so the count only rises as time
 * passes. `dayKeyOf` maps an instant to its day in the device's time zone
 * (core never reads the zone).
 */
export function countDaysTogether(
  journal: readonly JournalEntry[],
  monInstanceId: string,
  nowMs: number,
  dayKeyOf: (atMs: number) => string,
): number {
  const days = new Set<string>();
  for (const entry of journal) {
    if (entry.monInstanceId === monInstanceId && entry.at <= nowMs) days.add(dayKeyOf(entry.at));
  }
  return days.size;
}
