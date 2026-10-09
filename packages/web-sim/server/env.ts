import { z } from 'zod';

/**
 * Simulator server config. Names are documented in docs/alexa/SIMULATOR.md.
 * AWS credentials are not read here: the AWS SDK's default provider chain
 * finds them (env, ~/.aws, SSO, role), and they never leave this process.
 */
export const SimEnvSchema = z.object({
  SIM_PORT: z.coerce.number().int().positive().default(5180),
  /** Second origin for the MCP Apps sandbox proxy (spec: host and sandbox origins MUST differ). */
  SIM_SANDBOX_PORT: z.coerce.number().int().positive().default(5181),
  /** Public origin of the simulator page. */
  SIM_PUBLIC_ORIGIN: z.string().url().default('http://localhost:5180'),
  /** Public origin of the sandbox proxy. Must differ from SIM_PUBLIC_ORIGIN. */
  SIM_SANDBOX_ORIGIN: z.string().url().default('http://localhost:5181'),
  /** Streamable HTTP endpoint of the NYC-MON MCP server (lane A). */
  SIM_MCP_URL: z.string().url().default('http://localhost:8788/mcp'),
  /**
   * 'oauth' signs in as client nyc-mon-sim. 'dev-bypass' skips sign-in and
   * relies on the MCP server running with OAUTH_DEV_BYPASS=1. Explicit opt-in.
   */
  SIM_AUTH_MODE: z.enum(['oauth', 'dev-bypass']).default('oauth'),
  /** Shows the presence dev panel. */
  SIM_DEV_MODE: z.enum(['0', '1']).default('0'),
  /** 'bedrock' calls Claude on Amazon Bedrock; 'mock' is the scripted stand-in for tests and offline runs. */
  SIM_MODEL_BACKEND: z.enum(['bedrock', 'mock']).default('bedrock'),
  /** Bedrock model id (Claude in Amazon Bedrock, Messages API endpoint). */
  SIM_BEDROCK_MODEL_ID: z.string().min(1).default('anthropic.claude-opus-5-5'),
  /** AWS region of the bedrock-mantle endpoint. Falls back to AWS_REGION. */
  SIM_BEDROCK_REGION: z.string().optional(),
  /** Thinking/effort depth. Low keeps voice replies quick. */
  SIM_MODEL_EFFORT: z.enum(['low', 'medium', 'high']).default('low'),
  SIM_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(16000).default(4096),
  /** Agent Skill file loaded as the system prompt. Default: skills/nyc-mon-companion/SKILL.md. */
  SIM_SKILL_PATH: z.string().optional(),
  /** Model turns per minute per client address. */
  SIM_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),
  /** Model turns per minute across all clients: the ceiling on Bedrock spend. */
  SIM_GLOBAL_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(120),
  /**
   * '1' only behind a reverse proxy you run: the rate limit then keys on the
   * first X-Forwarded-For hop. Otherwise the socket address is used and the
   * header is ignored, so a client can't pick its own key.
   */
  SIM_TRUST_PROXY: z.enum(['0', '1']).default('0'),
  /** The authorization server (admin-vite). Same variable the MCP server and admin-vite read. */
  AUTH_ISSUER: z.string().url().default('http://localhost:5174'),
  /** The issuer's JWKS. Default: {AUTH_ISSUER}/payload-api/auth/jwks (docs/alexa/AUTH.md). */
  AUTH_JWKS_URL: z.string().url().optional(),
  /** The simulator's OAuth client id. Same variable admin-vite registers the client from. */
  OAUTH_SIM_CLIENT_ID: z.string().min(1).default('nyc-mon-sim'),
  AWS_REGION: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

export type SimEnv = z.infer<typeof SimEnvSchema>;

export function loadSimEnv(source: Record<string, string | undefined> = process.env): SimEnv {
  const env = SimEnvSchema.parse(source);
  if (env.SIM_AUTH_MODE === 'dev-bypass' && env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
    throw new Error('SIM_AUTH_MODE=dev-bypass needs NODE_ENV=development or test; refusing to start without sign-in.');
  }
  if (new URL(env.SIM_PUBLIC_ORIGIN).origin === new URL(env.SIM_SANDBOX_ORIGIN).origin) {
    throw new Error('SIM_SANDBOX_ORIGIN must be a different origin from SIM_PUBLIC_ORIGIN.');
  }
  return env;
}

export function jwksUrl(env: SimEnv): string {
  return env.AUTH_JWKS_URL ?? `${env.AUTH_ISSUER.replace(/\/+$/, '')}/payload-api/auth/jwks`;
}

/** What the browser is allowed to know. No secrets, no model credentials. */
export interface PublicConfig {
  readonly mcpUrl: string;
  readonly sandboxOrigin: string;
  readonly authMode: 'oauth' | 'dev-bypass';
  /** The OAuth client id the page signs in as (single source: OAUTH_SIM_CLIENT_ID). */
  readonly clientId: string;
  readonly devMode: boolean;
  readonly modelBackend: 'bedrock' | 'mock';
  readonly modelLabel: string;
}

export function publicConfig(env: SimEnv): PublicConfig {
  return {
    mcpUrl: env.SIM_MCP_URL,
    sandboxOrigin: new URL(env.SIM_SANDBOX_ORIGIN).origin,
    authMode: env.SIM_AUTH_MODE,
    clientId: env.OAUTH_SIM_CLIENT_ID,
    devMode: env.SIM_DEV_MODE === '1',
    modelBackend: env.SIM_MODEL_BACKEND,
    modelLabel: env.SIM_MODEL_BACKEND === 'mock' ? 'Scripted test model' : `Claude on Amazon Bedrock (${env.SIM_BEDROCK_MODEL_ID})`,
  };
}
