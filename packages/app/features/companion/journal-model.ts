import type { JournalEntry } from '@acme/core/types';
import type { CompanionCopyId } from './copy.ts';
import { localDayKey } from '../mon/create-mon-store.ts';

// Pure helpers for M18 (docs/design/screens/M18/08-handoff.md). Day
// boundaries follow the device time zone, like the time-of-day rig.

/** Every local day with at least one entry. Gaps are simply absent (D-15a). */
export function journalDays(entries: readonly JournalEntry[]): ReadonlySet<string> {
  return new Set(entries.map((e) => localDayKey(e.at)));
}

/** How a day group is headed: "Today", "Yesterday", or the locale long date. */
export type DayHeading = { readonly kind: 'today' } | { readonly kind: 'yesterday' } | { readonly kind: 'date'; readonly atMs: number };

export interface JournalDay {
  readonly iso: string;
  readonly heading: DayHeading;
  /** Newest first, as `selectJournal` returns them. */
  readonly entries: readonly JournalEntry[];
}

function previousLocalIso(nowMs: number): string {
  const d = new Date(nowMs);
  d.setDate(d.getDate() - 1);
  return localDayKey(d.getTime());
}

/** Groups newest-first entries by local day, keeping their order. */
export function groupJournalByDay(entries: readonly JournalEntry[], nowMs: number): readonly JournalDay[] {
  const today = localDayKey(nowMs);
  const yesterday = previousLocalIso(nowMs);
  const days: { iso: string; heading: DayHeading; entries: JournalEntry[] }[] = [];
  for (const entry of entries) {
    const iso = localDayKey(entry.at);
    let day = days[days.length - 1];
    if (day?.iso !== iso) {
      const heading: DayHeading =
        iso === today ? { kind: 'today' } : iso === yesterday ? { kind: 'yesterday' } : { kind: 'date', atMs: entry.at };
      day = { iso, heading, entries: [] };
      days.push(day);
    }
    day.entries.push(entry);
  }
  return days;
}

/** The copy id for an entry. Every `JournalEntrySchema.kind` maps; nothing else renders. */
export function journalEntryCopyId(entry: Pick<JournalEntry, 'kind' | 'first'>): CompanionCopyId {
  switch (entry.kind) {
    case 'hatched':
      return 'm18.entry.hatched';
    case 'named':
      return 'm18.entry.named';
    case 'fed':
      return entry.first ? 'm18.entry.fed.first' : 'm18.entry.fed';
    case 'rested':
      return entry.first ? 'm18.entry.rested.first' : 'm18.entry.rested';
    case 'played':
      return entry.first ? 'm18.entry.played.first' : 'm18.entry.played';
    case 'woke-rested':
      return 'm18.entry.woke';
    default: {
      const never: never = entry.kind;
      throw new Error(`Unknown journal kind ${String(never)}`);
    }
  }
}

/** Whether an entry gets the "First" badge: firsts of the repeatable kinds only (hatch and naming happen once). */
export function showsFirstBadge(entry: Pick<JournalEntry, 'kind' | 'first'>): boolean {
  return entry.first && (entry.kind === 'fed' || entry.kind === 'rested' || entry.kind === 'played');
}
