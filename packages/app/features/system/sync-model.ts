import { acknowledgeEggCreate, acknowledgeWrites, reconcileWithServer } from '@acme/core/sim';
import type { CareAction, CareState, CreateEggResponse, MonInstance, SaveCurrent, WriteQueue } from '@acme/core/types';
import type { SystemCopyId } from './copy.ts';

/**
 * M21 offline / sync. Pure: connectivity, the queue and the conflict log go
 * in, what the banner, badge and sync screen show comes out. Conflict
 * resolution itself is the server's tie-break (`applyCareWrites`); the
 * client only records a one-line note when the server kept its version.
 */
export type SyncStatus = 'online' | 'offline' | 'reconciling' | 'conflict';

/** `true` online, `false` offline, `null` while the OS has not said. */
export type Online = boolean | null;

/** expo-network's state → online. Unknown fields stay unknown; only a definite "no" is offline. */
export function onlineFrom(state: { readonly isConnected?: boolean; readonly isInternetReachable?: boolean }): Online {
  if (state.isConnected === false || state.isInternetReachable === false) return false;
  if (state.isConnected === true) return true;
  return null;
}

/** Writes waiting for the server: care writes plus egg creations. */
export function queuedCount(queue: WriteQueue | undefined): number {
  return queue === undefined ? 0 : queue.entries.length + queue.eggCreates.length;
}

export function syncStatus(input: { readonly online: Online; readonly reconciling: boolean; readonly unseenConflicts: number }): SyncStatus {
  if (input.online === false) return 'offline';
  if (input.reconciling) return 'reconciling';
  if (input.unseenConflicts > 0) return 'conflict';
  return 'online';
}

export const STATUS_COPY: Readonly<Record<SyncStatus, SystemCopyId>> = {
  online: 'm21.status.online',
  offline: 'm21.status.offline',
  reconciling: 'm21.status.reconciling',
  conflict: 'm21.status.conflict',
};

export interface BannerModel {
  /** offline: full banner with the reassurance line. The others are a one-line chip. */
  readonly kind: 'offline' | 'syncing' | 'conflict' | 'pending';
  readonly titleId: SystemCopyId;
  readonly bodyId?: SystemCopyId;
  /** The queued-writes badge; 0 hides it. */
  readonly count: number;
}

/** The shell banner, or null when there is nothing to say (online, nothing waiting). */
export function bannerFor(status: SyncStatus, queued: number): BannerModel | null {
  switch (status) {
    case 'offline':
      return { kind: 'offline', titleId: 'm21.banner.offline', bodyId: 'm21.banner.offline.body', count: queued };
    case 'reconciling':
      return { kind: 'syncing', titleId: 'm21.banner.syncing', count: queued };
    case 'conflict':
      return { kind: 'conflict', titleId: 'm21.banner.conflict', count: queued };
    case 'online':
      return queued > 0 ? { kind: 'pending', titleId: queued === 1 ? 'm21.banner.pending.one' : 'm21.banner.pending', count: queued } : null;
  }
}

export interface QueueRow {
  readonly key: string;
  readonly copyId: SystemCopyId;
  readonly monInstanceId: string | null;
  readonly at: number;
}

const ACTION_COPY: Readonly<Record<CareAction['kind'], SystemCopyId>> = {
  feed: 'm21.queue.feed',
  rest: 'm21.queue.rest',
  wake: 'm21.queue.wake',
  play: 'm21.queue.play',
};

/** Every waiting write as a row, newest first. */
export function queueRows(queue: WriteQueue | undefined): QueueRow[] {
  if (queue === undefined) return [];
  const care = queue.entries.map((w) => ({
    key: `care-${w.deviceId}-${w.seq}`,
    copyId: ACTION_COPY[w.action.kind],
    monInstanceId: w.monInstanceId,
    at: w.at,
  }));
  const eggs = queue.eggCreates.map((e) => ({
    key: `egg-${e.request.eggId}`,
    copyId: 'm21.queue.egg' as const,
    monInstanceId: null,
    at: e.queuedAt,
  }));
  return [...care, ...eggs].sort((a, b) => b.at - a.at || (a.key < b.key ? -1 : 1));
}

/** One line in the conflict log: the server kept its version of `count` writes for a Mon. */
export interface ConflictEntry {
  readonly id: string;
  readonly at: number;
  readonly monInstanceId: string;
  readonly count: number;
}

export const LOG_LIMIT = 20;

/** Adds entries newest first and keeps the last {@linkcode LOG_LIMIT}. */
export function appendConflicts(log: readonly ConflictEntry[], entries: readonly ConflictEntry[]): ConflictEntry[] {
  return [...entries].sort((a, b) => b.at - a.at).concat(log).slice(0, LOG_LIMIT);
}

const isEntry = (v: unknown): v is ConflictEntry =>
  typeof v === 'object' && v !== null &&
  typeof (v as ConflictEntry).id === 'string' && typeof (v as ConflictEntry).at === 'number' &&
  typeof (v as ConflictEntry).monInstanceId === 'string' && typeof (v as ConflictEntry).count === 'number';

/** Reads the stored log. A damaged value reads as empty; it is only a note, never game state. */
export function parseConflictLog(raw: string | undefined): ConflictEntry[] {
  if (raw === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, LOG_LIMIT) : [];
  } catch {
    return [];
  }
}

export function unseenConflicts(log: readonly ConflictEntry[], seenAt: number): number {
  return log.filter((e) => e.at > seenAt).length;
}

