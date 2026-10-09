import type {
  CareAction,
  CareState,
  CareWrite,
  CreateEggRequest,
  CreateEggResponse,
  EggRecord,
  MonInstance,
  WriteQueue,
} from '../types/index.ts';
import { applyCareAction } from './care.ts';
import { deriveMonInstanceId, HatchIntegrityError } from './hatch.ts';
import type { SimState } from './state.ts';
import { type CareTuning, DEFAULT_CARE_TUNING } from './tuning.ts';

export function createWriteQueue(deviceId: string): WriteQueue {
  return { deviceId, nextSeq: 1, entries: [], eggCreates: [] };
}

/** The `POST /v1/eggs` body for an egg created on this device. Same `eggId`, so a replay reserves the same individual. */
export function toCreateEggRequest(egg: EggRecord): CreateEggRequest {
  return {
    eggId: egg.eggId,
    speciesId: egg.speciesId,
    hatchesIntoSpeciesId: egg.hatchesIntoSpeciesId,
    nickname: egg.nickname,
    incubationMinutes: egg.incubationMinutes,
  };
}

/**
 * Queues an egg creation for `POST /v1/eggs` (M10 B4). Idempotent by
 * `eggId`: queuing the same egg again returns the queue unchanged. The
 * entry stays until {@linkcode acknowledgeEggCreate}; a failed send keeps it
 * for the next reconnect, replayed with the same `eggId`.
 */
export function enqueueEggCreate(queue: WriteQueue, request: CreateEggRequest, queuedAt: number): WriteQueue {
  if (queue.eggCreates.some((e) => e.request.eggId === request.eggId)) return queue;
  return { ...queue, eggCreates: [...queue.eggCreates, { queuedAt, request }] };
}

/**
 * Drops the queued creation the server answered. Throws
 * `HatchIntegrityError` when the server reserved a different individual than
 * the derived id (Law 6, a P0). An answer for an egg not in the queue is a no-op.
 */
export function acknowledgeEggCreate(queue: WriteQueue, response: CreateEggResponse): WriteQueue {
  const expected = deriveMonInstanceId(response.eggId);
  if (response.monInstanceId !== expected) {
    throw new HatchIntegrityError(`Egg ${response.eggId} reserves ${expected}; server returned ${response.monInstanceId}`);
  }
  if (!queue.eggCreates.some((e) => e.request.eggId === response.eggId)) return queue;
  return { ...queue, eggCreates: queue.eggCreates.filter((e) => e.request.eggId !== response.eggId) };
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
