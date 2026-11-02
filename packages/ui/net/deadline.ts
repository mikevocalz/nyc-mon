// No import of a fetch implementation: each platform sibling passes its own
// (egg-bytes.native.ts → net/index.native, the web fork → @acme/ui/net).

// A per-attempt deadline for a binary download. Without one, a host that accepts the connection and never answers
// (or stalls mid-body) holds the call forever — on the load path that meant Promise.all never resolving and the
// city's bar frozen at 'requested' (A12X iPad, 2026-11-01: a stalled dev-server asset request). Mirrored on
// cell-source/deadline.ts, kept here because @acme/ui cannot import the app package.
//
// Manual AbortController + setTimeout, not AbortSignal.timeout/any: React Native's AbortController is the
// abort-controller polyfill, which has neither (Hermes ships no AbortSignal of its own).
// Two phases: `headerMs` to get response headers (a dead host fails fast), then `totalMs` for the whole body.
export const DOWNLOAD_HEADER_MS = 20_000;
export const DOWNLOAD_TOTAL_MS = 120_000;

export interface DownloadDeadline {
  headerMs?: number;
  totalMs?: number;
}

type FetchFn = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

export async function fetchBytesWithDeadline(
  url: string,
  signal: AbortSignal | undefined,
  deadline: DownloadDeadline = {},
  fetchFn: FetchFn,
): Promise<ArrayBuffer> {
  const headerMs = deadline.headerMs ?? DOWNLOAD_HEADER_MS;
  const totalMs = deadline.totalMs ?? DOWNLOAD_TOTAL_MS;
  const controller = new AbortController();
  let timedOutAfter = 0;
  const expire = (ms: number) => () => {
    timedOutAfter = ms;
    controller.abort();
  };
  const onCallerAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', onCallerAbort, { once: true });
  const startedAt = Date.now();
  // Race, not rely on abort: RN's polyfilled fetch does not propagate
  // AbortSignal into an in-flight body read, so an aborted await can still
  // pend forever. The race guarantees the deadline rejects either way.
  const timeout = (ms: number): Promise<never> =>
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        timedOutAfter = ms;
        controller.abort();
        reject(new Error(`net: GET ${url} timed out after ${ms} ms`));
      }, ms),
    );
  try {
    const res = await Promise.race([fetchFn(url, { signal: controller.signal }), timeout(headerMs)]);
    // Headers are in: the body gets the rest of the total budget.
    const left = Math.max(1, totalMs - (Date.now() - startedAt));
    if (!res.ok) throw new Error(`net: GET ${url} answered ${res.status}`);
    return await Promise.race([res.arrayBuffer(), timeout(left)]);
  } catch (cause) {
    // An abort propagated from the fetch is a deadline expiry in disguise:
    // surface the budget that fired, not whatever the abort threw.
    if (timedOutAfter > 0 && !signal?.aborted) throw new Error(`net: GET ${url} timed out after ${timedOutAfter} ms`);
    throw cause;
  } finally {
    signal?.removeEventListener('abort', onCallerAbort);
  }
}
