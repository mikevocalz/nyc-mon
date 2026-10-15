import { createHash } from 'node:crypto';
import { EggRecordSchema, ListMyMonsResponseSchema, PutCareResponseSchema, type CareAction, type CareState } from '@acme/core';
import { z } from 'zod';
import type { CallerData, CareWriteIntent, IncubatingEgg, MonWithCare } from './caller.ts';
import { AdultRequiredError, NotFoundError, UpstreamError, WriteUnconfirmedError } from './errors.ts';

/** Headers admin-vite's `/v1` reads for on-behalf-of calls (payload `v1/service-caller.ts`). */
export const SERVICE_KEY_HEADER = 'X-NYC-MON-Service-Key';
export const ON_BEHALF_OF_HEADER = 'X-NYC-MON-On-Behalf-Of';
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

const ListMyEggsResponseSchema = z.object({
  eggs: z.array(z.object({ egg: EggRecordSchema, readyToHatch: z.boolean() })),
});

const ErrorEnvelopeSchema = z.object({ ok: z.literal(false), error: z.object({ code: z.string() }) });

export interface V1CallerDataOptions {
  readonly baseUrl: string;
  /** Unset only under OAUTH_DEV_BYPASS; `/v1` then answers 401. */
  readonly serviceKey: string | undefined;
  readonly timeoutMs: number;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
}

/**
 * The device id this server writes care under for one Caller. Stable across
 * restarts and processes, so the `/v1` per-device seq high-water mark keeps
 * working, and distinct from any phone's id.
 */
export function deviceIdFor(callerId: string): string {
  return `mcp-${createHash('sha256').update(callerId, 'utf8').digest('hex').slice(0, 24)}`;
}

const MAX_REMEMBERED_INTENTS = 1_000;

/**
 * The Idempotency-Key for one care intent: a hash of the Caller, Mon, action
 * and intent key. It survives a restart (the server's idempotency record
 * replays the first response); the in-process cache also keeps seq and `at`.
 */
export function idempotencyKeyFor(write: Pick<CareWriteIntent, 'callerId' | 'monInstanceId' | 'action' | 'intentKey'>): string {
  const material = JSON.stringify([write.callerId, write.monInstanceId, write.action, write.intentKey]);
  return `mcp-care-${createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 40)}`;
}

/**
 * `CallerData` over admin-vite's `/v1` (ADR 0001 §1.4). The MCP access token
 * is never forwarded: requests carry the server's own key and name the Caller.
 *
 * Care writes need a seq that is monotonic per device across restarts, or
 * `/v1` silently drops them as already applied. The seq is the wall clock in
 * ms, bumped past the last value this process issued, so a restart resumes
 * above every earlier write as long as the clock does not step back.
 */
export class V1CallerData implements CallerData {
  private readonly lastSeq = new Map<string, number>();
  /** Idempotency-Key → the seq and `at` its first send used (LRU, in-process). */
  private readonly sentIntents = new Map<string, { seq: number; at: number }>();
  private readonly doFetch: typeof fetch;
  private readonly now: () => number;
  private readonly options: V1CallerDataOptions;

