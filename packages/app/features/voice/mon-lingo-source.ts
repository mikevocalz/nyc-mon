import { FALLBACK_MON_LINGO, parseMonLingo, type MonLingo } from '@acme/content/voice';

/**
 * The Mon's lines and lingo as Payload publishes them (`GET /v1/mon-lingo`).
 * Until the first answer, and whenever the server can't be reached, the
 * bundled fallback (the seed Payload was loaded with) answers. A refresh sends
 * the last ETag, so an unchanged table costs a 304 and no body. A malformed
 * answer is ignored: the Mon keeps the table it had instead of speaking with
 * half a table.
 */
export interface MonLingoSource {
  /** The tables to plan with right now. */
  current(): MonLingo;
  /** Revalidates with the server; never throws. Concurrent calls share one request. */
  refresh(): Promise<void>;
}

export interface MonLingoSourceDeps {
  readonly baseUrl: string;
  /** Native sends `origin: nycmon://` (RN fetch sets none). */
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  readonly fallback?: MonLingo;
}

export function createMonLingoSource(deps: MonLingoSourceDeps): MonLingoSource {
  let lingo = deps.fallback ?? FALLBACK_MON_LINGO;
  let etag: string | undefined;
  let pending: Promise<void> | undefined;

  const load = async () => {
    try {
      const res = await deps.fetch(`${deps.baseUrl}/v1/mon-lingo`, {
        method: 'GET',
        credentials: 'include',
        headers: { accept: 'application/json', ...deps.headers, ...(etag === undefined ? {} : { 'if-none-match': etag }) },
      });
      if (res.status === 304 || !res.ok) {
        await res.body?.cancel().catch(() => {});
        return;
      }
      const body = (await res.json()) as { ok?: unknown; data?: unknown };
      const served = body.ok === true ? parseMonLingo(body.data) : undefined;
      if (served === undefined) return;
      lingo = served;
      etag = res.headers.get('etag') ?? undefined;
    } catch {
      // Offline or signed out: keep what we have.
    }
  };

  return {
    current: () => lingo,
    refresh() {
      pending ??= load().finally(() => {
        pending = undefined;
      });
      return pending;
    },
  };
}
