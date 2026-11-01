import { FALLBACK_MON_LINGO, type MonLingo } from '@acme/content/lingo';
import { describe, expect, it, vi } from 'vitest';
import { createMonLingoProxy, createMonLingoSource, type MonLingoFetch } from '../server/mon-lingo-source.ts';

const BASE = 'https://admin.example';
const KEY = 'k'.repeat(40);
const served: MonLingo = { ...FALLBACK_MON_LINGO, guide: [{ ...FALLBACK_MON_LINGO.guide[0]!, text: 'Served rule only.' }] };

function payloadV1(lingo: MonLingo = served, etag = '"v1"') {
  return vi.fn<MonLingoFetch>(async (_url, init) => {
    const headers = new Headers(init.headers);
    if (headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { etag } });
    return new Response(JSON.stringify({ ok: true, data: lingo }), { status: 200, headers: { etag, 'content-type': 'application/json' } });
  });
}

describe('mon lingo source', () => {
  it('reads /v1/mon-lingo with the service key on behalf of the Caller', async () => {
    const fetchFn = payloadV1();
    const source = createMonLingoSource({ baseUrl: BASE, serviceKey: KEY, fetch: fetchFn });
    expect(await source.get('12')).toEqual(served);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/v1/mon-lingo`);
    const headers = new Headers(init.headers);
    expect(headers.get('X-NYC-MON-Service-Key')).toBe(KEY);
    expect(headers.get('X-NYC-MON-On-Behalf-Of')).toBe('12');
    expect(headers.get('if-none-match')).toBeNull();
    expect(source.latest()).toEqual(served);
    expect(source.etag()).toBe('"v1"');
  });

  it('revalidates with If-None-Match once stale and keeps the last good body on 304', async () => {
    let now = 0;
    const fetchFn = payloadV1();
    const source = createMonLingoSource({ baseUrl: BASE, serviceKey: KEY, fetch: fetchFn, maxAgeMs: 1000, now: () => now });
    const first = await source.get('12');
    now = 500;
    expect(await source.get('12')).toBe(first);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    now = 2000;
    expect(await source.get('12')).toBe(first);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchFn.mock.calls[1]![1].headers).get('if-none-match')).toBe('"v1"');
  });

  it('falls back to FALLBACK_MON_LINGO when /v1 never answered, and to the last good body after that', async () => {
    let now = 0;
    const log = vi.fn();
    const down = vi.fn<MonLingoFetch>(async () => new Response('{}', { status: 503 }));
    const fresh = createMonLingoSource({ baseUrl: BASE, serviceKey: KEY, fetch: down, log });
    expect(await fresh.get('12')).toBe(FALLBACK_MON_LINGO);
    expect(fresh.etag()).toBeNull();
    expect(log).toHaveBeenCalled();

    let fail = false;
    const flaky = vi.fn<MonLingoFetch>(async (url, init) => {
      if (fail) throw new TypeError('fetch failed');
      return payloadV1()(url, init);
    });
    const source = createMonLingoSource({ baseUrl: BASE, serviceKey: KEY, fetch: flaky, maxAgeMs: 10, now: () => now, log });
    const good = await source.get('12');
    fail = true;
    now = 100;
    expect(await source.get('12')).toBe(good);
  });

  it('refuses a body that does not match the contract', async () => {
    const bad = vi.fn<MonLingoFetch>(async () => Response.json({ ok: true, data: { lines: 'nope' } }, { headers: { etag: '"x"' } }));
    const source = createMonLingoSource({ baseUrl: BASE, serviceKey: KEY, fetch: bad, log: () => {} });
    expect(await source.get('12')).toBe(FALLBACK_MON_LINGO);
  });

  it('never sends a malformed Caller id upstream', async () => {
    const fetchFn = payloadV1();
    const source = createMonLingoSource({ baseUrl: BASE, serviceKey: KEY, fetch: fetchFn });
    expect(await source.get('12\nX-Evil: 1')).toBe(FALLBACK_MON_LINGO);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('shares one request between concurrent readers', async () => {
    const fetchFn = payloadV1();
    const source = createMonLingoSource({ baseUrl: BASE, serviceKey: KEY, fetch: fetchFn });
    await Promise.all([source.get('12'), source.get('13'), source.get('12')]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/mon-lingo', () => {
  const ORIGIN = 'https://sim.example';
  const proxyWith = (auth: (a: string | null) => Promise<{ callerId: string }>, fetchFn = payloadV1()) =>
    createMonLingoProxy({
      origin: ORIGIN,
      auth,
      source: createMonLingoSource({ baseUrl: BASE, serviceKey: KEY, fetch: fetchFn }),
      rateLimit: () => true,
    });

  it('answers 401 without a valid sign-in and never reaches /v1', async () => {
    const fetchFn = payloadV1();
    const proxy = proxyWith(async () => {
      throw new Error('missing bearer token');
    }, fetchFn);
    const res = await proxy(new Request(`${ORIGIN}/api/mon-lingo`));
    expect(res.status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('serves the lingo JSON with its ETag to a signed-in Caller, and 304 on a match', async () => {
    const proxy = proxyWith(async () => ({ callerId: '12' }));
    const res = await proxy(new Request(`${ORIGIN}/api/mon-lingo`, { headers: { authorization: 'Bearer t' } }));
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"v1"');
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    expect(await res.json()).toEqual({ ok: true, data: served });
    const again = await proxy(new Request(`${ORIGIN}/api/mon-lingo`, { headers: { authorization: 'Bearer t', 'if-none-match': '"v1"' } }));
    expect(again.status).toBe(304);
    expect(again.headers.get('etag')).toBe('"v1"');
  });

  it('only answers GET from this origin', async () => {
    const proxy = proxyWith(async () => ({ callerId: '12' }));
    expect((await proxy(new Request(`${ORIGIN}/api/mon-lingo`, { method: 'POST', body: '{}' }))).status).toBe(405);
    expect((await proxy(new Request(`${ORIGIN}/api/mon-lingo`, { headers: { origin: 'https://evil.example', authorization: 'Bearer t' } }))).status).toBe(403);
  });
});
