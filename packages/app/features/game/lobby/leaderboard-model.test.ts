import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LeaderboardPage, LeaderboardRow } from '@acme/core';
import { toLeaderboardModel } from './leaderboard-model.ts';
import { toResumeSummary } from './resume-summary.ts';

const rows: LeaderboardRow[] = [
  { rank: 1, playerId: 'p1', displayName: 'Vesper', score: 48200, isSelf: false },
  { rank: 2, playerId: 'p2', displayName: 'Nimbus', score: 41750, isSelf: true },
];

describe('toLeaderboardModel', () => {
  it('maps no-ranking-authority to unavailable, the honest default', () => {
    assert.deepEqual(toLeaderboardModel({ status: 'error', rows: [], reason: 'no-ranking-authority' }, null), { status: 'unavailable' });
  });

  it('keeps transport and invalid-rows as error with the reason', () => {
    assert.deepEqual(toLeaderboardModel({ status: 'error', rows: [], reason: 'transport' }, null), { status: 'error', reason: 'transport' });
    assert.deepEqual(toLeaderboardModel({ status: 'error', rows: [], reason: 'invalid-rows' }, null), { status: 'error', reason: 'invalid-rows' });
  });

  it('maps ready rows field by field and finds the own row', () => {
    const model = toLeaderboardModel({ status: 'ready', rows }, null);
    assert.equal(model.status, 'ready');
    if (model.status !== 'ready') return;
    assert.deepEqual(model.rows[0], { rank: 1, name: 'Vesper', score: 48200, isSelf: false, playerId: 'p1' });
    assert.equal(model.self?.playerId, 'p2');
  });

  it('maps stale with its timestamp and empty without an eligibility claim', () => {
    const stale = toLeaderboardModel({ status: 'stale', rows, asOf: 1_700_000_000_000 }, null);
    assert.equal(stale.status, 'stale');
    if (stale.status === 'stale') assert.equal(stale.updatedAtMs, 1_700_000_000_000);
    assert.deepEqual(toLeaderboardModel({ status: 'empty', rows: [] }, null), { status: 'empty', selfEligible: false });
  });

  it('a refetch shows the previous rows instead of a skeleton', () => {
    const previous: LeaderboardPage = { status: 'ready', rows };
    assert.equal(toLeaderboardModel('loading', previous).status, 'ready');
    assert.deepEqual(toLeaderboardModel('loading', null), { status: 'loading' });
    assert.deepEqual(toLeaderboardModel('loading', { status: 'empty', rows: [] }), { status: 'loading' });
  });
});

describe('toResumeSummary', () => {
  it('maps each core failure to a deck failure and carries the recovery', () => {
    assert.deepEqual(toResumeSummary({ kind: 'error', reason: 'incompatible-dataset', recovery: 'start-new', rejected: [] }), {
      kind: 'failed',
      reason: { kind: 'dataset-incompatible' },
      recovery: 'start-new',
    });
    assert.equal(toResumeSummary({ kind: 'error', reason: 'corrupt', recovery: 'retry-sync', rejected: [] }).kind, 'failed');
    assert.deepEqual(toResumeSummary(null), { kind: 'none' });
    assert.deepEqual(toResumeSummary({ kind: 'new-game', rejected: [] }), { kind: 'none' });
  });
});
