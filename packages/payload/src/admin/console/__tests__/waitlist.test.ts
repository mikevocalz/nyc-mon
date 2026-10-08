import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import { WAITLIST_SLUG } from '../../../collections/Waitlist.ts';
import {
  createJoinWaitlistHandler,
  FORWARD_SECRET_HEADER,
  FORWARDED_CLIENT_IP_HEADER,
  hashClientIp,
  rateLimitIdentifier,
  readClientIp,
  resolveClientIp,
  WAITLIST_RATE_KEY_PREFIX,
} from '../waitlist.ts';

type Doc = Record<string, unknown> & { id: number };
type LocalApiCall = (options: Record<string, unknown>) => Promise<unknown>;

const SECRET = 'test-secret';
const NOW = Date.UTC(2026, 9, 7, 14, 30);

/**
 * A Payload stand-in that stores rows per collection in memory and enforces
 * the waitlist's unique email the way Postgres would, so every handler branch
 * runs its real find/create/update round-trip without a database.
 */
function fakePayload() {
  const tables = new Map<string, Doc[]>();
  let nextId = 1;
  const rows = (collection: string): Doc[] => {
    const existing = tables.get(collection);
    if (existing !== undefined) return existing;
    const created: Doc[] = [];
    tables.set(collection, created);
    return created;
  };
  const matches = (doc: Doc, where: unknown): boolean => {
    if (where === undefined) return true;
    return Object.entries(where as Record<string, { equals?: unknown }>).every(
      ([field, condition]) => doc[field] === condition.equals,
    );
  };
  const find = vi.fn<LocalApiCall>(async (args) => ({
    docs: rows(String(args.collection)).filter((doc) => matches(doc, args.where)),
  }));
  const create = vi.fn<LocalApiCall>(async (args) => {
    const collection = String(args.collection);
    const data = args.data as Record<string, unknown>;
    if (collection === WAITLIST_SLUG && rows(collection).some((doc) => doc.email === data.email)) {
      throw new Error('duplicate key value violates unique constraint "waitlist_email_idx"');
    }
    const doc: Doc = { ...data, id: nextId++ };
    rows(collection).push(doc);
    return doc;
  });
  const update = vi.fn<LocalApiCall>(async (args) => {
    const doc = rows(String(args.collection)).find((row) => row.id === args.id);
    if (doc === undefined) throw new Error('not found');
    Object.assign(doc, args.data as Record<string, unknown>);
    return doc;
  });
  const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
  const payload = { find, create, update, logger } as unknown as Payload;
  return { payload, rows, find, create, update, logger };
}

