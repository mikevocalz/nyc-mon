import type { CareAction, CareWrite, MonInstance, CareState, WriteQueue } from '../types/index.ts';
import { applyCareAction } from './care.ts';
import type { SimState } from './state.ts';
import { type CareTuning, DEFAULT_CARE_TUNING } from './tuning.ts';

export function createWriteQueue(deviceId: string): WriteQueue {
  return { deviceId, nextSeq: 1, entries: [] };
}

/** Appends a care write with the next monotonic `seq` for this device. */
export function enqueueCareWrite(
  queue: WriteQueue,
  input: { readonly monInstanceId: string; readonly at: number; readonly action: CareAction },
): { readonly queue: WriteQueue; readonly write: CareWrite } {
  const write: CareWrite = { deviceId: queue.deviceId, seq: queue.nextSeq, ...input };
  return { queue: { ...queue, nextSeq: queue.nextSeq + 1, entries: [...queue.entries, write] }, write };
}

/** Drops every entry the server has applied. `nextSeq` never goes backwards. */
export function acknowledgeWrites(queue: WriteQueue, ackedSeq: number): WriteQueue {
  return {
    ...queue,
    nextSeq: Math.max(queue.nextSeq, ackedSeq + 1),
    entries: queue.entries.filter((w) => w.seq > ackedSeq),
  };
}

/** Server-held record for one individual. */
export interface ServerCareRecord {
  readonly state: SimState;
  readonly lastSeqByDevice: Readonly<Record<string, number>>;
}

const compareWrites = (a: CareWrite, b: CareWrite): number =>
  a.at - b.at || (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0) || a.seq - b.seq;

/**
 * Server tie-break merge. Drops writes already applied (seq at or below the
 * device's last seq, or duplicated in the batch), orders the rest by
 * `(at, deviceId, seq)` and replays them through the same sim the client runs.
 * Batch order does not matter; resending a batch is a no-op.
 */
export function applyCareWrites(
  record: ServerCareRecord,
  writes: readonly CareWrite[],
  tuning: CareTuning = DEFAULT_CARE_TUNING,
): ServerCareRecord {
  const id = record.state.mon.monInstanceId;
  const seen = new Set<string>();
  const fresh = writes
    .filter((w) => {
      if (w.monInstanceId !== id) throw new Error(`Care write for ${w.monInstanceId} sent to ${id}`);
      const key = `${w.deviceId}#${w.seq}`;
      if (seen.has(key) || w.seq <= (record.lastSeqByDevice[w.deviceId] ?? 0)) return false;
      seen.add(key);
      return true;
    })
    .sort(compareWrites);
  let state = record.state;
  const lastSeqByDevice: Record<string, number> = { ...record.lastSeqByDevice };
  for (const write of fresh) {
    state = applyCareAction(state, write.action, write.at, tuning).state;
    lastSeqByDevice[write.deviceId] = Math.max(lastSeqByDevice[write.deviceId] ?? 0, write.seq);
  }
  return { state, lastSeqByDevice };
}

/**
 * Client reconcile after a PUT response: adopt the server's state, drop acked
 * writes, replay what is still queued on top. Conflicts resolve silently in the
 * server's favour (§4.4 M21).
 */
export function reconcileWithServer(
  server: { readonly mon: MonInstance; readonly care: CareState; readonly ackedSeq: number },
  queue: WriteQueue,
  tuning: CareTuning = DEFAULT_CARE_TUNING,
): { readonly state: SimState; readonly queue: WriteQueue } {
  const remaining = acknowledgeWrites(queue, server.ackedSeq);
  let state: SimState = { mon: server.mon, care: server.care };
  for (const write of remaining.entries) {
    if (write.monInstanceId === state.mon.monInstanceId) {
      state = applyCareAction(state, write.action, write.at, tuning).state;
    }
  }
  return { state, queue: remaining };
}
