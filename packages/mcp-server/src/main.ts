import { createServer } from 'node:http';
import { createIntrospectionVerifier, createJwtVerifier, type TokenVerifier } from './auth/verifier.ts';
import { V1CallerData } from './data/v1.ts';
import { listenHostFor, loadEnv, type Env } from './env.ts';
import { createHandler } from './mcp/server.ts';
import type { McpAppsRegistration } from './mcp/ui-seam.ts';
import { FixtureFamiliarDirectory } from './presence/fixtures.ts';
import { PresenceService } from './presence/service.ts';
import { mcpAppsRegistration } from './ui/index.ts';

/**
 * Runnable entrypoint: `pnpm --filter @acme/mcp-server dev` (loads the root
 * .env/.env.local). Config is validated before the port opens; a bad config,
 * including OAUTH_DEV_BYPASS=1 under NODE_ENV=production, exits non-zero.
 */
const env = loadEnv();

function verifierFor(config: Env): TokenVerifier | 'dev-bypass' {
  if (config.OAUTH_DEV_BYPASS === '1') return 'dev-bypass';
  if (config.MCP_TOKEN_VERIFIER === 'introspection') {
    return createIntrospectionVerifier({
      url: config.AUTH_INTROSPECTION_URL ?? '',
      clientId: config.AUTH_INTROSPECTION_CLIENT_ID ?? '',
      clientSecret: config.AUTH_INTROSPECTION_CLIENT_SECRET ?? '',
      issuer: config.AUTH_ISSUER,
      audience: config.MCP_RESOURCE_URI,
    });
  }
  return createJwtVerifier({ issuer: config.AUTH_ISSUER, audience: config.MCP_RESOURCE_URI, jwks: config.AUTH_JWKS_URL ?? '' });
}

/** Lane C's MCP Apps views, when `build:ui` has run. Without them tools return data only. */
function loadUi(): McpAppsRegistration | undefined {
  try {
    return mcpAppsRegistration();
  } catch (error) {
    console.warn(`[mcp-server] MCP Apps views not loaded: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

const handler = createHandler({
  resourceUrl: env.MCP_RESOURCE_URI,
  authorizationServer: env.AUTH_ISSUER,
  allowedOrigins: env.MCP_ALLOWED_ORIGINS,
  verifier: verifierFor(env),
  data: new V1CallerData({ baseUrl: env.V1_BASE_URL, serviceKey: env.V1_MCP_SERVICE_KEY, timeoutMs: env.V1_TIMEOUT_MS }),
  presence: new PresenceService(),
  familiar: env.MCP_DEV_MODE === '1' ? new FixtureFamiliarDirectory() : undefined,
  ui: loadUi(),
});

const server = createServer((req, res) => {
  handler(req, res).catch((error: unknown) => {
    console.error('[mcp-server] unhandled:', error instanceof Error ? error.message : String(error));
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal' }));
  });
});

const listenHost = listenHostFor(env);
const onListening = () => {
  console.log(`[mcp-server] Streamable HTTP at ${env.MCP_RESOURCE_URI} (listening on ${listenHost ?? 'all interfaces'}:${env.MCP_PORT})`);
  if (env.OAUTH_DEV_BYPASS === '1') console.warn('[mcp-server] OAUTH_DEV_BYPASS=1: no token validation, acting as dev-caller');
  if (env.MCP_DEV_MODE === '1') console.warn('[mcp-server] MCP_DEV_MODE=1: simulator tools over fictional fixtures');
};
if (listenHost === undefined) server.listen(env.MCP_PORT, onListening);
else server.listen(env.MCP_PORT, listenHost, onListening);
