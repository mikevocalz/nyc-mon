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

export interface AuthEnv {
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

  return {
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
