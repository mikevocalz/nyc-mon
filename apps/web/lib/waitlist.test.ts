import assert from 'node:assert/strict';
import test from 'node:test';
import { joinWaitlist, mapWaitlistResponse, toWaitlistDistrict } from './waitlist.ts';
import type { WaitlistInput } from './waitlist.ts';

const URL_BASE = 'https://admin.test/';
const input: WaitlistInput = { email: 'a@example.com', ageConfirmed: true, district: 'harlem', source: 'get', clientIp: '203.0.113.7' };

type Call = { url: string; init: RequestInit };

function respond(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

// Keep the expected failure logs out of the test output.
console.error = () => {};

test('joined: posts the form to ADMIN_API_URL/v1/waitlist with the vouched visitor IP', async () => {
  const { fetchImpl, calls } = respond(200, { status: 'joined' });
  const result = await joinWaitlist(input, { adminApiUrl: URL_BASE, fetchImpl, forwardSecret: 'fwd' });

  assert.deepEqual(result, { status: 'joined' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://admin.test/v1/waitlist');
  assert.equal(calls[0]?.init.method, 'POST');
  const sent = new Headers(calls[0]?.init.headers);
  assert.equal(sent.get('x-nycmon-client-ip'), '203.0.113.7');
  assert.equal(sent.get('x-nycmon-forward-secret'), 'fwd');
  assert.equal(sent.get('x-forwarded-for'), null);
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    email: 'a@example.com',
    ageConfirmed: true,
    district: 'harlem',
    source: 'get',
  });
  assert.ok(calls[0]?.init.signal instanceof AbortSignal);
});

test('reads ADMIN_API_URL from the environment per call', async () => {
  const { fetchImpl, calls } = respond(200, { status: 'joined' });
  process.env.ADMIN_API_URL = 'https://env.test';
  try {
    assert.deepEqual(await joinWaitlist(input, { fetchImpl }), { status: 'joined' });
    assert.equal(calls[0]?.url, 'https://env.test/v1/waitlist');
  } finally {
    delete process.env.ADMIN_API_URL;
  }
});

test('missing ADMIN_API_URL is an error and sends nothing', async () => {
  const { fetchImpl, calls } = respond(200, { status: 'joined' });
  delete process.env.ADMIN_API_URL;
  assert.deepEqual(await joinWaitlist(input, { fetchImpl }), { status: 'error' });
  assert.equal(calls.length, 0);
});

const cases: [string, number, unknown, unknown][] = [
  ['under13', 422, { status: 'under13' }, { status: 'under13' }],
  ['invalid email', 400, { status: 'invalid', field: 'email' }, { status: 'invalid', field: 'email' }],
  ['invalid shape', 400, { status: 'invalid' }, { status: 'invalid' }],
  ['rate limited', 429, { status: 'rate_limited' }, { status: 'rate_limited' }],
  ['rate limited without a JSON body', 429, 'Too Many Requests', { status: 'rate_limited' }],
  ['server error', 500, { status: 'error' }, { status: 'error' }],
  ['proxy HTML page', 502, '<html>Bad gateway</html>', { status: 'error' }],
  ['200 whose body disagrees', 200, { status: 'under13' }, { status: 'error' }],
  ['200 with no body', 200, '', { status: 'error' }],
];

for (const [label, status, body, expected] of cases) {
  test(`maps ${label}`, async () => {
    const { fetchImpl } = respond(status, body);
    assert.deepEqual(await joinWaitlist(input, { adminApiUrl: URL_BASE, fetchImpl }), expected);
  });
}

test('a network failure is an error', async () => {
  const fetchImpl = (async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
  assert.deepEqual(await joinWaitlist(input, { adminApiUrl: URL_BASE, fetchImpl }), { status: 'error' });
});

test('a request past the timeout is aborted and is an error', async () => {
  let aborted = false;
  const fetchImpl = ((_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        aborted = true;
        reject(init.signal?.reason);
      });
    })) as unknown as typeof fetch;
  const started = Date.now();
  const result = await joinWaitlist(input, { adminApiUrl: URL_BASE, fetchImpl, timeoutMs: 30 });

  assert.deepEqual(result, { status: 'error' });
  assert.equal(aborted, true);
  assert.ok(Date.now() - started < 2000);
});

test('mapWaitlistResponse ignores an unknown field value', () => {
  assert.deepEqual(mapWaitlistResponse(400, { status: 'invalid', field: 'district' }), { status: 'invalid' });
});

test('toWaitlistDistrict narrows form values', () => {
  assert.equal(toWaitlistDistrict('midtown'), 'midtown');
  assert.equal(toWaitlistDistrict('queens'), undefined);
  assert.equal(toWaitlistDistrict(''), undefined);
});

test('without WAITLIST_FORWARD_SECRET it still posts, but sends neither forwarding header', async () => {
  const { fetchImpl, calls } = respond(200, { status: 'joined' });
  const saved = process.env.WAITLIST_FORWARD_SECRET;
  delete process.env.WAITLIST_FORWARD_SECRET;
  try {
    assert.deepEqual(await joinWaitlist(input, { adminApiUrl: URL_BASE, fetchImpl }), { status: 'joined' });
    const sent = new Headers(calls[0]?.init.headers);
    assert.equal(sent.get('x-nycmon-client-ip'), null);
    assert.equal(sent.get('x-nycmon-forward-secret'), null);
  } finally {
    if (saved !== undefined) process.env.WAITLIST_FORWARD_SECRET = saved;
  }
});

test('reads WAITLIST_FORWARD_SECRET from the environment per call', async () => {
  const { fetchImpl, calls } = respond(200, { status: 'joined' });
  const saved = process.env.WAITLIST_FORWARD_SECRET;
  process.env.WAITLIST_FORWARD_SECRET = 'env-fwd';
  try {
    await joinWaitlist(input, { adminApiUrl: URL_BASE, fetchImpl });
    const sent = new Headers(calls[0]?.init.headers);
    assert.equal(sent.get('x-nycmon-forward-secret'), 'env-fwd');
    assert.equal(sent.get('x-nycmon-client-ip'), '203.0.113.7');
  } finally {
    if (saved === undefined) delete process.env.WAITLIST_FORWARD_SECRET;
    else process.env.WAITLIST_FORWARD_SECRET = saved;
  }
});

test('sends no forwarding headers when the visitor IP is unknown', async () => {
  const { fetchImpl, calls } = respond(200, { status: 'joined' });
  await joinWaitlist({ ...input, clientIp: undefined }, { adminApiUrl: URL_BASE, fetchImpl, forwardSecret: 'fwd' });
  const sent = new Headers(calls[0]?.init.headers);
  assert.equal(sent.get('x-nycmon-client-ip'), null);
  assert.equal(sent.get('x-nycmon-forward-secret'), null);
});
