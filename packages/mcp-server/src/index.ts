/**
 * @acme/mcp-server — the NYC-MON × Alexa+ MCP add-on (ADR 0005).
 * Library surface only — the runnable entrypoint is `src/main.ts`.
 */
export { createHandler } from './mcp/server.ts';
export type { ServerDeps } from './mcp/server.ts';
export { tools, toolNames } from './mcp/tools.ts';
export type { ToolContext, ToolDef, ToolResult } from './mcp/tools.ts';
export { TOOL_ERROR_CODES, ToolErrorCodeSchema, ToolErrorSchema } from './mcp/errors.ts';
export type { CallerData } from './data/caller.ts';
export { stubCallerData } from './data/caller.ts';
export { EnvSchema, loadEnv } from './env.ts';
export * from './presence/index.ts';
export { MCP_SCOPES, PRM_PATH, bearerChallenge, buildPrm } from './auth/prm.ts';
export { authenticate, devBypassContext, verifyPkceS256 } from './auth/oauth.ts';
export { permitted, resolveActingVoice } from './auth/actor.ts';
