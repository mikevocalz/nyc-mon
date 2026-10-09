import { describe, expect, it } from 'vitest';
import { PutCareRequestSchema } from '../schemas/index.ts';
import {
  acknowledgeWrites,
  applyCareWrites,
  createWriteQueue,
  enqueueCareWrite,
  reconcileWithServer,
  type ServerCareRecord,
} from '../sim/queue.ts';
import type { CareAction, CareWrite, WriteQueue } from '../types/index.ts';
import { forAll, HOUR, makeState, MINUTE, randomAction, T0 } from './harness.ts';

const ID = 'mon_test';

function queueOf(deviceId: string, items: readonly { at: number; action: CareAction }[]): WriteQueue {
  return items.reduce((q, item) => enqueueCareWrite(q, { monInstanceId: ID, ...item }).queue, createWriteQueue(deviceId));
}

const record = (): ServerCareRecord => ({ state: makeState(), lastSeqByDevice: {} });

describe('offline write queue', () => {
  it('assigns strictly increasing seq numbers starting at 1', () => {
    const q = queueOf('device-a', [
      { at: T0, action: { kind: 'rest' } },
      { at: T0 + HOUR, action: { kind: 'wake' } },
      { at: T0 + 2 * HOUR, action: { kind: 'play', quality: 1 } },
    ]);
    expect(q.entries.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(q.nextSeq).toBe(4);
    expect(PutCareRequestSchema.parse({ writes: q.entries }).writes).toHaveLength(3);
  });

  it('acknowledging drops applied entries and never rewinds nextSeq', () => {
    const q = queueOf('device-a', [
      { at: T0, action: { kind: 'rest' } },
      { at: T0 + HOUR, action: { kind: 'wake' } },
    ]);
    const acked = acknowledgeWrites(q, 1);
    expect(acked.entries.map((e) => e.seq)).toEqual([2]);
    expect(acked.nextSeq).toBe(3);
    expect(enqueueCareWrite(acknowledgeWrites(q, 2), { monInstanceId: ID, at: T0, action: { kind: 'rest' } }).write.seq).toBe(3);
  });
});

describe('server tie-break merge', () => {
  it('replaying the same batch (reconnect resend) applies nothing twice', () => {
    const writes = queueOf('device-a', [
      { at: T0 + MINUTE, action: { kind: 'feed', food: { foodClassId: 'f', nutrition: 0.2 } } },
      { at: T0 + 2 * MINUTE, action: { kind: 'play', quality: 1 } },
    ]).entries;
    const once = applyCareWrites(record(), writes);
    const twice = applyCareWrites(once, writes);
    expect(twice).toEqual(once);
    expect(applyCareWrites(record(), [...writes, ...writes])).toEqual(once);
  });

  it('is independent of the order writes arrive in a batch (property)', () => {
    forAll(
      300,
      (random) => {
        const make = (device: string) => {
          let at = T0;
          return queueOf(
            device,
            Array.from({ length: 8 }, () => {
              at += Math.floor(random() * 2 * HOUR);
              return { at, action: randomAction(random) };
            }),
          ).entries;
        };
        const writes = [...make('device-a'), ...make('device-b')];
        const shuffled = [...writes].sort(() => (random() < 0.5 ? -1 : 1));
        return { writes, shuffled };
      },
      ({ writes, shuffled }) => {
        expect(applyCareWrites(record(), shuffled)).toEqual(applyCareWrites(record(), writes));
      },
    );
  });

  it('breaks exact timestamp ties by deviceId then seq', () => {
    const a: CareWrite = { deviceId: 'device-a', seq: 1, monInstanceId: ID, at: T0, action: { kind: 'rest' } };
    const b: CareWrite = { deviceId: 'device-b', seq: 1, monInstanceId: ID, at: T0, action: { kind: 'play', quality: 1 } };
    // a (rest) goes first, so b (play) is declined because the Mon is asleep.
    const merged = applyCareWrites(record(), [b, a]);
    expect(merged.state.care.activity.kind).toBe('asleep');
    expect(merged.lastSeqByDevice).toEqual({ 'device-a': 1, 'device-b': 1 });
  });

  it('rejects a write addressed to another individual', () => {
    const w: CareWrite = { deviceId: 'd', seq: 1, monInstanceId: 'mon_other', at: T0, action: { kind: 'rest' } };
    expect(() => applyCareWrites(record(), [w])).toThrow();
  });

  it('client reconcile converges on the server state once every write is acked', () => {
    const q = queueOf('device-a', [
      { at: T0 + MINUTE, action: { kind: 'feed', food: { foodClassId: 'f', nutrition: 0.3 } } },
      { at: T0 + HOUR, action: { kind: 'play', quality: 0.5 } },
      { at: T0 + 2 * HOUR, action: { kind: 'rest' } },
    ]);
    const sentFirstTwo = applyCareWrites(record(), q.entries.slice(0, 2));
    const partial = reconcileWithServer(
      { mon: sentFirstTwo.state.mon, care: sentFirstTwo.state.care, ackedSeq: 2 },
      q,
    );
    expect(partial.queue.entries.map((e) => e.seq)).toEqual([3]);
    const all = applyCareWrites(sentFirstTwo, q.entries);
    expect(partial.state).toEqual(all.state);
    const final = reconcileWithServer({ mon: all.state.mon, care: all.state.care, ackedSeq: 3 }, partial.queue);
    expect(final.queue.entries).toHaveLength(0);
    expect(final.state).toEqual(all.state);
  });
});
