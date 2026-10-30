// A per-attempt deadline for a cell download. Without one, a host that accepts the connection and never answers (or
// stalls mid-body) holds one of the source's download slots until the OS gives up, which can starve every other cell.
//
// Built on a manual AbortController + setTimeout rather than AbortSignal.timeout / AbortSignal.any: React Native's
// AbortController is the abort-controller polyfill, which has neither (Hermes ships no AbortSignal of its own).
// Two phases: `headerMs` to get response headers (a dead host fails fast), then `totalMs` for the whole body.
// The largest cell is 8.9 MB: 90 s covers it down to about 0.8 Mbps. Aborting the fetch's signal also tears down
// the body stream, so a stall mid-body is cut by the same timer.

export const DOWNLOAD_HEADER_MS = 20_000;
export const DOWNLOAD_TOTAL_MS = 90_000;

export interface DownloadDeadline {
  headerMs?: number;
  totalMs?: number;
}

type FetchFn = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

export async function fetchBytesWithDeadline(
  url: string,
  signal: AbortSignal | undefined,
  deadline: DownloadDeadline = {},
  fetchFn: FetchFn = fetch as unknown as FetchFn,
): Promise<Uint8Array> {
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
    if (!res.ok) throw new Error(`cell source: GET ${url} answered ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  } catch (cause) {
    if (timedOutAfter > 0 && !signal?.aborted) throw new Error(`cell source: GET ${url} timed out after ${timedOutAfter} ms`);
    throw cause;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}
