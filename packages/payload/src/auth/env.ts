// Auth configuration read from the environment (ADR 0001).
// Values come from .env.local / the hosting provider; .env.example lists the names.
// Nothing here logs or returns a secret value.

function clean(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

function list(raw: string | undefined): string[] {
  const value = clean(raw);
  if (value === undefined) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

export interface AppleClient extends OAuthClient {
  appBundleIdentifier: string | undefined;
}

/** How SMS leaves the server (ADR 0004 §6). */
export type SmsTransport = 'sns' | 'console';

export interface SmsEnv {
  transport: SmsTransport;
  /** Comma-separated ISO codes from `AUTH_SMS_ALLOWED_COUNTRIES`, raw; `phone.ts` narrows them. */
  allowedCountries: string | undefined;
  awsRegion: string | undefined;
  /** Registered toll-free or 10DLC number in E.164. */
  originationNumber: string | undefined;
}

/** Headset and tablet client ids allowed to request a device code (ADR 0004 §9). */
export const DEFAULT_DEVICE_CLIENT_IDS = ['nyc-mon-quest', 'nyc-mon-visionos', 'nyc-mon-tablet'] as const;

function smsTransport(raw: string | undefined): SmsTransport | undefined {
  const value = clean(raw);
  if (value === undefined) return undefined;
  if (value === 'sns' || value === 'console') return value;
  throw new Error(`AUTH_SMS_TRANSPORT must be "sns" or "console", got "${value}".`);
}

export interface AuthEnv {
  /** True when NODE_ENV is "production". */
  isProduction: boolean;
  /** SMS configuration, or `undefined` when SMS is off in this environment. */
  sms: SmsEnv | undefined;
  /** Client ids `deviceAuthorization` accepts. */
  deviceClientIds: string[];
  /** Public origin of apps/admin-vite, where Better Auth issues links and cookies. */
  baseURL: string;
  /** Public origin of the product site (apps/web), if configured. */
  siteURL: string | undefined;
  secret: string | undefined;
  /** Extra origins (Expo scheme, preview hosts). The baseURL origin is always trusted. */
  trustedOrigins: string[];
  resendApiKey: string | undefined;
  /** Sender on a Resend-verified domain, e.g. `NYC-MON <hello@example.com>`. */
  emailFrom: string | undefined;
  /** Off until Resend sends from a verified domain in this environment (ADR 0001, lockout guard). */
  requireEmailVerification: boolean;
  google: OAuthClient | undefined;
  apple: AppleClient | undefined;
}

function oauthClient(rawId: string | undefined, rawSecret: string | undefined): OAuthClient | undefined {
  const clientId = clean(rawId);
  const clientSecret = clean(rawSecret);
  if (clientId === undefined || clientSecret === undefined) return undefined;
  return { clientId, clientSecret };
}

export function readAuthEnv(): AuthEnv {
  // Static process.env reads only: bundlers inline them and the expo lint
  // rule rejects dynamic access.
  const google = oauthClient(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  const appleClient = oauthClient(process.env.APPLE_CLIENT_ID, process.env.APPLE_CLIENT_SECRET);

  const transport = smsTransport(process.env.AUTH_SMS_TRANSPORT);
  const deviceClientIds = list(process.env.AUTH_DEVICE_CLIENT_IDS);

  return {
    isProduction: process.env.NODE_ENV === 'production',
    sms:
      transport === undefined
        ? undefined
        : {
            transport,
            allowedCountries: clean(process.env.AUTH_SMS_ALLOWED_COUNTRIES),
            awsRegion: clean(process.env.AWS_REGION),
            originationNumber: clean(process.env.AWS_SNS_ORIGINATION_NUMBER),
          },
    deviceClientIds: deviceClientIds.length > 0 ? deviceClientIds : [...DEFAULT_DEVICE_CLIENT_IDS],
    // Better Auth lives on the admin/API host (docs/adr/0003-admin-app-split.md),
    // never on the product site, so NEXT_PUBLIC_SITE_URL is not a fallback.
    baseURL: clean(process.env.BETTER_AUTH_URL) ?? 'http://localhost:5174',
    siteURL: clean(process.env.NEXT_PUBLIC_SITE_URL),
    secret: clean(process.env.BETTER_AUTH_SECRET),
    trustedOrigins: list(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
    resendApiKey: clean(process.env.RESEND_API_KEY),
    emailFrom: clean(process.env.AUTH_EMAIL_FROM),
    requireEmailVerification: clean(process.env.AUTH_REQUIRE_EMAIL_VERIFICATION) === 'true',
    google,
    apple:
      appleClient === undefined
        ? undefined
        : { ...appleClient, appBundleIdentifier: clean(process.env.APPLE_APP_BUNDLE_IDENTIFIER) },
  };
}
