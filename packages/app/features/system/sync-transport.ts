import { deriveMonInstanceId, isStoredMonName } from '@acme/core/sim';
import {
  AdoptMonResponseSchema, CreateEggResponseSchema, ListMyMonsResponseSchema, PutCareResponseSchema,
} from '@acme/core/schemas';
import type {
  AdoptMonRequest, CareState, CareWrite, CreateEggResponse, MonInstance, SaveCurrent, WriteQueue,
} from '@acme/core/types';
import { SyncHttpError, SyncSignedOutError, type SyncReply, type SyncTransport } from './sync-model.ts';

/**
 * The M21 sender: turns the device's write queue into `/v1` calls on the
 * admin host (packages/payload/src/admin/console/v1/game.ts, adopt.ts).
 *
 * One send, in order:
 * 1. `POST /v1/eggs` for each queued egg that has not hatched here.
 * 2. `GET /v1/me/mons`, once, to learn which of the queue's Mons the server has.
 * 3. `POST /v1/mons/adopt` for each queued Mon the server lacks (a hatched egg
 *    it never saw, or a server that lost its data). The device's state goes up
 *    with the highest seq it already holds, so those writes are not applied twice.
 * 4. `PUT /v1/mons/:id/care` with one `CareWrite` per request, oldest first,
 *    for every write the adopt did not already cover.
 *
 * Every mutating call sends an `Idempotency-Key` derived from the write
 * itself (`care-<deviceId>-<seq>`, `egg-<eggId>`, `adopt-<eggId>`), so a retry
 * after a lost answer gets the first answer back instead of a second apply.
 * The session rides on the platform cookie jar (native) or the browser's
 * cookies (`credentials: 'include'`), as `/v1/mon-voice` does.
 *
 * Any failure throws and the queue stays as it is; the next send repeats the
 * same keys, so the writes that did land are not applied again.
 */
export interface SyncTransportDeps {
  /** The admin-vite origin (`AUTH_BASE_URL`). */
  readonly baseUrl: string;
  /** Native sends `origin: nycmon://` (RN fetch sets none). */
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** The save as it is now. Mons, care and eggs for an adopt come from it. */
  readonly readSave: () => SaveCurrent | undefined;
}

/** The `Idempotency-Key` for one care write: stable across retries, unique per device and seq. */
export const careWriteKey = (write: Pick<CareWrite, 'deviceId' | 'seq'>): string => `care-${write.deviceId}-${write.seq}`;
export const eggCreateKey = (eggId: string): string => `egg-${eggId}`;
export const adoptKey = (eggId: string): string => `adopt-${eggId}`;

/** The `PUT /v1/mons/:id/care` call for one queued write. */
export function careRequest(write: CareWrite): { readonly path: string; readonly key: string; readonly body: { readonly writes: readonly CareWrite[] } } {
  return { path: `/v1/mons/${encodeURIComponent(write.monInstanceId)}/care`, key: careWriteKey(write), body: { writes: [write] } };
}

/**
 * The `POST /v1/mons/adopt` body for a Mon that lives only in this save, or
 * null when the save lacks the Mon, its care or its egg. `care` is the save's
 * state, which already holds every queued write for the Mon, so
 * `appliedThroughSeq` is the highest of those seqs.
 */
export function adoptRequest(save: SaveCurrent, queue: WriteQueue, monInstanceId: string): AdoptMonRequest | null {
  const mon = save.mons.find((m) => m.monInstanceId === monInstanceId);
  const care = save.care.find((c) => c.monInstanceId === monInstanceId);
  const egg = save.eggs.find((e) => deriveMonInstanceId(e.eggId) === monInstanceId);
  if (mon === undefined || care === undefined || egg === undefined) return null;
  const appliedThroughSeq = queue.entries.reduce((max, w) => (w.monInstanceId === monInstanceId && w.seq > max ? w.seq : max), 0);
  return {
    egg: {
      eggId: egg.eggId,
      speciesId: egg.speciesId,
      hatchesIntoSpeciesId: egg.hatchesIntoSpeciesId,
      incubationMinutes: egg.incubationMinutes,
      createdAt: egg.createdAt,
    },
    mon: {
      monInstanceId,
      speciesId: mon.speciesId,
      stage: mon.stage,
      bond: mon.bond,
      // A pre-M09 name can't be written to the server; the device keeps it.
      nickname: mon.nickname !== null && isStoredMonName(mon.nickname) ? mon.nickname : null,
      gender: mon.gender,
      voiceLineageId: mon.voiceLineageId,
    },
    care,
    deviceId: queue.deviceId,
    appliedThroughSeq,
  };
}

/** The part of a zod schema the transport uses. */
interface Parser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { message: string } };
}

