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
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(expire(headerMs), headerMs);
  try {
    const res = await fetchFn(url, { signal: controller.signal });
    clearTimeout(timer);
    // Headers are in: the body gets the rest of the total budget.
    const left = Math.max(1, totalMs - (Date.now() - startedAt));
    timer = setTimeout(expire(totalMs), left);
    if (!res.ok) throw new Error(`net: GET ${url} answered ${res.status}`);
    return await res.arrayBuffer();
  } catch (cause) {
    if (timedOutAfter > 0 && !signal?.aborted) throw new Error(`net: GET ${url} timed out after ${timedOutAfter} ms`);
    throw cause;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}
