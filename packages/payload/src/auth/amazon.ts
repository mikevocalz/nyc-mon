import { genericOAuth } from 'better-auth/plugins';

export const AMAZON_PROVIDER_ID = 'amazon';
export const AMAZON_AUTHORIZATION_URL = 'https://www.amazon.com/ap/oa';
export const AMAZON_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
export const AMAZON_PROFILE_URL = 'https://api.amazon.com/user/profile';

/**
 * We request `profile`, not only `profile:user_id`, because Better Auth's
 * social-provider path needs an email/name payload when it resolves an
 * account. Amazon still supplies the stable `user_id`, which is the account
 * identity. Deployed environments keep implicit sign-up disabled so LWA
 * never bypasses NYC-MON's birth-year/guardian gates.
 */
export const AMAZON_SCOPES = ['profile'] as const;

export interface AmazonOAuthClient {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface AmazonLocalDevelopment {
  readonly allowSignUp: boolean;
  readonly nodeEnv: string | undefined;
  readonly baseURL: string;
  readonly useLegacyCallback?: boolean;
}

/** An explicit localhost-only demo option; deployed environments stay link-only. */
function isLocalDevelopment(local: AmazonLocalDevelopment | undefined): boolean {
  if (local?.nodeEnv !== 'development') return false;
  try {
    const url = new URL(local.baseURL);
    return ['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

interface AmazonProfileResponse {
  readonly user_id?: unknown;
  readonly email?: unknown;
  readonly name?: unknown;
}

export interface AmazonProfile {
  readonly user_id: string;
  readonly email: string;
  readonly name: string;
}

export type AmazonFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Fetches the LWA profile and rejects incomplete identities. */
export async function fetchAmazonProfile(
  accessToken: string,
  fetchImpl: AmazonFetch = fetch,
): Promise<AmazonProfile | null> {
  const response = await fetchImpl(AMAZON_PROFILE_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      'accept-language': 'en-US',
    },
  });
  if (!response.ok) return null;

  const raw = (await response.json()) as AmazonProfileResponse;
  const id = typeof raw.user_id === 'string' ? raw.user_id.trim() : '';
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (id === '' || email === '') return null;

  return {
    user_id: id,
    email,
    name: name || email.split('@')[0] || 'Caller',
  };
}

/**
 * Login with Amazon as a Better Auth social provider.
 *
 * - Authorization Code + PKCE (LWA supports S256).
 * - HTTP Basic at the token endpoint.
 * - No deployed sign-up: a Caller must already have a NYC-MON account and explicitly
 *   link Amazon first, so LWA cannot create an age-unknown account through
 *   either implicit or explicit social sign-up.
 */
export function amazonOAuthPlugin(client: AmazonOAuthClient | undefined, local?: AmazonLocalDevelopment) {
  if (client === undefined) return undefined;
  const localDevelopment = isLocalDevelopment(local);
  const localSignUp = localDevelopment && local?.allowSignUp === true;

  return genericOAuth({
    config: [
      {
        providerId: AMAZON_PROVIDER_ID,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        authorizationUrl: AMAZON_AUTHORIZATION_URL,
        tokenUrl: AMAZON_TOKEN_URL,
        userInfoUrl: AMAZON_PROFILE_URL,
        scopes: [...AMAZON_SCOPES],
        responseType: 'code',
        // Keep an already-registered local callback working across Better Auth's
        // genericOAuth endpoint migration. The admin forwards it to the core callback.
        ...(localDevelopment && local?.useLegacyCallback
          ? { redirectURI: new URL('/payload-api/auth/oauth2/callback/amazon', local.baseURL).href }
          : {}),
        pkce: true,
        authentication: 'basic',
        disableImplicitSignUp: !localSignUp,
        // No client-side requestSignUp escape hatch in deployed environments.
        disableSignUp: !localSignUp,
        // Better Auth 1.7 no longer lets mapped local-user fields define the
        // provider identity. Amazon's immutable subject is `user_id`, not
        // plain OAuth's default `id`, so bind the account row explicitly.
        accountSubject: ({ profile }) => {
          const subject = profile.user_id;
          if (typeof subject !== 'string' || subject.trim() === '') {
            throw new Error('Login with Amazon returned no stable user_id.');
          }
          return subject;
        },
        getUserInfo: async (tokens) => {
          if (tokens.accessToken === undefined) return null;
          const profile = await fetchAmazonProfile(tokens.accessToken);
          return profile === null
            ? null
            : {
                id: undefined,
                user_id: profile.user_id,
                email: profile.email,
                name: profile.name,
                // LWA's profile response does not carry a verified-email flag.
                // NYC-MON does not upgrade local verification from this value.
                emailVerified: false,
                image: undefined,
              };
        },
      },
    ],
  });
}