  constructor(options: V1CallerDataOptions) {
    this.options = options;
    this.doFetch = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  async listMons(callerId: string): Promise<readonly MonWithCare[]> {
    const body = await this.request(callerId, 'GET', '/v1/me/mons');
    return parseData(ListMyMonsResponseSchema, body).mons;
  }

  async listIncubatingEggs(callerId: string): Promise<readonly IncubatingEgg[]> {
    const body = await this.request(callerId, 'GET', '/v1/me/eggs');
    return parseData(ListMyEggsResponseSchema, body).eggs;
  }

  async applyCare(write: CareWriteIntent): Promise<MonWithCare> {
    const { callerId, monInstanceId, action } = write;
    const deviceId = deviceIdFor(callerId);
    const idempotencyKey = idempotencyKeyFor(write);
    // A resent intent reuses its first seq and time, so the body is byte-identical
    // and /v1's per-device seq check also drops it if the first send landed.
    const sent = this.sentIntents.get(idempotencyKey) ?? { seq: this.nextSeq(deviceId), at: write.at };
    this.rememberIntent(idempotencyKey, sent);
    let body: unknown;
    try {
      body = await this.request(
        callerId,
        'PUT',
        `/v1/mons/${encodeURIComponent(monInstanceId)}/care`,
        { writes: [{ deviceId, seq: sent.seq, monInstanceId, at: sent.at, action }] },
        idempotencyKey,
      );
    } catch (error) {
      if (!(error instanceof WriteUnconfirmedError)) throw error;
      // The PUT may have landed. Re-read once: if the write shows in the stored
      // care, answer with that state; otherwise stay unconfirmed. A resend of
      // this intent reuses the key, so it can never apply twice.
      const reread = (await this.listMons(callerId)).find((entry) => entry.mon.monInstanceId === monInstanceId);
      if (reread !== undefined && writeLanded(reread.care, action, sent.at)) return reread;
      throw error;
    }
    const { mon, care } = parseData(PutCareResponseSchema, body);
    return { mon, care };
  }

  private rememberIntent(key: string, sent: { seq: number; at: number }): void {
    this.sentIntents.delete(key);
    this.sentIntents.set(key, sent);
    if (this.sentIntents.size > MAX_REMEMBERED_INTENTS) {
      const oldest = this.sentIntents.keys().next().value;
      if (oldest !== undefined) this.sentIntents.delete(oldest);
    }
  }

  /** Next seq for a device: the clock, or one past the last issued value. */
  nextSeq(deviceId: string): number {
    const seq = Math.max(this.now(), (this.lastSeq.get(deviceId) ?? 0) + 1);
    this.lastSeq.set(deviceId, seq);
    return seq;
  }

  private async request(
    callerId: string,
    method: 'GET' | 'PUT',
    path: string,
    json?: unknown,
    idempotencyKey?: string,
  ): Promise<unknown> {
    const headers: Record<string, string> = { accept: 'application/json', [ON_BEHALF_OF_HEADER]: callerId };
    if (this.options.serviceKey !== undefined) headers[SERVICE_KEY_HEADER] = this.options.serviceKey;
    if (json !== undefined) headers['content-type'] = 'application/json';
    if (idempotencyKey !== undefined) headers[IDEMPOTENCY_KEY_HEADER] = idempotencyKey;

    let response: Response;
    try {
      response = await this.doFetch(new URL(path, this.options.baseUrl), {
        method,
        headers,
        body: json === undefined ? undefined : JSON.stringify(json),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      const detail = `/v1 ${method} ${path} failed: ${error instanceof Error ? error.message : String(error)}`;
      // A PUT may have been applied before the timeout or drop; a GET changes nothing.
      throw method === 'PUT' ? new WriteUnconfirmedError(detail) : new UpstreamError(detail);
    }

    const body: unknown = await response.json().catch(() => undefined);
    if (response.ok) return body;

    const code = ErrorEnvelopeSchema.safeParse(body).data?.error.code;
    if (response.status === 403 && (code === 'ADULT_REQUIRED' || code === 'CONSENT_REQUIRED')) {
      throw new AdultRequiredError(`/v1 refused the account (${code})`);
    }
    if (response.status === 404) throw new NotFoundError(`/v1 ${path} answered 404`);
    throw new UpstreamError(`/v1 ${method} ${path} answered ${response.status}${code === undefined ? '' : ` ${code}`}`);
  }
}

/**
 * Whether stored care shows a write of `action` applied at `at`. Each action
 * stamps a field with the write time (`applyCareAction` in core); `wake`
 * stamps none, so it counts when care is awake and was advanced to `at`.
 */
export function writeLanded(care: CareState, action: CareAction, at: number): boolean {
  switch (action.kind) {
    case 'feed':
      return care.lastFedAt === at;
    case 'rest':
      return care.lastRestedAt === at;
    case 'play':
      return care.lastSocialAt === at;
    case 'wake':
      return care.activity.kind === 'awake' && care.updatedAt >= at;
  }
}

function parseData<T>(schema: z.ZodType<T>, body: unknown): T {
  const envelope = z.object({ ok: z.literal(true), data: schema }).safeParse(body);
  if (!envelope.success) throw new UpstreamError(`/v1 response did not match the contract: ${envelope.error.message}`);
  return envelope.data.data;
}
