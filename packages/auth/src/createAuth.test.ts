// deleteAccount against a stubbed fetch: the request Better Auth's client
// sends, and how each reply folds into an AuthResult. No server runs.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createAuth } from './createAuth.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

interface Seen {
  url: string;
  method: string;
  body: string;
}

function stubFetch(status: number, body: unknown): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    seen.push({ url: request.url, method: request.method, body: await request.text() });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return seen;
}

test('deleteAccount posts to /delete-user under the Payload auth base path', async () => {
  const seen = stubFetch(200, { success: true, message: 'User deleted' });
  const result = await createAuth({ baseURL: 'https://admin.example' }).deleteAccount();
  assert.deepEqual(result, { ok: true });
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.method, 'POST');
  assert.equal(seen[0]?.url, 'https://admin.example/payload-api/auth/delete-user');
  // No password and no callback: the confirm step is in the app, and there is no email step.
  assert.deepEqual(JSON.parse(seen[0]?.body ?? 'null'), {});
});

test('a stale session comes back as SESSION_EXPIRED, not thrown', async () => {
  stubFetch(400, { code: 'SESSION_EXPIRED', message: 'Session expired. Re-authenticate to perform this action.' });
  const result = await createAuth({ baseURL: 'https://admin.example' }).deleteAccount();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'SESSION_EXPIRED');
  assert.equal(result.error.status, 400);
});

test('deletion turned off on the server reads as a 404 failure', async () => {
  stubFetch(404, {});
  const result = await createAuth({ baseURL: 'https://admin.example' }).deleteAccount();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.status, 404);
});
