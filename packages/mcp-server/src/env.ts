import { z } from 'zod';

const flag = z.enum(['0', '1']).default('0');

const commaList = z
  .string()
  .default('')
  .transform((raw) =>
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== ''),
  );

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** True when the URL's host is localhost, 127.0.0.1 or ::1. */
export function isLoopbackUrl(url: string): boolean {
  return LOOPBACK_HOSTS.has(new URL(url).hostname);
}

/** Server config from env. Every name is listed in README.md. */
export const EnvSchema = z
  .object({
    /** Unset is not development: the dev bypass needs this set to `development` or `test`. */
    NODE_ENV: z.string().optional(),
    /** Port for the Streamable HTTP listener. */
    MCP_PORT: z.coerce.number().int().positive().default(8788),
    /**
     * The exact public URL of the MCP endpoint, path included. It is the RFC
     * 9728 `resource`, the token audience, and the add-on manifest URI, and
     * all three must match byte for byte (PLATFORM-DOCS §2.5).
     */
    MCP_RESOURCE_URI: z.url().default('http://localhost:8788/mcp'),
    /**
     * Browser origins allowed to call `/mcp` (scheme://host[:port], comma
     * separated). The resource URL's own origin is always allowed. Requests
     * without an `Origin` header (Alexa's server-to-server calls) pass.
     */
    MCP_ALLOWED_ORIGINS: commaList,
    /** The authorization server's issuer (admin-vite, ADR 0003). First PRM entry. */
    AUTH_ISSUER: z.url().default('http://localhost:5174'),
    /** `jwt` verifies against AUTH_JWKS_URL; `introspection` calls RFC 7662. */
    MCP_TOKEN_VERIFIER: z.enum(['jwt', 'introspection']).default('jwt'),
    AUTH_JWKS_URL: z.url().optional(),
    AUTH_INTROSPECTION_URL: z.url().optional(),
    AUTH_INTROSPECTION_CLIENT_ID: z.string().min(1).optional(),
    AUTH_INTROSPECTION_CLIENT_SECRET: z.string().min(1).optional(),
    /** The `/v1` game API base (admin-vite). */
    V1_BASE_URL: z.url().default('http://localhost:5174'),
    /** Shared key for `/v1` on-behalf-of calls; the same value as admin-vite's V1_MCP_SERVICE_KEY. */
    V1_MCP_SERVICE_KEY: z.string().min(32).optional(),
    /** Per-call `/v1` timeout. Alexa's round-trip budget is 500 ms in total. */
    V1_TIMEOUT_MS: z.coerce.number().int().positive().default(400),
    /**
     * Local and simulator development only: every request acts as a fixed
     * adult dev Caller and no token is checked. Refused when NODE_ENV is
     * `production`.
     */
    OAUTH_DEV_BYPASS: flag,
    /**
     * Dev and simulator mode (ADR 0015 §2): registers the familiar-people and
     * presence tools over seeded fictional fixtures. Off for the Alexa build.
     */
    MCP_DEV_MODE: flag,
  })
  .superRefine((env, ctx) => {
    if (env.OAUTH_DEV_BYPASS === '1') {
      if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
        ctx.addIssue({
          code: 'custom',
          path: ['OAUTH_DEV_BYPASS'],
          message: 'OAUTH_DEV_BYPASS=1 needs NODE_ENV set to development or test.',
        });
      }
      if (!isLoopbackUrl(env.MCP_RESOURCE_URI)) {
        ctx.addIssue({
          code: 'custom',
          path: ['OAUTH_DEV_BYPASS'],
          message: 'OAUTH_DEV_BYPASS=1 needs a loopback MCP_RESOURCE_URI (localhost, 127.0.0.1 or ::1).',
        });
      }
      return;
    }
    if (env.MCP_TOKEN_VERIFIER === 'jwt' && env.AUTH_JWKS_URL === undefined) {
      ctx.addIssue({ code: 'custom', path: ['AUTH_JWKS_URL'], message: 'AUTH_JWKS_URL is required when MCP_TOKEN_VERIFIER=jwt.' });
    }
    if (
      env.MCP_TOKEN_VERIFIER === 'introspection' &&
      (env.AUTH_INTROSPECTION_URL === undefined ||
        env.AUTH_INTROSPECTION_CLIENT_ID === undefined ||
        env.AUTH_INTROSPECTION_CLIENT_SECRET === undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_INTROSPECTION_URL'],
        message: 'MCP_TOKEN_VERIFIER=introspection needs AUTH_INTROSPECTION_URL, _CLIENT_ID and _CLIENT_SECRET.',
      });
    }
    if (env.V1_MCP_SERVICE_KEY === undefined) {
      ctx.addIssue({ code: 'custom', path: ['V1_MCP_SERVICE_KEY'], message: 'V1_MCP_SERVICE_KEY is required unless OAUTH_DEV_BYPASS=1.' });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/**
 * The address the HTTP listener binds. Under the dev bypass every request acts
 * as the dev Caller, so the port must not be reachable off this machine.
 * Otherwise all interfaces (behind the deploy's TLS proxy).
 */
export function listenHostFor(env: Pick<Env, 'OAUTH_DEV_BYPASS'>): string | undefined {
  return env.OAUTH_DEV_BYPASS === '1' ? '127.0.0.1' : undefined;
}

/** Parses the process env; throws with every problem listed when the config is unusable. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}
