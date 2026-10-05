import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import { IDEMPOTENCY_RECORDS_SLUG } from '../../../../collections/IdempotencyRecords.ts';
import { IDEMPOTENCY_KEY_HEADER, runIdempotent, withIdempotency } from '../idempotency.ts';

type LocalApiCall = (options: Record<string, unknown>) => Promise<unknown>;

/**
 * A Payload stand-in that actually stores idempotency records in a Map, so
 * `runIdempotent`'s find/create round-trip is exercised without a database.
 */
function fakePayload() {
  const records = new Map<string, Record<string, unknown>>();
  const find = vi.fn<LocalApiCall>(async (args) => {
    const where = args.where as { key?: { equals?: string } } | undefined;
    const key = where?.key?.equals;
    const doc = key === undefined ? undefined : records.get(key);
    return { docs: doc === undefined ? [] : [doc] };
  });
  const create = vi.fn<LocalApiCall>(async (args) => {
    if (args.collection !== IDEMPOTENCY_RECORDS_SLUG) return { id: 1 };
    const data = args.data as Record<string, unknown>;
    const key = String(data.key);
    if (records.has(key)) throw new Error(`duplicate key ${key}`);
    records.set(key, data);
    return data;
  });
  const auth = vi.fn(async () => ({ user: null as { id: number } | null }));
  const payload = {
    find,
    create,
    auth,
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  } as unknown as Payload;
  return { payload, records, find, create, auth };
}

const caller = { callerId: 41 };
const anonymous = { callerId: null };

function post(url: string, key?: string): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (key !== undefined) headers.set(IDEMPOTENCY_KEY_HEADER, key);
  return new Request(url, { method: 'POST', headers, body: '{}' });
}

describe('runIdempotent', () => {
  it('passes through unkeyed when the Idempotency-Key header is absent', async () => {
    const { payload, create } = fakePayload();
    const handler = vi.fn(async () => Response.json({ ok: true }, { status: 200 }));

    const first = await runIdempotent(payload, caller, post('https://a.test/v1/eggs'), handler);
    const second = await runIdempotent(payload, caller, post('https://a.test/v1/eggs'), handler);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
  });

  it('replays the first response byte-identically and runs the mutation once', async () => {
    const { payload, create } = fakePayload();
    // The "underlying create" the handler would perform, e.g. the eggs insert.
    const handler = vi.fn(async () => {
      await (payload.create as LocalApiCall)({ collection: 'eggs', data: { eggId: 'egg_1' } });
      return Response.json({ ok: true, data: { eggId: 'egg_1', monInstanceId: 'mon_1' } }, { status: 200 });
    });
    const request = () => post('https://a.test/v1/eggs', 'idem-1');

    const first = await runIdempotent(payload, caller, request(), handler);
    const second = await runIdempotent(payload, caller, request(), handler);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.text()).toBe(await second.text());
    expect(second.headers.get('content-type')).toBe(first.headers.get('content-type'));
    expect(second.headers.get('Idempotent-Replayed')).toBe('true');
    expect(handler).toHaveBeenCalledTimes(1);

    const collections = create.mock.calls.map((call) => String((call[0] as Record<string, unknown>).collection));
    expect(collections.filter((c) => c === 'eggs')).toHaveLength(1);
    expect(collections.filter((c) => c === IDEMPOTENCY_RECORDS_SLUG)).toHaveLength(1);
  });

  it('replays a deterministic 4xx too', async () => {
    const { payload } = fakePayload();
    const handler = vi.fn(async () => Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 }));
    const request = () => post('https://a.test/v1/eggs/egg_1/hatch', 'idem-2');

    const first = await runIdempotent(payload, caller, request(), handler);
    const second = await runIdempotent(payload, caller, request(), handler);

    expect(second.status).toBe(404);
    expect(await second.text()).toBe(await first.text());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('never caches a 5xx', async () => {
    const { payload } = fakePayload();
    const handler = vi.fn(async () => Response.json({ ok: false }, { status: 500 }));
    const request = () => post('https://a.test/v1/eggs', 'idem-3');

    await runIdempotent(payload, caller, request(), handler);
    await runIdempotent(payload, caller, request(), handler);

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('scopes the key to the caller, so a second caller runs its own mutation', async () => {
    const { payload, records } = fakePayload();
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const request = () => post('https://a.test/v1/eggs', 'shared-key');

    await runIdempotent(payload, { callerId: 41 }, request(), handler);
    await runIdempotent(payload, { callerId: 99 }, request(), handler);

    expect(handler).toHaveBeenCalledTimes(2);
    const keys = [...records.keys()];
    expect(keys.some((k) => k.startsWith('caller:41|'))).toBe(true);
    expect(keys.some((k) => k.startsWith('caller:99|'))).toBe(true);
  });

  it('scopes the key to the endpoint, so another path is not a replay', async () => {
    const { payload } = fakePayload();
    const handler = vi.fn(async () => Response.json({ ok: true }));

    await runIdempotent(payload, anonymous, post('https://a.test/v1/eggs', 'k'), handler);
    await runIdempotent(payload, anonymous, post('https://a.test/v1/guardian-consents', 'k'), handler);

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('replays the stored winner when the create loses the unique-key race', async () => {
    const { payload, create, find } = fakePayload();
    // Simulate a concurrent retry having stored first: create throws on the
    // duplicate, the follow-up find must return the stored record.
    const storedWinner = {
      key: 'anonymous|POST /v1/eggs|race',
      path: 'POST /v1/eggs',
      status: 200,
      contentType: 'application/json',
      body: '{"ok":true,"data":{"won":true}}',
    };
    create.mockImplementation(async () => {
      throw new Error('duplicate key');
    });
    // Miss on the pre-handler lookup, hit on the post-conflict re-read.
    find.mockResolvedValueOnce({ docs: [] }).mockResolvedValue({ docs: [storedWinner] });

    const handler = vi.fn(async () => Response.json({ ok: true, data: { won: false } }));
    const res = await runIdempotent(payload, anonymous, post('https://a.test/v1/eggs', 'race'), handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true,"data":{"won":true}}');
  });
});

describe('withIdempotency', () => {
  it('anonymous scope replays without resolving a caller', async () => {
    const { payload, auth } = fakePayload();
    const handler = vi.fn(async () => Response.json({ id: 7, status: 'pending' }, { status: 200 }));
    const wrapped = withIdempotency(handler, { scope: 'anonymous', payload });
    const request = () => post('https://a.test/v1/guardian-consents', 'guardian-1');

    const first = await wrapped(request());
    const second = await wrapped(request());

    expect(auth).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await second.text()).toBe(await first.text());
  });

  it('caller scope resolves the user to key the record', async () => {
    const { payload, auth } = fakePayload();
    auth.mockResolvedValue({ user: { id: 41 } });
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withIdempotency(handler, { scope: 'caller', payload });
    const request = () => post('https://a.test/v1/eggs', 'idem-caller');

    const first = await wrapped(request());
    const second = await wrapped(request());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(await second.text()).toBe(await first.text());
    expect(auth).toHaveBeenCalled();
  });

  it('passes route params through to the handler', async () => {
    const { payload } = fakePayload();
    const handler = vi.fn(async (_request: Request, id: string) => Response.json({ id }));
    const wrapped = withIdempotency(handler, { scope: 'anonymous', payload });

    const res = await wrapped(post('https://a.test/v1/mons/mon_9/care', 'care-1'), 'mon_9');
    expect(await res.json()).toEqual({ id: 'mon_9' });
  });
});