interface Envelope {
  readonly ok?: unknown;
  readonly data?: unknown;
  readonly error?: { readonly code?: unknown; readonly message?: unknown };
}

export function createSyncTransport(deps: SyncTransportDeps): SyncTransport {
  async function call<T>(method: string, path: string, schema: Parser<T>, options: { key?: string; body?: unknown } = {}): Promise<T> {
    const res = await deps.fetch(`${deps.baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        accept: 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.key === undefined ? {} : { 'Idempotency-Key': options.key }),
        ...deps.headers,
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    let json: Envelope | undefined;
    try {
      json = (await res.json()) as Envelope;
    } catch {
      json = undefined;
    }
    const code = typeof json?.error?.code === 'string' ? json.error.code : 'HTTP_ERROR';
    const message = typeof json?.error?.message === 'string' ? json.error.message : res.statusText;
    if (res.status === 401) throw new SyncSignedOutError(message);
    if (!res.ok || json?.ok !== true) throw new SyncHttpError(res.status, code, message);
    const parsed = schema.safeParse(json.data);
    // A 200 the contract can't read is the server's fault, and may be fixed on retry.
    if (!parsed.success) throw new SyncHttpError(502, 'INVALID_RESPONSE', parsed.error.message);
    return parsed.data;
  }

  return {
    async send(sent) {
      // The save read now is a superset of `sent` (writes only append between
      // reads, and acks come only from the sync that is running), and its care
      // matches its queue, which an adopt needs.
      const save = deps.readSave();
      const queue = save?.queue ?? sent;
      const localMon = (id: string) => save?.mons.some((m) => m.monInstanceId === id) === true;

      const eggs: CreateEggResponse[] = [];
      const states = new Map<string, { mon: MonInstance; care: CareState }>();
      const serverKept = new Map<string, number>();

      // 1. Eggs that are still eggs here. A hatched one goes up with its Mon in step 3.
      const hatchedEggs = queue.eggCreates.filter((e) => localMon(deriveMonInstanceId(e.request.eggId)));
      for (const { request } of queue.eggCreates) {
        if (hatchedEggs.some((e) => e.request.eggId === request.eggId)) continue;
        eggs.push(await call('POST', '/v1/eggs', CreateEggResponseSchema, { key: eggCreateKey(request.eggId), body: request }));
      }

      // 2. Which Mons the server already has.
      const monIds = [...new Set([
        ...queue.entries.map((w) => w.monInstanceId),
        ...hatchedEggs.map((e) => deriveMonInstanceId(e.request.eggId)),
      ])];
      const onServer = new Set<string>();
      if (monIds.length > 0) {
        const mine = await call('GET', '/v1/me/mons', ListMyMonsResponseSchema);
        for (const { mon } of mine.mons) onServer.add(mon.monInstanceId);
      }

      // 3. Claim the Mons that exist only here.
      const coveredThrough = new Map<string, number>();
      for (const monInstanceId of monIds) {
        if (onServer.has(monInstanceId)) continue;
        const body = save === undefined ? null : adoptRequest(save, queue, monInstanceId);
        if (body === null) throw new SyncHttpError(409, 'MON_NOT_IN_SAVE', `Mon ${monInstanceId} is not on the server and not in this save`);
        const adopted = await call('POST', '/v1/mons/adopt', AdoptMonResponseSchema, { key: adoptKey(body.egg.eggId), body });
        coveredThrough.set(monInstanceId, adopted.ackedSeq);
        states.set(monInstanceId, { mon: adopted.mon, care: adopted.care });
      }
      for (const { request } of hatchedEggs) {
        const egg = save?.eggs.find((e) => e.eggId === request.eggId);
        eggs.push({ eggId: request.eggId, monInstanceId: deriveMonInstanceId(request.eggId), incubationEndsAt: egg?.incubationEndsAt ?? 0 });
      }

      // 4. Care writes the server doesn't hold yet, one per request, in seq order.
      const writes = [...queue.entries].sort((a, b) => a.seq - b.seq);
      for (const write of writes) {
        if (write.seq <= (coveredThrough.get(write.monInstanceId) ?? 0)) continue;
        const { path, key, body } = careRequest(write);
        const answer = await call('PUT', path, PutCareResponseSchema, { key, body });
        states.set(write.monInstanceId, { mon: answer.mon, care: answer.care });
        const setAside = answer.applied === undefined ? 0 : body.writes.length - answer.applied;
        if (setAside > 0) serverKept.set(write.monInstanceId, (serverKept.get(write.monInstanceId) ?? 0) + setAside);
      }

      return {
        ackedSeq: writes.at(-1)?.seq ?? 0,
        eggs,
        serverKept: [...serverKept].map(([monInstanceId, count]) => ({ monInstanceId, count })),
        states: [...states.values()],
      } satisfies SyncReply;
    },
  };
}
