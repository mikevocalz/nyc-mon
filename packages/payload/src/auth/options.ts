// Better Auth options for NYC-MON (ADR 0001, ADR 0004). Shared by the
// collection generator (schema) and createAuth (runtime), so both see the same
// plugins and additional fields. Plugins that need the live Payload instance
// and add no schema (account merge) are added in payload.config.ts.
import { passkey } from '@better-auth/passkey';
import { isConsentRequired } from '@acme/core/sim';
import type { BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { bearer } from 'better-auth/plugins/bearer';
import { deviceAuthorization } from 'better-auth/plugins/device-authorization';
import { oneTimeToken } from 'better-auth/plugins/one-time-token';
import { phoneNumber } from 'better-auth/plugins/phone-number';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { username } from 'better-auth/plugins/username';
import { waitUntil } from '@vercel/functions';
import { parseBirthYear } from './age';
import { createAuthMailer } from './email';
import { readAuthEnv } from './env';
import { isAllowedSmsNumber, parseSmsCountries, passesPhoneGate } from './phone';
import { assertFreshSession } from './plugins/fresh';
import { handoff, hashHandoffToken } from './plugins/handoff';
import { createSmsSender } from './sms';
import { consumeSmsQuota, MAX_SMS_PER_NUMBER_PER_DAY, MAX_SMS_PER_USER_PER_DAY } from './sms-quota';
import { isSurface, SURFACE_HEADER, type Surface, surfaceForClientId, surfaceLabel } from './surface';
import {
  changeEmailMail,
  newSurfaceMail,
  resetPasswordMail,
  signInMethodAddedMail,
  signInMethodRemovedMail,
  twoFactorCodeMail,
  verifyEmailMail,
} from './templates';
import { isValidUsername, MAX_USERNAME_LENGTH, MIN_USERNAME_LENGTH } from './username';

/** Payload serves REST at `routes.api`; the plugin mounts Better Auth under it. */
export const PAYLOAD_API_ROUTE = '/payload-api';
export const AUTH_BASE_PATH = '/auth';

const env = readAuthEnv();
export const sendMail = createAuthMailer(env);
const smsSender = createSmsSender(env);
const smsCountries = parseSmsCountries(env.sms?.allowedCountries);

/** Minutes a 2FA one-time code stays valid. */
const TWO_FACTOR_OTP_MINUTES = 5;

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

/** Security notices (ADR 0004 §5). Without Resend they are skipped, and the skip is logged. */
function sendNotice(to: string | undefined, mail: ReturnType<typeof newSurfaceMail>): void {
  if (to === undefined || to === '') return;
  if (sendMail === undefined) {
    console.warn(`[auth] notice "${mail.subject}" skipped: no mail sender`);
    return;
  }
  runInBackground(sendMail({ to, ...mail }));
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

function readField(record: unknown, field: string): unknown {
  return typeof record === 'object' && record !== null && field in record ? (record as Record<string, unknown>)[field] : undefined;
}

function phoneNotAllowed(): APIError {
  return APIError.from('FORBIDDEN', {
    code: 'PHONE_NOT_ALLOWED',
    message: 'Phone numbers are not available on this account.',
  });
}

function requestedSurface(headers: Headers | undefined): Surface {
  const raw = headers?.get(SURFACE_HEADER) ?? undefined;
  // A header can never claim the staff console; that label is set server-side only.
  return isSurface(raw) && raw !== 'admin' ? raw : 'web';
}

/**
 * Sends a 2FA one-time code on the Caller's chosen channel. SMS only when
 * chosen, verified, allowed by the phone gate and configured here; otherwise
 * email. Under-13 accounts carry the guardian's address (DECISIONS #17).
 */
async function sendTwoFactorCode(
  user: Record<string, unknown>,
  code: string,
  store: Parameters<typeof consumeSmsQuota>[0] | undefined,
): Promise<void> {
  const phone = readField(user, 'phoneNumber');
  const wantsSms =
    readField(user, 'twoFactorOtpChannel') === 'sms' &&
    readField(user, 'phoneNumberVerified') === true &&
    typeof phone === 'string' &&
    isAllowedSmsNumber(phone, smsCountries) &&
    passesPhoneGate(user, Date.now());
  if (wantsSms && smsSender !== undefined) {
    if (store !== undefined) {
      await consumeSmsQuota(store, `user:${String(readField(user, 'id'))}`, MAX_SMS_PER_USER_PER_DAY);
    }
    await smsSender.send({ toE164: phone, body: `${code} is your NYC-MON sign-in code.` });
    return;
  }
  const email = readField(user, 'email');
  if (sendMail === undefined || typeof email !== 'string') {
    throw new Error('No channel can deliver a two-factor code for this account.');
  }
  await sendMail({ to: email, ...twoFactorCodeMail(code, TWO_FACTOR_OTP_MINUTES) });
}

const canSendTwoFactorCode = sendMail !== undefined || smsSender !== undefined;

const plugins = [
  passkey({
    rpID: baseOrigin.hostname,
    rpName: 'NYC-MON',
    origin: baseOrigin.origin,
  }),
  twoFactor({
    issuer: 'NYC-MON',
    // Enabling always enrols TOTP and backup codes first, so a code sender
    // that is down never leaves someone without a way in (ADR 0004 §1).
    skipVerificationOnEnable: false,
    allowPasswordless: false,
    totpOptions: { digits: 6, period: 30 },
    backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: 'encrypted' },
    ...(canSendTwoFactorCode
      ? {
          otpOptions: {
            digits: 6,
            period: TWO_FACTOR_OTP_MINUTES,
            allowedAttempts: 5,
            storeOTP: 'hashed' as const,
            sendOTP: async ({ user, otp }, ctx) => {
              await sendTwoFactorCode(user as unknown as Record<string, unknown>, otp, ctx?.context.internalAdapter);
            },
          },
        }
      : {}),
  }),
  username({
    minUsernameLength: MIN_USERNAME_LENGTH,
    maxUsernameLength: MAX_USERNAME_LENGTH,
    usernameValidator: isValidUsername,
  }),
  ...(smsSender === undefined
    ? []
    : [
        // Verify-only: no sign-up and no password reset by phone (ADR 0004 §1).
        phoneNumber({
          otpLength: 6,
          expiresIn: 300,
          allowedAttempts: 3,
          requireVerification: false,
          phoneNumberValidator: (value: string) => isAllowedSmsNumber(value, smsCountries),
          sendOTP: async ({ phoneNumber: toE164, code }) => {
            await smsSender.send({ toE164, body: `${code} is your NYC-MON verification code.` });
          },
        }),
      ]),
  deviceAuthorization({
    expiresIn: '10m',
    interval: '5s',
    validateClient: (clientId: string) => env.deviceClientIds.includes(clientId),
    verificationUri: `${env.baseURL}/device`,
  }),
  bearer(),
  oneTimeToken({
    expiresIn: 2,
    disableSetSessionCookie: true,
    storeToken: { type: 'custom-hasher', hash: hashHandoffToken },
  }),
  handoff(),
];

export const betterAuthOptions = {
  appName: 'NYC-MON',
  baseURL: env.baseURL,
  basePath: `${PAYLOAD_API_ROUTE}${AUTH_BASE_PATH}`,
  secret: env.secret,
  trustedOrigins: [baseOrigin.origin, ...env.trustedOrigins],
  // The stock verify would hand the second device the phone's own session;
  // `/handoff/redeem` creates a new one. Phone numbers are never a password.
  disabledPaths: ['/one-time-token/verify', '/sign-in/phone-number', '/phone-number/request-password-reset', '/phone-number/reset-password'],
  advanced: {
    database: { generateId: 'serial' },
    backgroundTasks: { handler: runInBackground },
  },
  rateLimit: {
    // Per-instance memory does not hold on Vercel Functions (ADR 0004 §7).
    storage: 'database',
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-in/username': { window: 60, max: 5 },
      '/is-username-available': { window: 60, max: 10 },
      '/device/code': { window: 60, max: 5 },
      '/one-time-token/generate': { window: 60, max: 5 },
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'user', input: false },
      // Optional at the auth layer because Apple and Google sign-ups do not
      // carry it; /v1 handlers refuse a Caller without one.
      birthYear: { type: 'number', required: false, input: true },
      consentStatus: { type: 'string', required: false, input: false },
      phoneConsentAt: { type: 'date', required: false, input: false },
      twoFactorOtpChannel: { type: 'string', required: false, input: true },
      activeMonInstanceId: { type: 'string', required: false, input: false },
    },
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
      ...(sendMail === undefined
        ? {}
        : {
            sendChangeEmailConfirmation: async ({ newEmail, url, user }) => {
              await sendMail({ to: user.email, ...changeEmailMail(newEmail, url) });
            },
          }),
    },
  },
  session: {
    additionalFields: {
      // Which screen this session belongs to (ADR 0004 §9).
      surface: { type: 'string', required: false, input: false },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      // Never skip the IdP's email_verified check (ADR 0004 §2).
      trustedProviders: [],
      requireLocalEmailVerified: true,
      // Explicit linkSocial only: Apple's private relay address never matches.
      allowDifferentEmails: true,
      allowUnlinkingAll: false,
      updateUserInfoOnLink: false,
    },
    encryptOAuthTokens: true,
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
            await sendMail({ to: user.email, ...resetPasswordMail(url) });
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
            await sendMail({ to: user.email, ...verifyEmailMail(url) });
          },
        },
      }),
  socialProviders,
  plugins,
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      switch (ctx.path) {
        case '/phone-number/send-otp':
        case '/phone-number/verify': {
          // Phone verification attaches a number to a signed-in, gated
          // Caller. Without a session, `/phone-number/verify` would sign in
          // by SMS alone, and `/send-otp` would text any number for anyone.
          const session = await getSessionFromCtx(ctx);
          if (!session) throw APIError.from('UNAUTHORIZED', { code: 'UNAUTHORIZED', message: 'Sign in first.' });
          if (!passesPhoneGate(session.user as unknown as Record<string, unknown>, Date.now())) throw phoneNotAllowed();
          const body: unknown = ctx.body;
          if (ctx.path === '/phone-number/verify' && readField(body, 'updatePhoneNumber') !== true) {
            throw APIError.from('BAD_REQUEST', { code: 'UPDATE_PHONE_NUMBER_REQUIRED', message: 'Use updatePhoneNumber: true.' });
          }
          if (ctx.path === '/phone-number/send-otp') {
            const number = readField(body, 'phoneNumber');
            if (typeof number !== 'string' || !isAllowedSmsNumber(number, smsCountries)) {
              throw APIError.from('BAD_REQUEST', { code: 'INVALID_PHONE_NUMBER', message: 'Use a US or Canadian mobile number.' });
            }
            await consumeSmsQuota(ctx.context.internalAdapter, `number:${number}`, MAX_SMS_PER_NUMBER_PER_DAY);
            await consumeSmsQuota(ctx.context.internalAdapter, `user:${String(session.user.id)}`, MAX_SMS_PER_USER_PER_DAY);
          }
          return;
        }
        case '/update-user': {
          const body: unknown = ctx.body;
          if (readField(body, 'phoneNumber') !== undefined) {
            throw APIError.from('BAD_REQUEST', { code: 'USE_PHONE_VERIFICATION', message: 'Add a phone number by verifying it.' });
          }
          const channel = readField(body, 'twoFactorOtpChannel');
          if (channel === undefined) return;
          if (channel !== 'email' && channel !== 'sms') {
            throw APIError.from('BAD_REQUEST', { code: 'INVALID_OTP_CHANNEL', message: 'Choose email or sms.' });
          }
          if (channel === 'sms') {
            const session = await getSessionFromCtx(ctx);
            const user = session?.user as unknown as Record<string, unknown> | undefined;
            if (user === undefined || smsSender === undefined || readField(user, 'phoneNumberVerified') !== true || !passesPhoneGate(user, Date.now())) {
              throw phoneNotAllowed();
            }
          }
          return;
        }
        case '/device/approve':
        case '/one-time-token/generate': {
          // Handing a session to another screen needs a recent sign-in (ADR 0004 §9).
          const session = await getSessionFromCtx(ctx);
          if (session) assertFreshSession(session.session);
          return;
        }
        default:
          return;
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const nowMs = Date.now();
          const currentYear = new Date(nowMs).getUTCFullYear();
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
          if (isConsentRequired({ birthYear, nowMs })) {
            throw APIError.from('FORBIDDEN', {
              code: 'GUARDIAN_CONSENT_REQUIRED',
              message: 'A parent or guardian needs to approve this account first.',
            });
          }
        },
      },
    },
    session: {
      create: {
        before: async (session, ctx) => {
          const fromOverride: unknown = readField(session, 'surface');
          const surface: Surface = isSurface(fromOverride)
            ? fromOverride
            : ctx?.path === '/device/token'
              ? (surfaceForClientId(readField(ctx.body, 'client_id')) ?? 'web')
              : requestedSurface(ctx?.headers ?? ctx?.request?.headers);
          return { data: { ...session, surface } };
        },
        after: async (session, ctx) => {
          if (ctx?.path !== '/device/token' && ctx?.path !== '/handoff/redeem') return;
          const surface = readField(session, 'surface');
          const user = await ctx.context.internalAdapter.findUserById(String(session.userId));
          sendNotice(user?.email, newSurfaceMail(surfaceLabel(isSurface(surface) ? surface : 'web')));
        },
      },
    },
    account: {
      create: {
        after: async (account, ctx) => {
          // A method added to an account older than a few minutes is a link,
          // not a sign-up, and the owner gets a notice.
          if (ctx === undefined || ctx === null) return;
          const user = await ctx.context.internalAdapter.findUserById(String(account.userId));
          if (user === null || Date.now() - new Date(user.createdAt).getTime() < 5 * 60 * 1000) return;
          sendNotice(user.email, signInMethodAddedMail(account.providerId));
        },
      },
      delete: {
        after: async (account, ctx) => {
          if (ctx?.path !== '/unlink-account') return;
          const user = await ctx.context.internalAdapter.findUserById(String(account.userId));
          sendNotice(user?.email, signInMethodRemovedMail(account.providerId));
        },
      },
    },
  },
} satisfies BetterAuthOptions;
