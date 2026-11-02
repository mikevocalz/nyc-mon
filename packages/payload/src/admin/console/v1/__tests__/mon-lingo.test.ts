import { FALLBACK_MON_LINGO, MON_BABBLE_SEED_ROWS, MON_EGG_STAGE_PITCH, MON_LINGO_SEED_ROWS, MON_VOICES_SEED, parseMonLingo, type MonLingo } from '@acme/content/lingo';
import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import {
  createMonLingoHandler,
  createMonLingoReader,
  etagMatches,
  lexiconRowsFromDocs,
  MonLingoUnavailable,
  monVoicesFromDoc,
  readMonLingoFromPayload,
} from '../mon-lingo.ts';
import { ON_BEHALF_OF_HEADER, SERVICE_KEY_HEADER } from '../service-caller.ts';

type Doc = Record<string, unknown>;

const SERVICE_KEY = 's'.repeat(48);
const WEB_ORIGIN = 'https://nycmon.test';

function fakePayload(opts: { sessionUser?: Doc | null; callers?: Doc[] } = {}) {
  const callers = opts.callers ?? [{ id: 'c1', birthYear: 1990 }];
  const find = vi.fn(async (args: Record<string, unknown>) => {
    const where = (args.where ?? {}) as Record<string, { equals?: unknown }>;
    const rows = args.collection === 'users' ? callers : [];
    return { docs: rows.filter((doc) => Object.entries(where).every(([k, c]) => c?.equals === undefined || doc[k] === c.equals)) };
  });
  const findByID = vi.fn(async (args: Record<string, unknown>) => callers.find((c) => c.id === args.id) ?? null);
  const auth = vi.fn(async () => ({ user: opts.sessionUser ?? null }));
  return { find, findByID, auth } as unknown as Payload;
}

function setup(opts: { sessionUser?: Doc | null; load?: () => Promise<MonLingo> } = {}) {
  const load = vi.fn(opts.load ?? (async () => FALLBACK_MON_LINGO));
  const payload = fakePayload({ sessionUser: 'sessionUser' in opts ? opts.sessionUser : { id: 'c1' } });
  const handle = createMonLingoHandler({
    getPayload: async () => payload,
    reader: createMonLingoReader({ load }),
    serviceKey: SERVICE_KEY,
    corsOrigins: async () => [WEB_ORIGIN],
  });
  return { handle, load };
}

const get = (query = '', headers: Record<string, string> = {}) => new Request(`https://admin.test/v1/mon-lingo${query}`, { method: 'GET', headers });