function handlerFor(payload: Payload, maxAttemptsPerHour?: number) {
  return createJoinWaitlistHandler({ payload, ipHashSecret: SECRET, nowMs: () => NOW, maxAttemptsPerHour });
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://admin.test/v1/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7, 10.0.0.1', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const adult = { email: '  Kid.Grown@Example.COM ', ageConfirmed: true, district: 'harlem', source: 'get' };

describe('handleJoinWaitlist', () => {
  it('stores a new sign-up lowercased and trimmed and answers joined', async () => {
    const { payload, rows } = fakePayload();
    const response = await handlerFor(payload)(post(adult));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'joined' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const stored = rows(WAITLIST_SLUG);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ email: 'kid.grown@example.com', district: 'harlem', source: 'get' });
  });

  it('answers a repeat email with the identical body and writes no second row', async () => {
    const { payload, rows } = fakePayload();
    const handler = handlerFor(payload);
    const first = await handler(post(adult));
    const second = await handler(post({ ...adult, email: 'kid.grown@example.com' }));

    expect(second.status).toBe(first.status);
    expect(await second.text()).toBe(await first.text());
    expect(rows(WAITLIST_SLUG)).toHaveLength(1);
  });

  it('answers joined when a concurrent sign-up wins the unique index', async () => {
    const { payload, rows, find } = fakePayload();
    // The pre-check misses; by the time create runs, another request stored it.
    rows(WAITLIST_SLUG).push({ id: 99, email: 'kid.grown@example.com' });
    find.mockImplementationOnce(async () => ({ docs: [] })); // limiter lookup
    find.mockImplementationOnce(async () => ({ docs: [] })); // email pre-check

    const response = await handlerFor(payload)(post(adult));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'joined' });
    expect(rows(WAITLIST_SLUG)).toHaveLength(1);
  });

  it('silently drops a filled honeypot: joined, nothing stored', async () => {
    const { payload, rows, create } = fakePayload();
    const response = await handlerFor(payload)(post({ ...adult, website: 'https://spam.example' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'joined' });
    expect(rows(WAITLIST_SLUG)).toHaveLength(0);
    expect(create.mock.calls.some((call) => call[0]?.collection === WAITLIST_SLUG)).toBe(false);
  });

  it('treats an empty honeypot as a person', async () => {
    const { payload, rows } = fakePayload();
    const response = await handlerFor(payload)(post({ ...adult, website: '' }));

    expect(response.status).toBe(200);
    expect(rows(WAITLIST_SLUG)).toHaveLength(1);
  });

  it('answers under13 with 422 and never looks up or stores the address', async () => {
    const { payload, rows, find, create } = fakePayload();
    const response = await handlerFor(payload)(post({ ...adult, ageConfirmed: false }));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ status: 'under13' });
    expect(rows(WAITLIST_SLUG)).toHaveLength(0);
    const touched = [...find.mock.calls, ...create.mock.calls].map((call) => call[0]?.collection);
    expect(touched).not.toContain(WAITLIST_SLUG);
    // The only thing written is the limiter counter, which holds no address.
    const written = JSON.stringify(create.mock.calls);
    expect(written).not.toContain('example.com');
  });

  it.each(['not-an-email', 'a@b', 'two@@example.com', 'sp ace@example.com', `${'x'.repeat(250)}@example.com`, ''])(
    'answers invalid with field email for %j',
    async (email) => {
      const { payload, rows } = fakePayload();
      const response = await handlerFor(payload)(post({ ...adult, email }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ status: 'invalid', field: 'email' });
      expect(rows(WAITLIST_SLUG)).toHaveLength(0);
    },
  );

  it('answers invalid for a body that is not JSON', async () => {
    const { payload } = fakePayload();
    const response = await handlerFor(payload)(post('{"email":'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: 'invalid' });
  });

  it.each([
    ['an array', []],
    ['a missing ageConfirmed', { email: 'a@example.com' }],
    ['a string ageConfirmed', { email: 'a@example.com', ageConfirmed: 'yes' }],
    ['an unknown district', { email: 'a@example.com', ageConfirmed: true, district: 'queens' }],
    ['an oversized source', { email: 'a@example.com', ageConfirmed: true, source: 'x'.repeat(33) }],
    ['a source with markup', { email: 'a@example.com', ageConfirmed: true, source: '<b>' }],
  ])('answers invalid for %s', async (_label, body) => {
    const { payload, rows } = fakePayload();
    const response = await handlerFor(payload)(post(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: 'invalid' });
    expect(rows(WAITLIST_SLUG)).toHaveLength(0);
  });

  it('rate-limits an IP over its hourly budget and stores only a hashed key', async () => {
    const { payload, rows } = fakePayload();
    const handler = handlerFor(payload, 2);

    expect((await handler(post({ ...adult, email: 'one@example.com' }))).status).toBe(200);
    expect((await handler(post({ ...adult, email: 'two@example.com' }))).status).toBe(200);
    const limited = await handler(post({ ...adult, email: 'three@example.com' }));

    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ status: 'rate_limited' });
    expect(rows(WAITLIST_SLUG)).toHaveLength(2);

    const counters = rows('verifications');
    expect(counters).toHaveLength(1);
    expect(counters[0]?.value).toBe('2');
    expect(String(counters[0]?.identifier)).toBe(rateLimitIdentifier(hashClientIp('203.0.113.7', SECRET), NOW));
    expect(JSON.stringify(counters)).not.toContain('203.0.113.7');
  });

  it('keeps a separate budget per client IP', async () => {
    const { payload } = fakePayload();
    const handler = handlerFor(payload, 1);

    expect((await handler(post({ ...adult, email: 'one@example.com' }))).status).toBe(200);
    const other = await handler(post({ ...adult, email: 'two@example.com' }, { 'x-forwarded-for': '198.51.100.4' }));
    expect(other.status).toBe(200);
  });

  it('answers 500 with no details when the store fails, and logs server-side', async () => {
    const { payload, create, logger } = fakePayload();
    create.mockImplementation(async (args) => {
      if (args.collection === WAITLIST_SLUG) throw new Error('connection refused at 10.0.0.5:5432');
      return { id: 1 };
    });

    const response = await handlerFor(payload)(post(adult));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ status: 'error' });
    expect(text).not.toContain('connection');
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('answers 500 when no IP hash secret is configured', async () => {
    const { payload } = fakePayload();
    const handler = createJoinWaitlistHandler({ payload, ipHashSecret: '', nowMs: () => NOW });
    const response = await handler(post(adult));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: 'error' });
  });
});

