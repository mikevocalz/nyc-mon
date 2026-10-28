import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createWriteQueue, deriveMonInstanceId, enqueueCareWrite, enqueueEggCreate } from '@acme/core/sim';
import type { WriteQueue } from '@acme/core/types';
import { SYSTEM_COPY } from './copy.ts';
import {
  appendConflicts, applySyncReply, bannerFor, LOG_LIMIT, onlineFrom, OUTCOME_COPY, parseConflictLog, queuedCount, queueRows, runSync,
  STATUS_COPY, syncStatus, unseenConflicts, type ConflictEntry, type SyncTransport,
} from './sync-model.ts';

const MON = 'mon_a';

function queueWith(): WriteQueue {
  let q = createWriteQueue('device-a');
  q = enqueueCareWrite(q, { monInstanceId: MON, at: 1_000, action: { kind: 'rest' } }).queue;
  q = enqueueCareWrite(q, { monInstanceId: MON, at: 3_000, action: { kind: 'wake' } }).queue;
  q = enqueueEggCreate(
    q,
    { eggId: 'egg_1', speciesId: 'sp', hatchesIntoSpeciesId: 'sp2', nickname: null, incubationMinutes: 15 },
    2_000,
  );
  return q;
}

describe('M21 connectivity and status', () => {
  it('reads only a definite no as offline', () => {
    assert.equal(onlineFrom({ isConnected: false }), false);
    assert.equal(onlineFrom({ isConnected: true, isInternetReachable: false }), false);
    assert.equal(onlineFrom({ isConnected: true }), true);
    assert.equal(onlineFrom({}), null);
  });

  it('orders status offline, then syncing, then conflict', () => {
    assert.equal(syncStatus({ online: false, reconciling: true, unseenConflicts: 2 }), 'offline');
    assert.equal(syncStatus({ online: true, reconciling: true, unseenConflicts: 2 }), 'reconciling');
    assert.equal(syncStatus({ online: null, reconciling: false, unseenConflicts: 1 }), 'conflict');
    assert.equal(syncStatus({ online: null, reconciling: false, unseenConflicts: 0 }), 'online');
    for (const id of Object.values(STATUS_COPY)) assert.ok(SYSTEM_COPY[id]);
  });

  it('shows a banner only when there is something to say', () => {
    assert.equal(bannerFor('online', 0), null);
    assert.deepEqual(bannerFor('online', 1), { kind: 'pending', titleId: 'm21.banner.pending.one', count: 1 });
    assert.equal(bannerFor('online', 3)?.titleId, 'm21.banner.pending');
    assert.equal(bannerFor('offline', 0)?.bodyId, 'm21.banner.offline.body');
    assert.equal(bannerFor('reconciling', 2)?.kind, 'syncing');
    assert.equal(bannerFor('conflict', 0)?.kind, 'conflict');
  });
});

describe('M21 queue rows', () => {
  it('counts care writes and egg creations', () => {
    assert.equal(queuedCount(undefined), 0);
    assert.equal(queuedCount(queueWith()), 3);
  });

  it('lists every waiting write newest first with its copy', () => {
    const rows = queueRows(queueWith());
    assert.deepEqual(rows.map((r) => r.copyId), ['m21.queue.wake', 'm21.queue.egg', 'm21.queue.rest']);
    assert.equal(rows[1]?.monInstanceId, null);
    assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
  });
});

describe('M21 conflict log', () => {
  const entry = (at: number): ConflictEntry => ({ id: `e${at}`, at, monInstanceId: MON, count: 1 });

  it('keeps newest first and caps the length', () => {
    let log: ConflictEntry[] = [];
    for (let i = 0; i < LOG_LIMIT + 5; i++) log = appendConflicts(log, [entry(i)]);
    assert.equal(log.length, LOG_LIMIT);
    assert.equal(log[0]?.at, LOG_LIMIT + 4);
  });

  it('reads damaged storage as an empty log', () => {
    assert.deepEqual(parseConflictLog(undefined), []);
    assert.deepEqual(parseConflictLog('{oops'), []);
    assert.deepEqual(parseConflictLog(JSON.stringify([entry(1), { id: 1 }])), [entry(1)]);
  });

  it('counts entries newer than the last visit', () => {
    assert.equal(unseenConflicts([entry(5), entry(3)], 4), 1);
  });
});

describe('M21 sync attempt', () => {
  const ok: SyncTransport = {
    send: async () => ({
      ackedSeq: 1,
      eggs: [{ eggId: 'egg_1', monInstanceId: deriveMonInstanceId('egg_1'), incubationEndsAt: 5_000 }],
      serverKept: [{ monInstanceId: MON, count: 1 }, { monInstanceId: 'mon_b', count: 0 }],
    }),
  };

  it('does nothing while offline', async () => {
    const r = await runSync({ online: false, queue: queueWith(), transport: ok, nowMs: 9 });
    assert.equal(r.outcome, 'offline');
    assert.equal(r.reply, undefined);
  });

  it('says so honestly when no server transport is set', async () => {
    assert.equal((await runSync({ online: true, queue: queueWith(), transport: null, nowMs: 9 })).outcome, 'no-server');
  });

  it('leaves the queue intact when the send fails', async () => {
    const failing: SyncTransport = { send: async () => { throw new Error('net'); } };
    const r = await runSync({ online: true, queue: queueWith(), transport: failing, nowMs: 9 });
    assert.equal(r.outcome, 'failed');
    assert.equal(r.reply, undefined);
  });

  it('drops acked writes and logs one line per Mon the server overruled', async () => {
    const r = await runSync({ online: null, queue: queueWith(), transport: ok, nowMs: 9 });
    assert.equal(r.outcome, 'synced');
    assert.ok(r.reply);
    // A write queued while the send was in flight survives the ack.
    const grown = enqueueCareWrite(queueWith(), { monInstanceId: MON, at: 4_000, action: { kind: 'rest' } }).queue;
    const after = applySyncReply(grown, r.reply);
    assert.deepEqual(after.entries.map((w) => w.seq), [2, 3]);
    assert.equal(after.eggCreates.length, 0);
    assert.equal(after.nextSeq, 4);
    assert.deepEqual(r.conflicts, [{ id: `9-${MON}`, at: 9, monInstanceId: MON, count: 1 }]);
    for (const id of Object.values(OUTCOME_COPY)) assert.ok(SYSTEM_COPY[id]);
  });
});
