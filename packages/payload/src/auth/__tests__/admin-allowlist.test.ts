import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BasePayload } from 'payload';
import {
  consoleSignInGate,
  hasConsoleAccess,
  isAllowedAdminEmail,
  isConsoleSignIn,
} from '../admin-allowlist.ts';
import { readAuthEnv } from '../env.ts';
import { SURFACE_HEADER } from '../surface.ts';

const OWNER = 'mikefacesny@gmail.com';
const JUDGE = 'judge1@nyc-mon.city';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('readAuthEnv adminAllowedEmails (ADMIN_ALLOWED_EMAILS)', () => {
  it('falls back to the owner default when the variable is unset', () => {
    vi.stubEnv('ADMIN_ALLOWED_EMAILS', '');
    expect(readAuthEnv().adminAllowedEmails).toEqual([OWNER]);
    delete process.env.ADMIN_ALLOWED_EMAILS;
    expect(readAuthEnv().adminAllowedEmails).toEqual([OWNER]);
  });

  it('parses a comma-separated list when set', () => {
    vi.stubEnv('ADMIN_ALLOWED_EMAILS', 'a@example.com, b@example.com ,,');
    expect(readAuthEnv().adminAllowedEmails).toEqual(['a@example.com', 'b@example.com']);
  });
});

describe('isAllowedAdminEmail', () => {
  const allowed = ['owner@example.com', 'dev@example.com'];

  it('admits allowlisted emails, case-insensitive and trimmed', () => {
    expect(isAllowedAdminEmail('owner@example.com', allowed)).toBe(true);
    expect(isAllowedAdminEmail(' Owner@Example.COM ', allowed)).toBe(true);
  });

  it('refuses everyone else, including empty and non-string input', () => {
    expect(isAllowedAdminEmail('other@example.com', allowed)).toBe(false);
    expect(isAllowedAdminEmail('', allowed)).toBe(false);
    expect(isAllowedAdminEmail(undefined, allowed)).toBe(false);
    expect(isAllowedAdminEmail(42, allowed)).toBe(false);
  });

  it('denies every email on an empty list (the env loader never returns one)', () => {
    expect(isAllowedAdminEmail('owner@example.com', [])).toBe(false);
  });

  it('defaults to the loaded allowlist', () => {
    vi.stubEnv('ADMIN_ALLOWED_EMAILS', 'dev@example.com');
    expect(isAllowedAdminEmail('dev@example.com')).toBe(true);
    expect(isAllowedAdminEmail(OWNER)).toBe(false);
    vi.stubEnv('ADMIN_ALLOWED_EMAILS', '');
    // Unset or blank falls back to the owner default.
    expect(isAllowedAdminEmail(OWNER)).toBe(true);
  });
});

describe('hasConsoleAccess', () => {
  it('needs BOTH a staff role and an allowlisted email', () => {
    vi.stubEnv('ADMIN_ALLOWED_EMAILS', 'owner@example.com');
    expect(hasConsoleAccess({ role: 'ops', email: 'owner@example.com' })).toBe(true);
    expect(hasConsoleAccess({ role: 'ops', email: 'other@example.com' })).toBe(false);
    expect(hasConsoleAccess({ role: 'user', email: 'owner@example.com' })).toBe(false);
    expect(hasConsoleAccess(undefined)).toBe(false);
  });
});

describe('isConsoleSignIn', () => {
  it('fires only for /sign-in/email carrying the admin surface header', () => {
    const admin = new Headers({ [SURFACE_HEADER]: 'admin' });
    expect(isConsoleSignIn('/sign-in/email', admin)).toBe(true);
    expect(isConsoleSignIn('/sign-in/email', new Headers())).toBe(false);
    expect(isConsoleSignIn('/sign-in/email', new Headers({ [SURFACE_HEADER]: 'web' }))).toBe(false);
    expect(isConsoleSignIn('/sign-in/email', undefined)).toBe(false);
    expect(isConsoleSignIn('/oauth2/authorize', admin)).toBe(false);
    expect(isConsoleSignIn('/sign-in/passkey', admin)).toBe(false);
  });
});

describe('consoleSignInGate', () => {
  beforeEach(() => {
    // Deterministic list regardless of the developer's local env: the owner
    // is allowed, judge accounts are not.
    vi.stubEnv('ADMIN_ALLOWED_EMAILS', OWNER);
  });

  const consoleCtx = (email: string) => ({
    path: '/sign-in/email',
    headers: new Headers({ [SURFACE_HEADER]: 'admin' }),
    body: { email, password: 'whatever' },
  });

  function payload() {
    return { logger: { warn: vi.fn() } } as unknown as BasePayload;
  }

  async function run(gate: ReturnType<typeof consoleSignInGate>, ctx: unknown) {
    return (gate as unknown as (c: unknown) => Promise<unknown>)(ctx);
  }

  it('lets an allowlisted email through to the shared before-hook', async () => {
    const inner = vi.fn();
    const logger = payload();
    const gate = consoleSignInGate(inner as never, logger);
    await run(gate, consoleCtx(OWNER));
    expect(inner).toHaveBeenCalledOnce();
    expect(logger.logger.warn).not.toHaveBeenCalled();
  });

  it('denies a non-allowlisted email like a wrong password and logs it', async () => {
    const inner = vi.fn();
    const logger = payload();
    const gate = consoleSignInGate(inner as never, logger);
    const denied = await run(gate, consoleCtx(JUDGE)).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(inner).not.toHaveBeenCalled();
    expect(logger.logger.warn).toHaveBeenCalledOnce();
    // Same status and code the endpoint returns for bad credentials: no enumeration.
    expect(denied).toMatchObject({ statusCode: 401, body: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
  });

  it('leaves sign-ins without the admin header — the OAuth linking flow the judges use — untouched', async () => {
    const inner = vi.fn();
    const gate = consoleSignInGate(inner as never, payload());
    await run(gate, { path: '/sign-in/email', headers: new Headers(), body: { email: JUDGE } });
    await run(gate, { path: '/sign-in/email', body: { email: JUDGE } });
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it('leaves every other auth path untouched', async () => {
    const inner = vi.fn();
    const gate = consoleSignInGate(inner as never, payload());
    await run(gate, { path: '/oauth2/authorize', headers: new Headers({ [SURFACE_HEADER]: 'admin' }), body: { email: JUDGE } });
    await run(gate, { path: '/sign-in/passkey', headers: new Headers({ [SURFACE_HEADER]: 'admin' }), body: {} });
    expect(inner).toHaveBeenCalledTimes(2);
  });
});