/** What the server answers for one send of the queue. */
export interface SyncReply {
  readonly ackedSeq: number;
  readonly eggs: readonly CreateEggResponse[];
  /** Mons where the server's tie-break kept its own version, with how many writes it set aside. */
  readonly serverKept: readonly { readonly monInstanceId: string; readonly count: number }[];
  /** The server's state for each Mon it answered for (its last answer). The device adopts it ({@linkcode applySyncReplyToSave}). */
  readonly states?: readonly { readonly mon: MonInstance; readonly care: CareState }[];
}

/**
 * A send the server answered with an error. `retryable` is true for answers
 * that can change on their own (5xx, 429, an egg still incubating); false
 * when the server refused the writes as they are.
 */
export class SyncHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  constructor(status: number, code: string, message: string) {
    super(`sync: HTTP ${status} ${code}: ${message}`);
    this.name = 'SyncHttpError';
    this.status = status;
    this.code = code;
    this.retryable = status >= 500 || status === 429 || code === 'NOT_READY';
  }
}

/** The server has no session for this device (401). */
export class SyncSignedOutError extends SyncHttpError {
  constructor(message = 'Sign in required.') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'SyncSignedOutError';
  }
}

/** Sends the queue. Throws on a network or server failure ({@linkcode SyncHttpError} when the server answered). */
export interface SyncTransport {
  send(queue: WriteQueue): Promise<SyncReply>;
}

/**
 * `signed-out`: no transport (nobody is signed in on this device) or the
 * server refused the session. `failed`: no answer, or one worth retrying.
 * `rejected`: the server answered and refused the writes; retrying as they
 * are will not help.
 */
export type SyncOutcome = 'offline' | 'signed-out' | 'synced' | 'failed' | 'rejected';

export const OUTCOME_COPY: Readonly<Record<SyncOutcome, SystemCopyId>> = {
  offline: 'm21.result.offline',
  'signed-out': 'm21.result.signed_out',
  synced: 'm21.result.synced',
  failed: 'm21.result.failed',
  rejected: 'm21.result.rejected',
};

export interface SyncResult {
  readonly outcome: SyncOutcome;
  /** The server's answer, when the send succeeded. Apply it to the queue as it is NOW ({@linkcode applySyncReply}). */
  readonly reply?: SyncReply;
  readonly conflicts: readonly ConflictEntry[];
}

/**
 * Drops what the server acknowledged. Applied to the current queue, not the
 * one that was sent, so a write queued while the send was in flight stays.
 * Throws `HatchIntegrityError` when the server reserved a different Mon (Law 6).
 */
export function applySyncReply(queue: WriteQueue, reply: SyncReply): WriteQueue {
  let next = acknowledgeWrites(queue, reply.ackedSeq);
  for (const egg of reply.eggs) next = acknowledgeEggCreate(next, egg);
  return next;
}

/**
 * {@linkcode applySyncReply} plus the server's state: each Mon the server
 * answered for takes the server's care, bond, stage and form, and the writes
 * still queued for it are replayed on top (`reconcileWithServer`), so care
 * given during the send is kept. The device's own identity fields stay (the
 * server owns the Mon under the account's id, the save under the local
 * Caller's), and a name the server does not have yet is kept. A Mon the save
 * does not hold is not added here; restoring from the server is its own flow.
 */
export function applySyncReplyToSave(save: SaveCurrent, reply: SyncReply): SaveCurrent {
  const queue = applySyncReply(save.queue, reply);
  let { mons, care } = save;
  for (const server of reply.states ?? []) {
    const local = mons.find((m) => m.monInstanceId === server.mon.monInstanceId);
    if (local === undefined) continue;
    const merged: MonInstance = {
      ...local,
      bond: server.mon.bond,
      stage: server.mon.stage,
      speciesId: server.mon.speciesId,
      nickname: server.mon.nickname ?? local.nickname,
    };
    const next = reconcileWithServer({ mon: merged, care: server.care, ackedSeq: 0 }, queue).state;
    mons = mons.map((m) => (m.monInstanceId === next.mon.monInstanceId ? next.mon : m));
    care = care.some((c) => c.monInstanceId === next.care.monInstanceId)
      ? care.map((c) => (c.monInstanceId === next.care.monInstanceId ? next.care : c))
      : [...care, next.care];
  }
  return { ...save, queue, mons, care };
}

/**
 * One sync attempt. Offline and "no transport" return at once without
 * touching the queue; a failed send leaves it as it was, so nothing is lost.
 */
export async function runSync(input: {
  readonly online: Online;
  readonly queue: WriteQueue | undefined;
  readonly transport: SyncTransport | null;
  readonly nowMs: number;
}): Promise<SyncResult> {
  if (input.online === false) return { outcome: 'offline', conflicts: [] };
  if (input.transport === null) return { outcome: 'signed-out', conflicts: [] };
  if (input.queue === undefined || queuedCount(input.queue) === 0) return { outcome: 'synced', conflicts: [] };
  let reply: SyncReply;
  try {
    reply = await input.transport.send(input.queue);
  } catch (error) {
    if (error instanceof SyncSignedOutError) return { outcome: 'signed-out', conflicts: [] };
    if (error instanceof SyncHttpError && !error.retryable) return { outcome: 'rejected', conflicts: [] };
    return { outcome: 'failed', conflicts: [] };
  }
  const conflicts = reply.serverKept
    .filter((k) => k.count > 0)
    .map((k) => ({ id: `${input.nowMs}-${k.monInstanceId}`, at: input.nowMs, monInstanceId: k.monInstanceId, count: k.count }));
  return { outcome: 'synced', reply, conflicts };
}
