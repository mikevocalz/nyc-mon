import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BasePayload } from 'payload';
import { appSignInAttempt, appSignInGate, APP_SURFACE, isAllowedAppEmail, isAppSignIn } from '../app-allowlist.ts';
import { readAuthEnv } from '../env.ts';
import { SURFACE_HEADER } from '../surface.ts';

const OWNER = 'mikefacesny@gmail.com';
const JUDGE = 'judge1@nyc-mon.city';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('readAuthEnv appAllowedEmails (APP_ALLOWED_EMAILS)', () => {
  it('falls back to the owner default when the variable is unset or blank', () => {
    vi.stubEnv('APP_ALLOWED_EMAILS', '');
    expect(readAuthEnv().appAllowedEmails).toEqual([OWNER]);
    delete process.env.APP_ALLOWED_EMAILS;
    expect(readAuthEnv().appAllowedEmails).toEqual([OWNER]);
  });

  it('parses a comma-separated list when set', () => {
    vi.stubEnv('APP_ALLOWED_EMAILS', 'a@example.com, b@example.com ,,');
    expect(readAuthEnv().appAllowedEmails).toEqual(['a@example.com', 'b@example.com']);
  });
});

describe('isAllowedAppEmail', () => {
  it('admits allowlisted emails case-insensitively and refuses the rest', () => {
    const allowed = ['owner@example.com'];
    expect(isAllowedAppEmail(' Owner@Example.COM ', allowed)).toBe(true);
    expect(isAllowedAppEmail('other@example.com', allowed)).toBe(false);
    expect(isAllowedAppEmail('', allowed)).toBe(false);
    expect(isAllowedAppEmail(undefined, allowed)).toBe(false);
    expect(isAllowedAppEmail('owner@example.com', [])).toBe(false);
  });
});

describe('isAppSignIn', () => {
  it('fires only on the app surface marker, never on real surface labels', () => {
    expect(isAppSignIn(new Headers({ [SURFACE_HEADER]: APP_SURFACE }))).toBe(true);
    expect(isAppSignIn(new Headers({ [SURFACE_HEADER]: 'admin' }))).toBe(false);
    expect(isAppSignIn(new Headers({ [SURFACE_HEADER]: 'web' }))).toBe(false);
    expect(isAppSignIn(new Headers())).toBe(false);
    expect(isAppSignIn(undefined)).toBe(false);
  });
});

describe('appSignInAttempt', () => {
  it('recognises a marked request and ignores unmarked ones', async () => {
    expect(await appSignInAttempt({ headers: new Headers({ [SURFACE_HEADER]: APP_SURFACE }) })).toBe(true);
    // No header and no OAuth state outside a provider callback: not an app attempt.
    expect(await appSignInAttempt({ headers: new Headers() })).toBe(false);
    expect(await appSignInAttempt(undefined)).toBe(false);
    expect(await appSignInAttempt(null)).toBe(false);
  });
});

describe('appSignInGate', () => {
  beforeEach(() => {
    // Deterministic list regardless of the developer's local env.
    vi.stubEnv('APP_ALLOWED_EMAILS', OWNER);
  });

  const markedCtx = (path: string, email: string) => ({
    path,
    headers: new Headers({ [SURFACE_HEADER]: APP_SURFACE }),
    body: { email, password: 'whatever' },
  });

  function payload() {
    return { logger: { warn: vi.fn() } } as unknown as BasePayload;
  }

  async function run(gate: ReturnType<typeof appSignInGate>, ctx: unknown) {
    return (gate as unknown as (c: unknown) => Promise<unknown>)(ctx);
  }

  it('lets an allowlisted email sign in and sign up', async () => {
    const inner = vi.fn();
    const logger = payload();
    const gate = appSignInGate(inner as never, logger);
    await run(gate, markedCtx('/sign-in/email', OWNER));
    await run(gate, markedCtx('/sign-up/email', OWNER));
    expect(inner).toHaveBeenCalledTimes(2);
    expect(logger.logger.warn).not.toHaveBeenCalled();
  });

  it('denies a non-allowlisted email like a wrong password and logs it', async () => {
    const inner = vi.fn();
    const logger = payload();
    const gate = appSignInGate(inner as never, logger);
    const denied = await run(gate, markedCtx('/sign-in/email', JUDGE)).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(inner).not.toHaveBeenCalled();
    expect(logger.logger.warn).toHaveBeenCalledOnce();
    expect(denied).toMatchObject({ statusCode: 401, body: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
  });

  it('denies a non-allowlisted sign-up the same way', async () => {
    const inner = vi.fn();
    const gate = appSignInGate(inner as never, payload());
    const denied = await run(gate, markedCtx('/sign-up/email', JUDGE)).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(inner).not.toHaveBeenCalled();
    expect(denied).toMatchObject({ statusCode: 401, body: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
  });

  it('leaves headerless requests — the OAuth linking flow the judges use — untouched', async () => {
    const inner = vi.fn();
    const gate = appSignInGate(inner as never, payload());
    await run(gate, { path: '/sign-in/email', headers: new Headers(), body: { email: JUDGE } });
    await run(gate, { path: '/sign-in/email', body: { email: JUDGE } });
    await run(gate, { path: '/sign-up/email', body: { email: JUDGE } });
    expect(inner).toHaveBeenCalledTimes(3);
  });

  it('passes marked passkey and social calls to the shared hook (the session hook gates them at creation)', async () => {
    const inner = vi.fn();
    const gate = appSignInGate(inner as never, payload());
    await run(gate, { path: '/sign-in/passkey', headers: new Headers({ [SURFACE_HEADER]: APP_SURFACE }), body: {} });
    await run(gate, { path: '/sign-in/social', headers: new Headers({ [SURFACE_HEADER]: APP_SURFACE }), body: { provider: 'google' } });
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it('leaves the console marker and every other path untouched', async () => {
    const inner = vi.fn();
    const gate = appSignInGate(inner as never, payload());
    await run(gate, { path: '/sign-in/email', headers: new Headers({ [SURFACE_HEADER]: 'admin' }), body: { email: JUDGE } });
    await run(gate, { path: '/oauth2/authorize', headers: new Headers({ [SURFACE_HEADER]: APP_SURFACE }), body: {} });
    expect(inner).toHaveBeenCalledTimes(2);
  });
});