describe('GET /v1/mon-lingo', () => {
  it('needs a signed-in Caller', async () => {
    const { handle, load } = setup({ sessionUser: null });
    expect((await handle(get())).status).toBe(401);
    expect(load).not.toHaveBeenCalled();
  });

  it('serves the published lingo with a strong ETag and no-cache', async () => {
    const { handle } = setup();
    const res = await handle(get());
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toMatch(/^"[0-9a-f]{64}"$/);
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    const body = (await res.json()) as { ok: boolean; data: unknown };
    expect(body.ok).toBe(true);
    expect(parseMonLingo(body.data)).toEqual(FALLBACK_MON_LINGO);
  });

  it('answers 304 with no body when If-None-Match names the current ETag', async () => {
    const { handle, load } = setup();
    const etag = (await handle(get())).headers.get('etag')!;
    const again = await handle(get('', { 'if-none-match': `W/${etag}` }));
    expect(again.status).toBe(304);
    expect(await again.text()).toBe('');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('lets the MCP server read it with the service key on behalf of a Caller', async () => {
    const { handle } = setup({ sessionUser: null });
    const res = await handle(get('', { [SERVICE_KEY_HEADER]: SERVICE_KEY, [ON_BEHALF_OF_HEADER]: 'c1' }));
    expect(res.status).toBe(200);
  });

  it('refuses a malformed locale with 400', async () => {
    const { handle, load } = setup();
    expect((await handle(get('?locale=../../etc'))).status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });

  it('answers 503 when mon-voices was never seeded, 500 on any other failure', async () => {
    const unseeded = setup({ load: async () => { throw new MonLingoUnavailable('no voices'); } });
    expect((await unseeded.handle(get())).status).toBe(503);
    const broken = setup({ load: async () => { throw new Error('db down'); } });
    expect((await broken.handle(get())).status).toBe(500);
  });

  it('answers a preflight from an allowed origin and exposes the ETag', async () => {
    const { handle } = setup();
    const pre = await handle(new Request('https://admin.test/v1/mon-lingo', { method: 'OPTIONS', headers: { origin: WEB_ORIGIN } }));
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe(WEB_ORIGIN);
    const res = await handle(get('', { origin: WEB_ORIGIN }));
    expect(res.headers.get('access-control-expose-headers')?.toLowerCase()).toContain('etag');
  });

  it('only answers GET and OPTIONS', async () => {
    const { handle } = setup();
    expect((await handle(new Request('https://admin.test/v1/mon-lingo', { method: 'POST' }))).status).toBe(405);
  });
});

describe('reading the lingo from Payload', () => {
  // What migrations 20261028_200000_mon_lingo_seed and 20261029_120000_mon_babble_seed leave in Payload.
  const docs = [...MON_LINGO_SEED_ROWS, ...MON_BABBLE_SEED_ROWS].map((row, i) => ({ id: i + 1, ...row }));
  const seededVoices = () => ({ id: 1, ...MON_VOICES_SEED, stagePitch: { ...MON_VOICES_SEED.stagePitch, egg: MON_EGG_STAGE_PITCH } });

  it('turns the seeded Payload documents into exactly the offline fallback', async () => {
    const find = vi.fn(async () => ({ docs }));
    const findGlobal = vi.fn(async () => seededVoices());
    const lingo = await readMonLingoFromPayload({ find, findGlobal } as unknown as Payload);
    expect(lingo).toEqual(FALLBACK_MON_LINGO);
    const query = find.mock.calls[0] as unknown as [{ where: unknown; draft: boolean }];
    expect(JSON.stringify(query[0].where)).toContain('"published"');
    expect(query[0].draft).toBe(false);
  });

  it('asks Payload for the babble rows and serves them (Decision 32)', async () => {
    const find = vi.fn(async () => ({ docs }));
    const lingo = await readMonLingoFromPayload({ find, findGlobal: vi.fn(async () => seededVoices()) } as unknown as Payload);
    const query = find.mock.calls[0] as unknown as [{ where: unknown }];
    expect(JSON.stringify(query[0].where)).toContain('"babble"');
    expect(lingo.babble).toHaveLength(MON_BABBLE_SEED_ROWS.length);
    expect(new Set(lingo.babble.map((row) => row.kind))).toEqual(new Set(['syllable', 'family-sound', 'egg-sound']));
    expect(lingo.voices.stagePitch.Egg).toBe(MON_EGG_STAGE_PITCH);
  });

  it('serves babble through GET /v1/mon-lingo', async () => {
    const { handle } = setup();
    const body = (await (await handle(get())).json()) as { data: unknown };
    expect(parseMonLingo(body.data)?.babble).toEqual(FALLBACK_MON_LINGO.babble);
    expect(FALLBACK_MON_LINGO.babble.length).toBeGreaterThan(0);
  });

  it('skips a malformed row instead of failing the whole table', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rows = lexiconRowsFromDocs([...docs, { key: 'broken', entryType: 'nope' }]);
    expect(rows).toHaveLength(docs.length);
    expect(errors).toHaveBeenCalledOnce();
    errors.mockRestore();
  });

  it('reports an unseeded mon-voices global as unavailable', () => {
    expect(() => monVoicesFromDoc({ id: 1 })).toThrow(MonLingoUnavailable);
  });

  it('drops the cached tables as soon as a write bumps the generation', async () => {
    let generation = 0;
    const load = vi.fn(async () => FALLBACK_MON_LINGO);
    const reader = createMonLingoReader({ load, generation: () => generation, now: () => 0 });
    const payload = {} as Payload;
    await reader.read(payload);
    await reader.read(payload);
    expect(load).toHaveBeenCalledTimes(1);
    generation += 1;
    await reader.read(payload);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('etagMatches', () => {
  it('matches the tag, its weak form, a list, or *', () => {
    expect(etagMatches('"a"', '"a"')).toBe(true);
    expect(etagMatches('W/"a"', '"a"')).toBe(true);
    expect(etagMatches('"b", "a"', '"a"')).toBe(true);
    expect(etagMatches('*', '"a"')).toBe(true);
    expect(etagMatches('"b"', '"a"')).toBe(false);
    expect(etagMatches(null, '"a"')).toBe(false);
  });
});
