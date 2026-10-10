/**
 * @acme/mcp-server: the NYC-MON MCP server for Alexa+ and the web simulator
 * (ADR 0005, ADR 0015). Library surface only; the runnable entrypoint is
 * `src/main.ts`.
 */
export { createHandler, SUPPORTED_PROTOCOL_VERSIONS } from './mcp/server.ts';
export type { ServerDeps } from './mcp/server.ts';
export { buildTools, CORE_TOOL_NAMES, DEV_TOOL_NAMES, registerTools } from './mcp/tools.ts';
export type { ToolContext, ToolName, ToolRequest } from './mcp/tools.ts';
export type { McpAppsRegistration } from './mcp/ui-seam.ts';
export { failure, success } from './mcp/errors.ts';
export type { FailureReason } from './mcp/errors.ts';
export type { CallerData, CareWriteIntent, IncubatingEgg, MonWithCare } from './data/caller.ts';
export { V1CallerData, deviceIdFor, idempotencyKeyFor, writeLanded } from './data/v1.ts';
export { AdultRequiredError, DataError, NotFoundError, UpstreamError, WriteUnconfirmedError } from './data/errors.ts';
export { EnvSchema, loadEnv } from './env.ts';
export type { Env } from './env.ts';
export * from './presence/index.ts';
export { CALLER_SCOPE, CARE_SCOPE, MCP_SCOPES, PRM_PATH, SERVICE_SCOPE, USER_SCOPES, buildPrm, prmPathsFor } from './auth/prm.ts';
export { createIntrospectionVerifier, createJwtVerifier, InvalidTokenError, tokenFromClaims } from './auth/verifier.ts';
export type { TokenVerifier, VerifiedToken } from './auth/verifier.ts';
export { authenticateRequest, CARE_WRITE_TOOLS, decideAccess, isAdultByBirthYear } from './auth/request-auth.ts';
export { permitted, resolveActingVoice } from './auth/actor.ts';
export type { ActingVoice, SpeakerHint } from './auth/actor.ts';
