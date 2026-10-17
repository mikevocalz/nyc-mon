import { describe, expect, it, vi } from 'vitest';
import {
  AMAZON_AUTHORIZATION_URL,
  AMAZON_PROFILE_URL,
  AMAZON_PROVIDER_ID,
  AMAZON_SCOPES,
  AMAZON_TOKEN_URL,
  amazonOAuthPlugin,
  fetchAmazonProfile,
} from '../amazon';

describe('Login with Amazon profile mapping', () => {
  it('uses the stable Amazon user_id as the Better Auth account identity', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          user_id: 'amzn1.account.TEST',
          email: 'caller@example.com',
          name: 'Caller Example',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(fetchAmazonProfile('token-123', fetchImpl)).resolves.toEqual({
      user_id: 'amzn1.account.TEST',
      email: 'caller@example.com',
      name: 'Caller Example',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      AMAZON_PROFILE_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer token-123',
          accept: 'application/json',
          'accept-language': 'en-US',
        }),
      }),
    );
  });

  it('does not accept an Amazon profile without a stable id or email', async () => {
    const responses = [
      { email: 'caller@example.com' },
      { user_id: 'amzn1.account.TEST' },
    ];

    for (const body of responses) {
      const fetchImpl = vi.fn(async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      await expect(fetchAmazonProfile('token-123', fetchImpl)).resolves.toBeNull();
    }
  });

  it('fails closed when Amazon profile retrieval fails', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }));
    await expect(fetchAmazonProfile('token-123', fetchImpl)).resolves.toBeNull();
  });

  it('disables implicit sign-up and keys accounts by Amazon user_id', async () => {
    const plugin = amazonOAuthPlugin({ clientId: 'client-id', clientSecret: 'client-secret' });
    expect(plugin).toBeDefined();
    const config = (plugin as unknown as {
      options: {
        config: Array<{
          disableImplicitSignUp?: boolean;
          disableSignUp?: boolean;
          accountSubject?: (context: { profile: Record<string, unknown>; tokens: Record<string, unknown> }) => string | number | Promise<string | number>;
        }>;
      };
    }).options.config[0];
    expect(config?.disableImplicitSignUp).toBe(true);
    expect(config?.disableSignUp).toBe(true);
    await expect(
      config?.accountSubject?.({
        profile: { user_id: 'amzn1.account.STABLE' },
        tokens: {},
      }),
    ).resolves.toBe('amzn1.account.STABLE');
  });

  it('pins the LWA endpoints and profile scope used by the provider', () => {
    expect(AMAZON_PROVIDER_ID).toBe('amazon');
    expect(AMAZON_AUTHORIZATION_URL).toBe('https://www.amazon.com/ap/oa');
    expect(AMAZON_TOKEN_URL).toBe('https://api.amazon.com/auth/o2/token');
    expect(AMAZON_PROFILE_URL).toBe('https://api.amazon.com/user/profile');
    expect(AMAZON_SCOPES).toEqual(['profile']);
  });
});
