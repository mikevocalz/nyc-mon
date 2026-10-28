import { z } from 'zod';
import { NEBIUS_ENDPOINTS, NVIDIA_MODELS } from './nebius.ts';

const Origin = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash;
}, 'An origin without path, credentials, query or fragment is required.');
const Schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SIM_PORT: z.coerce.number().int().min(1024).max(65535).default(5180),
  SIM_PUBLIC_ORIGIN: Origin.default('http://localhost:5180'),
  SIM_MCP_URL: z.string().url().default('http://localhost:8788/mcp'),
  AUTH_ISSUER: Origin.default('http://localhost:5174'),
  OAUTH_SIM_CLIENT_ID: z.string().min(1).default('nyc-mon-sim'),
  V1_BASE_URL: Origin.default('http://localhost:5174'),
  V1_MCP_SERVICE_KEY: z.string().min(32),
  NEBIUS_API_KEY: z.string().trim().min(1),
  NEBIUS_BASE_URL: z.enum(NEBIUS_ENDPOINTS).default(NEBIUS_ENDPOINTS[0]),
  SIM_NEBIUS_MODEL_ID: z.enum(NVIDIA_MODELS).default(NVIDIA_MODELS[0]),
  // Nemotron 3.5 Lightning reasons before it answers; 1024 left too little room. Matches the adapter default.
  SIM_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(16000).default(4096),
  // The Mon's own voice on /api/tts. Unset (or empty): the route answers 204 and the page reads with Web Speech.
  ELEVENLABS_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional()),
  // ffmpeg for the stage pitch shift. Unset: `ffmpeg` on PATH; neither runs: the voice keeps its natural pitch.
  FFMPEG_PATH: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
});
export type NvidiaEnv = z.infer<typeof Schema>;
/** Dedicated entry uses the existing simulator/agent/auth modules; it never falls back to Bedrock or a mock. */
export function loadNvidiaEnv(source: Record<string, string | undefined> = process.env): NvidiaEnv {
  const result = Schema.safeParse(source);
  if (!result.success) throw new Error(`NVIDIA configuration is incomplete: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  const env = result.data;
  if (source.SIM_AUTH_MODE === 'dev-bypass' || source.OAUTH_DEV_BYPASS === '1' || source.MCP_DEV_MODE === '1') {
    throw new Error('NVIDIA companion requires real OAuth and database-backed tools; dev bypass/fixtures are refused.');
  }
  for (const address of [env.SIM_PUBLIC_ORIGIN, env.SIM_MCP_URL, env.AUTH_ISSUER, env.V1_BASE_URL]) {
    const url = new URL(address);
    if (url.username || url.password || url.search || url.hash) throw new Error('NVIDIA service URLs may not contain credentials or query strings.');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && env.NODE_ENV !== 'production' && url.protocol === 'http:')) {
      throw new Error('NVIDIA services require HTTPS, except loopback development.');
    }
  }
  return env;
}
export function nvidiaPublicConfig(env: NvidiaEnv) {
  return { mcpUrl: env.SIM_MCP_URL, clientId: env.OAUTH_SIM_CLIENT_ID,
    modelBackend: 'nebius' as const, modelLabel: `NVIDIA ${env.SIM_NEBIUS_MODEL_ID} on Nebius Token Factory` };
}
