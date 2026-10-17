import { genericOAuth } from 'better-auth/plugins';

export const AMAZON_PROVIDER_ID = 'amazon';
export const AMAZON_AUTHORIZATION_URL = 'https://www.amazon.com/ap/oa';
export const AMAZON_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
export const AMAZON_PROFILE_URL = 'https://api.amazon.com/user/profile';

/**
 * We request `profile`, not only `profile:user_id`, because Better Auth's
 * social-provider path needs an email/name payload when it resolves an
 * account. Amazon still supplies the stable `user_id`, which is the account
 * identity. Implicit sign-up stays disabled so LWA never bypasses NYC-MON's
 * birth-year/guardian gates.
 */
export const AMAZON_SCOPES = ['profile'] as const;

export interface AmazonOAuthClient {
  readonly clientId: string;
  readonly clientSecret: string;
}

interface AmazonProfileResponse {
  readonly user_id?: unknown;
  readonly email?: unknown;
  readonly name?: unknown;
}

export interface AmazonProfile {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

/** Fetches the LWA profile and rejects incomplete identities. */
export async function fetchAmazonProfile(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
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
    id,
    email,
    name: name || email.split('@')[0] || 'Caller',
  };
}

/**
 * Login with Amazon as a Better Auth social provider.
 *
 * - Authorization Code + PKCE (LWA supports S256).
 * - HTTP Basic at the token endpoint.
 * - No implicit sign-up: a Caller must already have a NYC-MON account and
 *   explicitly link Amazon first, so LWA cannot create an age-unknown account.
 */
export function amazonOAuthPlugin(client: AmazonOAuthClient | undefined) {
  if (client === undefined) return undefined;

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
        pkce: true,
        authentication: 'basic',
        disableImplicitSignUp: true,
        getUserInfo: async (tokens) => {
          const profile = await fetchAmazonProfile(tokens.accessToken);
          return profile === null
            ? null
            : {
                id: profile.id,
                email: profile.email,
                name: profile.name,
              };
        },
      },
    ],
  });
}
