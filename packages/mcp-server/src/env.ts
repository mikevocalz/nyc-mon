import { z } from 'zod';

/** Server config from env. All names documented in README.md. */
export const EnvSchema = z.object({
  /** Port for the Streamable HTTP listener (dev). */
  MCP_PORT: z.coerce.number().int().positive().default(8788),
  /** Public origin of this server — becomes the RFC 9728 `resource`. */
  MCP_RESOURCE_ORIGIN: z.string().url().default('http://localhost:8788'),
  /** Authorization server origin — the admin-vite host (ADR 0003). */
  AUTH_SERVER_ORIGIN: z.string().url().default('http://localhost:5174'),
  /** The /v1 game API base — same host as AUTH_SERVER_ORIGIN. */
  V1_BASE_URL: z.string().url().default('http://localhost:5174'),
  /**
   * Dev-only: inject a fixed Caller context instead of validating tokens
   * (ADR 0006). Must stay '0'/unset in any deployed env.
   */
  OAUTH_DEV_BYPASS: z.enum(['0', '1']).default('0'),
  /** Dev/simulator flag: enables inject_presence_event. */
  MCP_DEV_MODE: z.enum(['0', '1']).default('0'),
  /** Supabase Realtime (presence channels) — TODO until provisioned. */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}
