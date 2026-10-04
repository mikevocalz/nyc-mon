// Better Auth options for NYC-MON (ADR 0001). Shared by the collection
// generator (schema) and createAuth (runtime), so both see the same plugins
// and additional fields.
import { passkey } from '@better-auth/passkey';
import type { BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { waitUntil } from '@vercel/functions';
import { needsGuardianConsent, parseBirthYear } from './age';
import { createAuthMailer } from './email';
import { readAuthEnv } from './env';

/** Payload serves REST at `routes.api`; the plugin mounts Better Auth under it. */
export const PAYLOAD_API_ROUTE = '/payload-api';
export const AUTH_BASE_PATH = '/auth';

const env = readAuthEnv();
const sendMail = createAuthMailer(env);

// Lockout guard (ADR 0001): requireEmailVerification with no working sender
// refuses every unverified sign-in forever. Fail the boot instead.
if (env.requireEmailVerification && sendMail === undefined) {
  throw new Error(
    'AUTH_REQUIRE_EMAIL_VERIFICATION=true needs RESEND_API_KEY and AUTH_EMAIL_FROM. ' +
      'Without a sender, every new account would be locked out.',
  );
}

function runInBackground(promise: Promise<unknown>): void {
  const settled = promise.then(
    () => undefined,
    (error: unknown) => {
      console.error('[auth] background task failed', error);
    },
  );
  // Keeps the Vercel Function alive until the mail is sent, without making the
  // response wait for it. Outside Vercel (local dev, scripts) waitUntil has no
  // request context and does nothing; the promise still settles on its own.
  waitUntil(settled);
}

const socialProviders: NonNullable<BetterAuthOptions['socialProviders']> = {};
if (env.google !== undefined) {
  socialProviders.google = env.google;
}
if (env.apple !== undefined) {
  socialProviders.apple = env.apple;
}

const baseOrigin = new URL(env.baseURL);

/**
 * Origins Payload accepts for CORS and CSRF: the admin/API host itself, the
 * product site (apps/web reads published content over REST), and the extra
 * Better Auth origins. docs/adr/0003-admin-app-split.md.
 */
export const PAYLOAD_ORIGINS: string[] = [
  ...new Set(
    [baseOrigin.origin, env.siteURL, ...env.trustedOrigins]
      .filter((origin): origin is string => origin !== undefined)
      .filter((origin) => /^https?:\/\//.test(origin))
      .map((origin) => new URL(origin).origin),
  ),
];

export const betterAuthOptions = {
  appName: 'NYC-MON',
  baseURL: env.baseURL,
  basePath: `${PAYLOAD_API_ROUTE}${AUTH_BASE_PATH}`,
  secret: env.secret,
  trustedOrigins: [baseOrigin.origin, ...env.trustedOrigins],
  advanced: {
    database: { generateId: 'serial' },
    backgroundTasks: { handler: runInBackground },
  },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'user', input: false },
      // Optional at the auth layer because Apple and Google sign-ups do not
      // carry it; /v1 handlers refuse a Caller without one.
      birthYear: { type: 'number', required: false, input: true },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    requireEmailVerification: env.requireEmailVerification,
    ...(sendMail === undefined
      ? {}
      : {
          sendResetPassword: async ({ user, url }) => {
            await sendMail({
              to: user.email,
              subject: 'Reset your NYC-MON password',
              text: `Use this link to set a new password. It expires in one hour.\n\n${url}`,
            });
          },
        }),
  },
  ...(sendMail === undefined
    ? {}
    : {
        emailVerification: {
          // Explicit: sendOnSignIn has no default (it reads as false), and
          // without it an account that signed up while mail was down never
          // gets another link.
          sendOnSignIn: true,
          sendOnSignUp: true,
          sendVerificationEmail: async ({ user, url }) => {
            await sendMail({
              to: user.email,
              subject: 'Confirm your NYC-MON email',
              text: `Confirm this address to finish setting up your account.\n\n${url}`,
            });
          },
        },
      }),
  socialProviders,
  plugins: [
    passkey({
      rpID: baseOrigin.hostname,
      rpName: 'NYC-MON',
      origin: baseOrigin.origin,
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const currentYear = new Date().getUTCFullYear();
          if (user.birthYear === undefined || user.birthYear === null) return;
          const birthYear = parseBirthYear(user.birthYear, currentYear);
          if (birthYear === undefined) {
            throw APIError.from('BAD_REQUEST', {
              code: 'INVALID_BIRTH_YEAR',
              message: 'Birth year is not valid.',
            });
          }
          // Under-13 Callers never get an account directly: the guardian
          // consent flow creates it after approval (ADR 0001, §1.5).
          if (needsGuardianConsent(birthYear, currentYear)) {
            throw APIError.from('FORBIDDEN', {
              code: 'GUARDIAN_CONSENT_REQUIRED',
              message: 'A parent or guardian needs to approve this account first.',
            });
          }
        },
      },
    },
  },
} satisfies BetterAuthOptions;
