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

test('listAccounts GETs /list-accounts and keeps provider ids', async () => {
  const seen = stubFetch(200, [
    { id: 1, providerId: 'credential', accountId: '1', createdAt: '2026-10-01T00:00:00.000Z' },
    { id: 2, providerId: 'apple', accountId: 'x' },
    { id: 3 },
  ]);
  const result = await createAuth({ baseURL: 'https://admin.example' }).listAccounts();
  assert.equal(seen[0]?.method, 'GET');
  assert.equal(seen[0]?.url, 'https://admin.example/payload-api/auth/list-accounts');
  assert.deepEqual(result, {
    ok: true,
    data: [
      { id: '1', providerId: 'credential', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: '2', providerId: 'apple', createdAt: undefined },
    ],
  });
});

test('listAccounts without a session is a 401 failure, not thrown', async () => {
  stubFetch(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });
  const result = await createAuth({ baseURL: 'https://admin.example' }).listAccounts();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.status, 401);
});

test('changeEmail posts the new address to /change-email', async () => {
  const seen = stubFetch(200, { status: true });
  const result = await createAuth({ baseURL: 'https://admin.example' }).changeEmail('new@example.com');
  assert.deepEqual(result, { ok: true });
  assert.equal(seen[0]?.url, 'https://admin.example/payload-api/auth/change-email');
  assert.deepEqual(JSON.parse(seen[0]?.body ?? 'null'), { newEmail: 'new@example.com' });
});

test('changePassword posts both passwords and signs other devices out', async () => {
  const seen = stubFetch(200, { token: null });
  const result = await createAuth({ baseURL: 'https://admin.example' }).changePassword('old-password-1', 'new-password-1');
  assert.deepEqual(result, { ok: true });
  assert.equal(seen[0]?.url, 'https://admin.example/payload-api/auth/change-password');
  assert.deepEqual(JSON.parse(seen[0]?.body ?? 'null'), {
    currentPassword: 'old-password-1',
    newPassword: 'new-password-1',
    revokeOtherSessions: true,
  });
});

test('a wrong current password comes back as INVALID_PASSWORD', async () => {
  stubFetch(400, { code: 'INVALID_PASSWORD', message: 'Invalid password' });
  const result = await createAuth({ baseURL: 'https://admin.example' }).changePassword('nope-nope-1', 'new-password-1');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'INVALID_PASSWORD');
});

test('id-token sign-in posts the Apple token and the M04 birth year to /sign-in/social', async () => {
  const seen = stubFetch(200, { redirect: false, token: 't', user: { id: '1' } });
  const result = await createAuth({ baseURL: 'https://admin.example' }).signIn({
    method: 'id-token',
    provider: 'apple',
    token: 'header.payload.sig',
    nonce: 'raw-nonce',
    name: { firstName: 'Dani' },
    birthYear: 2008,
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(seen[0]?.url, 'https://admin.example/payload-api/auth/sign-in/social');
  assert.deepEqual(JSON.parse(seen[0]?.body ?? 'null'), {
    provider: 'apple',
    idToken: { token: 'header.payload.sig', nonce: 'raw-nonce', user: { name: { firstName: 'Dani' } } },
    additionalData: { birthYear: 2008 },
  });
});

test('a returning Caller signs in by id token without a birth year', async () => {
  const seen = stubFetch(200, { redirect: false, token: 't', user: { id: '1' } });
  await createAuth({ baseURL: 'https://admin.example' }).signIn({ method: 'id-token', provider: 'google', token: 'g' });
  assert.deepEqual(JSON.parse(seen[0]?.body ?? 'null'), { provider: 'google', idToken: { token: 'g' } });
});

test('a new social account without the M04 answer comes back as BIRTH_YEAR_REQUIRED', async () => {
  stubFetch(403, { code: 'BIRTH_YEAR_REQUIRED', message: 'Answer the birth-year question before making an account.' });
  const result = await createAuth({ baseURL: 'https://admin.example' }).signIn({ method: 'id-token', provider: 'apple', token: 'a' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'BIRTH_YEAR_REQUIRED');
});