describe('readClientIp', () => {
  it('takes the first X-Forwarded-For hop', () => {
    expect(readClientIp(new Headers({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' }))).toBe('203.0.113.7');
  });

  it('falls back to X-Real-IP, then to one shared bucket', () => {
    expect(readClientIp(new Headers({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
    expect(readClientIp(new Headers())).toBe('unknown');
  });
});

describe('rateLimitIdentifier', () => {
  it('names the UTC hour window', () => {
    expect(rateLimitIdentifier('abc', NOW)).toBe(`${WAITLIST_RATE_KEY_PREFIX}:abc:2026-10-07T14`);
  });
});

describe('trusted forwarding from apps/web', () => {
  const FORWARD = 'forward-secret-123';
  const fromWeb = (secret: string | undefined) => ({
    'x-forwarded-for': '10.1.1.1', // the web server's egress, as admin-vite's edge sees it
    [FORWARDED_CLIENT_IP_HEADER]: '203.0.113.50',
    ...(secret === undefined ? {} : { [FORWARD_SECRET_HEADER]: secret }),
  });

  async function keyedIp(forwardSecret: string | undefined, sent: string | undefined): Promise<string> {
    const { payload, rows } = fakePayload();
    const handler = createJoinWaitlistHandler({ payload, ipHashSecret: SECRET, nowMs: () => NOW, forwardSecret });
    expect((await handler(post(adult, fromWeb(sent)))).status).toBe(200);
    return String(rows('verifications')[0]?.identifier);
  }
  const keyFor = (ip: string) => rateLimitIdentifier(hashClientIp(ip, SECRET), NOW);

  it('keys on x-nycmon-client-ip when the forward secret matches', async () => {
    expect(await keyedIp(FORWARD, FORWARD)).toBe(keyFor('203.0.113.50'));
  });

  it('ignores the vouched IP when the secret is wrong', async () => {
    expect(await keyedIp(FORWARD, 'forward-secret-124')).toBe(keyFor('10.1.1.1'));
    expect(await keyedIp(FORWARD, 'x')).toBe(keyFor('10.1.1.1'));
  });

  it('ignores the vouched IP when no secret header is sent', async () => {
    expect(await keyedIp(FORWARD, undefined)).toBe(keyFor('10.1.1.1'));
  });

  it('never trusts the header when WAITLIST_FORWARD_SECRET is unset', async () => {
    const saved = process.env.WAITLIST_FORWARD_SECRET;
    delete process.env.WAITLIST_FORWARD_SECRET;
    try {
      expect(await keyedIp(undefined, '')).toBe(keyFor('10.1.1.1'));
      expect(await keyedIp(undefined, FORWARD)).toBe(keyFor('10.1.1.1'));
      expect(await keyedIp('', '')).toBe(keyFor('10.1.1.1'));
    } finally {
      if (saved !== undefined) process.env.WAITLIST_FORWARD_SECRET = saved;
    }
  });

  it('reads WAITLIST_FORWARD_SECRET from the environment by default', async () => {
    const saved = process.env.WAITLIST_FORWARD_SECRET;
    process.env.WAITLIST_FORWARD_SECRET = FORWARD;
    try {
      expect(await keyedIp(undefined, FORWARD)).toBe(keyFor('203.0.113.50'));
    } finally {
      if (saved === undefined) delete process.env.WAITLIST_FORWARD_SECRET;
      else process.env.WAITLIST_FORWARD_SECRET = saved;
    }
  });

  it('falls back to the edge peer when the vouched IP is blank', () => {
    const headers = new Headers({ ...fromWeb(FORWARD), [FORWARDED_CLIENT_IP_HEADER]: ' ' });
    expect(resolveClientIp(headers, FORWARD)).toBe('10.1.1.1');
  });
});
