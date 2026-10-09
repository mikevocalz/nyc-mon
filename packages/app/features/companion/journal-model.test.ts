import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { JournalEntry } from '@acme/core/types';
import { localDayKey } from '../mon/create-mon-store.ts';
import { COMPANION_COPY } from './copy.ts';
import { groupJournalByDay, journalDays, journalEntryCopyId, showsFirstBadge } from './journal-model.ts';

const NOW = new Date(2026, 9, 8, 15, 0, 0).getTime();
const day = (offset: number, hour = 10) => new Date(2026, 9, 8 + offset, hour, 0, 0).getTime();
const entry = (id: string, at: number, kind: JournalEntry['kind'], first = false): JournalEntry => ({
  entryId: id,
  monInstanceId: 'mon-1',
  at,
  kind,
  first,
});

describe('M18 journal model', () => {
  it('keys days in local time, zero-padded', () => {
    assert.equal(localDayKey(new Date(2026, 0, 5, 23, 59).getTime()), '2026-01-05');
  });

  it('groups newest-first entries under Today, Yesterday and a date, and a 3-week gap logs nothing', () => {
    const entries = [
      entry('a', day(0, 12), 'fed'),
      entry('b', day(0, 9), 'rested', true),
      entry('c', day(-1), 'played', true),
      entry('d', day(-22), 'named'),
      entry('e', day(-22, 8), 'hatched'),
    ];
    const days = groupJournalByDay(entries, NOW);
    assert.deepEqual(days.map((d) => d.heading.kind), ['today', 'yesterday', 'date']);
    assert.deepEqual(days.map((d) => d.entries.length), [2, 1, 2]);
    assert.equal(journalDays(entries).size, 3);
  });

  it('maps every kind to copy, with first variants only where copy has them', () => {
    assert.equal(journalEntryCopyId({ kind: 'fed', first: true }), 'm18.entry.fed.first');
    assert.equal(journalEntryCopyId({ kind: 'woke-rested', first: true }), 'm18.entry.woke');
    assert.equal(showsFirstBadge({ kind: 'hatched', first: true }), false);
    assert.equal(showsFirstBadge({ kind: 'played', first: true }), true);
  });

  it('never words absence or streaks', () => {
    const m18 = Object.entries(COMPANION_COPY).filter(([k]) => k.startsWith('m18.'));
    for (const [, text] of m18) assert.doesNotMatch(text, /streak|missed|in a row|keep it up|don't break/i);
  });
});
