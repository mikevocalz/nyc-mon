import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchBytesWithDeadline } from './deadline.ts';

type Res = { ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> };
// Like fetch: an already-aborted signal rejects at once, a later abort rejects the pending call.
const never = (signal: AbortSignal) => new Promise<never>((_, reject) => {
  const fail = () => reject(new DOMException('aborted', 'AbortError'));
  if (signal.aborted) fail(); else signal.addEventListener('abort', fail, { once: true });
});
const ok = (bytes: number[]): Res => ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array(bytes).buffer });

test('a host that never answers is cut at the header deadline', async () => {
  const t0 = Date.now();
  await assert.rejects(
    fetchBytesWithDeadline('https://h/x', undefined, { headerMs: 40, totalMs: 5000 }, (_u, { signal }) => never(signal)),
    /timed out after 40 ms/,
  );
  assert.ok(Date.now() - t0 < 1000);
});

test('a body that stalls after the headers is cut at the total deadline', async () => {
  await assert.rejects(
    fetchBytesWithDeadline('https://h/x', undefined, { headerMs: 1000, totalMs: 80 }, async (_u, { signal }) => ({
      ok: true, status: 200, arrayBuffer: () => never(signal),
    })),
    /timed out after 80 ms/,
  );
});

test('a prompt answer returns its bytes and leaves no timer running', async () => {
  const got = await fetchBytesWithDeadline('https://h/x', undefined, { headerMs: 30, totalMs: 60 }, async () => ok([1, 2, 3]));
  assert.deepEqual([...got], [1, 2, 3]);
  await new Promise((r) => setTimeout(r, 120));   // a leaked timer would abort a signal nobody reads; no unhandled rejection
});

test('a non-2xx answer rejects with its status, not as a timeout', async () => {
  await assert.rejects(
    fetchBytesWithDeadline('https://h/x', undefined, {}, async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) })),
    /answered 404/,
  );
});

test('the caller can still cancel: that is an abort, not a timeout', async () => {
  const caller = new AbortController();
  const p = fetchBytesWithDeadline('https://h/x', caller.signal, { headerMs: 5000, totalMs: 5000 }, (_u, { signal }) => never(signal));
  setTimeout(() => caller.abort(), 20);
  await assert.rejects(p, (e: Error) => e.name === 'AbortError' && !/timed out/.test(e.message));
});

test('an already-aborted caller signal never starts a wait', async () => {
  const caller = new AbortController();
  caller.abort();
  await assert.rejects(
    fetchBytesWithDeadline('https://h/x', caller.signal, { headerMs: 5000, totalMs: 5000 }, (_u, { signal }) => never(signal)),
    (e: Error) => e.name === 'AbortError',
  );
});
