import { EnvSchema } from '../../../mcp-server/src/env.ts';
import { readOAuthConfig } from '../auth/oauth/config.ts';
import { loadSimEnv } from '../../../web-sim/server/env.ts';

/** Offline configuration relationships only. Pass synthetic fixtures; never reads process.env. */
export function readinessEnvironmentProblems(source: Record<string, string | undefined>): string[] {
  const problems = new Set<string>();
  if (source.NODE_ENV !== 'production') problems.add('NODE_ENV');
  let sim: ReturnType<typeof loadSimEnv>;
  let oauth: ReturnType<typeof readOAuthConfig>;
  const mcp = EnvSchema.safeParse(source);
  if (!mcp.success) problems.add('MCP_CONFIG');
  try { sim = loadSimEnv(source); } catch { problems.add('SIM_CONFIG'); return [...problems]; }
  try { oauth = readOAuthConfig(source, () => problems.add('OAUTH_CONFIG')); }
  catch { problems.add('OAUTH_CONFIG'); return [...problems]; }
  if (source.OAUTH_DEV_BYPASS === '1' || sim.SIM_AUTH_MODE !== 'oauth') problems.add('DEV_BYPASS');
  if (sim.SIM_MODEL_BACKEND !== 'bedrock') problems.add('SIM_MODEL_BACKEND');
  if (!(sim.SIM_BEDROCK_REGION ?? sim.AWS_REGION)?.trim()) problems.add('AWS_REGION');
  for (const key of ['AUTH_ISSUER', 'AUTH_JWKS_URL', 'MCP_RESOURCE_URI', 'V1_BASE_URL', 'SIM_PUBLIC_ORIGIN', 'SIM_SANDBOX_ORIGIN', 'SIM_MCP_URL']) {
    try { if (new URL(source[key] ?? '').protocol !== 'https:') problems.add(key); }
    catch { problems.add(key); }
  }
  if (mcp.success) {
    if (oauth.issuer !== sim.AUTH_ISSUER || oauth.issuer !== mcp.data.AUTH_ISSUER) problems.add('ISSUER_ALIGNMENT');
    if (oauth.resource !== sim.SIM_MCP_URL || oauth.resource !== mcp.data.MCP_RESOURCE_URI) problems.add('RESOURCE_ALIGNMENT');
    if (!mcp.data.MCP_ALLOWED_ORIGINS.includes(new URL(sim.SIM_PUBLIC_ORIGIN).origin)) problems.add('MCP_ALLOWED_ORIGINS');
    for (const origin of mcp.data.MCP_ALLOWED_ORIGINS) {
      try { const parsed = new URL(origin); if (parsed.protocol !== 'https:' || parsed.origin !== origin) problems.add('MCP_ALLOWED_ORIGINS'); }
      catch { problems.add('MCP_ALLOWED_ORIGINS'); }
    }
  }
  const alexa = oauth.clients.find((client) => client.clientId === (source.OAUTH_ALEXA_CLIENT_ID ?? 'alexa'));
  const simulator = oauth.clients.find((client) => client.clientId === sim.OAUTH_SIM_CLIENT_ID);
  if (!alexa?.clientSecret || !alexa.redirectUris.length) problems.add('OAUTH_ALEXA_CLIENT');
  if (!simulator?.redirectUris.includes(`${new URL(sim.SIM_PUBLIC_ORIGIN).origin}/oauth/callback`)) problems.add('OAUTH_SIM_CLIENT');
  return [...problems];
}
