import { FALLBACK_MON_LINGO, parseMonLingo, type MonLingo } from '@acme/content/lingo';
import type { ModelAuthCheck } from './model-auth.ts';

/**
 * The Mon's lines and lingo as Payload publishes them (`GET /v1/mon-lingo`),
 * for the NVIDIA server: /api/tts plans with it, the ASR boosts its words, the
 * host note lists its stage directions and every model turn carries its voice
 * guide. The request carries the same service delegation as companion memory
 * (companion-memory-client.ts) and as the MCP server's data layer
 * (packages/mcp-server/src/data/v1.ts): the service key plus the Caller it is
 * made for. The table is the same for every Caller; the Caller id only
 * satisfies the key's on-behalf-of rule.
 *
 * One body is cached for the process. Within `maxAgeMs` it is served as is;
 * after that it is revalidated with If-None-Match, so an unchanged table
 * costs a 304 and keeps the cached body. When /v1 cannot answer, the last good
 * body stays; before the first one, FALLBACK_MON_LINGO (the seed). `get`
 * never rejects: the voice data is never a reason to fail a turn.
 */

export type MonLingoFetch = (url: URL, init: RequestInit) => Promise<Response>;

export interface MonLingoSource {
  /** The served lingo, revalidated when stale. Never rejects. */
  get(callerId: string): Promise<MonLingo>;
  /** The last good served lingo, or the fallback before one arrived. No request. */
  latest(): MonLingo;
  /** The ETag of `latest()`; null while it is the fallback. */
  etag(): string | null;
}

export interface MonLingoSourceOptions {
  /** V1_BASE_URL: the admin-vite backend that serves /v1. */
  readonly baseUrl: string;
  /** V1_MCP_SERVICE_KEY. */
  readonly serviceKey: string;
  readonly fetch?: MonLingoFetch;
  /** How long a body is served without asking /v1 again. Default 30 s. */
  readonly maxAgeMs?: number;
  readonly now?: () => number;
  /** One line per failed refresh, never a body or a key. Default console.warn. */
  readonly log?: (line: string) => void;
}

/** Same Caller id shape the companion memory client accepts. */
const CALLER_ID = /^[1-9][0-9]{0,9}$/;
const MAX_BODY_BYTES = 1_000_000;
const TIMEOUT_MS = 5_000;

export function createMonLingoSource(options: MonLingoSourceOptions): MonLingoSource {
  const endpoint = new URL('/v1/mon-lingo', options.baseUrl);
  const doFetch = options.fetch ?? ((url, init) => fetch(url, init));
  const maxAgeMs = options.maxAgeMs ?? 30_000;
  const now = options.now ?? Date.now;
  const log = options.log ?? ((line: string) => console.warn(line));
  let cached: { readonly etag: string | null; readonly data: MonLingo } | undefined;
  let checkedAt = Number.NEGATIVE_INFINITY;
  let inflight: Promise<MonLingo> | undefined;

  async function refresh(callerId: string): Promise<MonLingo> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'X-NYC-MON-Service-Key': options.serviceKey,
      'X-NYC-MON-On-Behalf-Of': callerId,
    };
    if (cached?.etag) headers['if-none-match'] = cached.etag;
    try {
      const response = await doFetch(endpoint, { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.status === 304 && cached !== undefined) return cached.data;
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new Error(`answered ${response.status}`);
      }
      const raw = await response.text();
      if (raw.length > MAX_BODY_BYTES) throw new Error('body too large');
      const data = parseMonLingo((JSON.parse(raw) as { data?: unknown } | null)?.data);
      if (data === undefined) throw new Error('body did not match the contract');
      cached = { etag: response.headers.get('etag'), data };
      return data;
    } catch (error) {
      log(`[mon-lingo] /v1/mon-lingo unavailable, using the ${cached === undefined ? 'bundled fallback' : 'last served table'}: ${error instanceof Error ? error.message : 'unknown'}`);
      return cached?.data ?? FALLBACK_MON_LINGO;
    } finally {
      // A failure waits out maxAgeMs too, so a down /v1 is not asked on every line.
      checkedAt = now();
    }
  }

  return {
    get(callerId) {
      if (!CALLER_ID.test(callerId)) return Promise.resolve(cached?.data ?? FALLBACK_MON_LINGO);
      if (now() - checkedAt < maxAgeMs) return Promise.resolve(cached?.data ?? FALLBACK_MON_LINGO);
      inflight ??= refresh(callerId).finally(() => {
        inflight = undefined;
      });
      return inflight;
    },
    latest: () => cached?.data ?? FALLBACK_MON_LINGO,
    etag: () => cached?.etag ?? null,
  };
}

/** True when an If-None-Match header names `etag` (or its weak form, or `*`). */
function etagMatches(header: string | null, etag: string): boolean {
  if (header === null) return false;
  return header.split(',').some((tag) => {
    const t = tag.trim();
    return t === '*' || t === etag || t === `W/${etag}`;
  });
}

/**
 * `GET /api/mon-lingo`: the served lingo for the NVIDIA page, behind the same
 * sign-in and origin rule as /api/memory. Answers `{ ok, data }` like
 * /v1/mon-lingo, with its ETag and a 304 on If-None-Match. While /v1 has never
 * answered, it serves the fallback without an ETag.
 *
 * For the client lane: src/client/speech.ts should GET /api/mon-lingo and pass
 * `data` to planMonUtterance(text, ref, lingo).
 */
export function createMonLingoProxy(options: { origin: string; auth: ModelAuthCheck; source: MonLingoSource; rateLimit(key: string): boolean }) {
  return async (request: Request): Promise<Response> => {
    const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
    if (request.method !== 'GET') return reply(405, { error: 'method_not_allowed' });
    // Browsers leave Origin off a same-origin GET; a cross-origin one carries it.
    const origin = request.headers.get('origin');
    if (origin !== null && origin !== options.origin) return reply(403, { error: 'forbidden_origin' });
    let callerId: string;
    try {
      ({ callerId } = await options.auth(request.headers.get('authorization')));
    } catch {
      return reply(401, { error: 'sign_in_required' });
    }
    if (!options.rateLimit(callerId)) return reply(429, { error: 'rate_limited' });
    const data = await options.source.get(callerId);
    const etag = options.source.etag();
    const headers: Record<string, string> = { 'cache-control': 'private, no-cache', vary: 'Authorization' };
    if (etag !== null) {
      headers.etag = etag;
      if (etagMatches(request.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers });
    }
    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
  };
}
