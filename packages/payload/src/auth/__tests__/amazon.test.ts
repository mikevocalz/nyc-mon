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
    const subject = await config?.accountSubject?.({
      profile: { user_id: 'amzn1.account.STABLE' },
      tokens: {},
    });
    expect(subject).toBe('amzn1.account.STABLE');
  });

  it('pins the LWA endpoints and profile scope used by the provider', () => {
    expect(AMAZON_PROVIDER_ID).toBe('amazon');
    expect(AMAZON_AUTHORIZATION_URL).toBe('https://www.amazon.com/ap/oa');
    expect(AMAZON_TOKEN_URL).toBe('https://api.amazon.com/auth/o2/token');
    expect(AMAZON_PROFILE_URL).toBe('https://api.amazon.com/user/profile');
    expect(AMAZON_SCOPES).toEqual(['profile']);
  });

  it.each([
    ['development', 'http://localhost:5174', true, false],
    ['development', 'http://127.0.0.1:5174', true, false],
    ['development', 'http://[::1]:5174', true, false],
    ['development', 'http://localhost:5174', false, true],
    ['production', 'http://localhost:5174', true, true],
    ['test', 'http://localhost:5174', true, true],
    [undefined, 'http://localhost:5174', true, true],
    ['development', 'https://admin.example.com', true, true],
    ['development', 'https://localhost.example.com', true, true],
    ['development', 'invalid-url', true, true],
  ])('keeps signup guarded for %s / %s / opt-in=%s', (nodeEnv, baseURL, allowSignUp, disabled) => {
    const plugin = amazonOAuthPlugin({ clientId: 'client-id', clientSecret: 'client-secret' }, {
      nodeEnv, baseURL, allowSignUp,
    });
    const config = (plugin as unknown as {
      options: { config: Array<{ disableImplicitSignUp: boolean; disableSignUp: boolean }> };
    }).options.config[0];
    expect(config?.disableImplicitSignUp).toBe(disabled);
    expect(config?.disableSignUp).toBe(disabled);
  });

  it.each(['development', 'production'])('uses a registered legacy callback only in local development (%s)', (nodeEnv) => {
    const plugin = amazonOAuthPlugin({ clientId: 'client-id', clientSecret: 'client-secret' }, {
      nodeEnv, baseURL: 'http://localhost:5174', allowSignUp: false, useLegacyCallback: true,
    });
    const config = (plugin as unknown as {
      options: { config: Array<{ redirectURI?: string; disableSignUp: boolean }> };
    }).options.config[0];
    expect(config?.redirectURI).toBe(nodeEnv === 'development'
      ? 'http://localhost:5174/payload-api/auth/oauth2/callback/amazon'
      : undefined);
    expect(config?.disableSignUp).toBe(true);
  });
});

describe('amazonOAuthPlugin on a hosted build', () => {
  it('stays link-only on Vercel even with a local-looking environment', () => {
    const previous = process.env.VERCEL;
    process.env.VERCEL = '1';
    try {
      const plugin = amazonOAuthPlugin(
        { clientId: 'id', clientSecret: 'secret' },
        { allowSignUp: true, nodeEnv: 'development', baseURL: 'http://localhost:5174' },
      );
      const config = (plugin as unknown as { options: { config: { disableSignUp: boolean; disableImplicitSignUp: boolean }[] } }).options.config[0]!;
      expect(config.disableSignUp).toBe(true);
      expect(config.disableImplicitSignUp).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previous;
    }
  });
});
