import { createServer } from 'node:http';
import { loadEnv } from './env.ts';
import { createHandler } from './mcp/server.ts';
import { stubCallerData } from './data/caller.ts';
import { presenceService } from './presence/service.ts';

/**
 * Runnable entrypoint: `pnpm --filter @acme/mcp-server dev`
 * (loads root .env/.env.local via --env-file-if-exists).
 */
const env = loadEnv();

const handler = createHandler({
  env,
  // TODO(data): replace with a /v1-backed CallerData (prod) or fixtures (demo).
  data: stubCallerData,
});

// TODO(realtime): presenceService.subscribeRealtime(callerId) per session once
// Supabase credentials exist; presenceService is shared in-process today.
void presenceService;

const server = createServer((req, res) => {
  handler(req, res).catch((err) => {
    console.error('[mcp-server] unhandled', err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal' }));
  });
});

server.listen(env.MCP_PORT, () => {
  console.log(`[mcp-server] Streamable HTTP on ${env.MCP_RESOURCE_ORIGIN} (port ${env.MCP_PORT})`);
  console.log(`[mcp-server] PRM: ${env.MCP_RESOURCE_ORIGIN}/.well-known/oauth-protected-resource`);
  if (env.OAUTH_DEV_BYPASS === '1') console.warn('[mcp-server] OAUTH_DEV_BYPASS=1 — no token validation');
});
