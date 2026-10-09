import { utcYearFromEpochMs } from '@acme/core';
import { CALLER_SCOPE, CARE_SCOPE } from './prm.ts';
import { InvalidTokenError, type TokenVerifier, type VerifiedToken } from './verifier.ts';

/** Age the Alexa+ add-on requires (ADR 0015 §1). */
export const ADULT_AGE_YEARS = 18;

/**
 * True only when a birth year proves 18+ for every possible birthday in UTC
 * `nowMs`'s year (`currentYear - birthYear > 18`). Mirrors the `/v1` check in
 * `packages/payload/src/admin/console/v1/service-caller.ts`, which is the
 * authoritative one (it reads the Users record).
 */
export function isAdultByBirthYear(birthYear: number, nowMs: number): boolean {
  return Number.isInteger(birthYear) && utcYearFromEpochMs(nowMs) - birthYear > ADULT_AGE_YEARS;
}

/** What the bearer header on one HTTP request proved. */
export type RequestAuth =
  | { readonly kind: 'none' }
  | { readonly kind: 'invalid' }
  | Extract<VerifiedToken, { kind: 'service' }>
  | Extract<VerifiedToken, { kind: 'user' }>;

/** The fixed adult Caller OAUTH_DEV_BYPASS acts as. */
export const DEV_BYPASS_CALLER_ID = 'dev-caller';

export function devBypassAuth(nowMs: number = Date.now()): RequestAuth {
  return {
    kind: 'user',
    clientId: 'dev-bypass',
    callerId: DEV_BYPASS_CALLER_ID,
    scopes: [CALLER_SCOPE, CARE_SCOPE],
    expiresAt: Math.floor(nowMs / 1000) + 3_600,
    birthYear: 1990,
  };
}

/**
 * Reads `Authorization: Bearer <token>` (header only; query-string tokens are
 * never read) and verifies it. A malformed header counts as `invalid`.
 */
export async function authenticateRequest(
  authorization: string | undefined,
  verifier: TokenVerifier,
): Promise<RequestAuth> {
  if (authorization === undefined || authorization.trim() === '') return { kind: 'none' };
  const match = /^Bearer[ ]+(\S+)$/i.exec(authorization.trim());
  if (match === null || match[1] === undefined) return { kind: 'invalid' };
  try {
    return await verifier.verify(match[1]);
  } catch (error) {
    if (error instanceof InvalidTokenError) return { kind: 'invalid' };
    throw error;
  }
}

/** JSON-RPC methods a client_credentials (`mcp:service`) token may call: discovery only, no Caller data. */
const SERVICE_METHODS = new Set([
  'initialize',
  'ping',
  'tools/list',
  'resources/list',
  'resources/templates/list',
  'resources/read',
  'prompts/list',
]);

/** Tools that write care; they need `mcp:care`. Every other tool needs `mcp:caller`. */
export const CARE_WRITE_TOOLS: ReadonlySet<string> = new Set(['feed_mon', 'rest_mon', 'wake_mon', 'play_with_mon']);

interface RpcMessage {
  readonly method: string;
  readonly toolName: string | undefined;
}

function messagesIn(body: unknown): RpcMessage[] {
  const messages = Array.isArray(body) ? body : [body];
  const out: RpcMessage[] = [];
  for (const message of messages) {
    if (typeof message !== 'object' || message === null || !('method' in message)) continue;
    const { method, params } = message as { method: unknown; params?: unknown };
    if (typeof method !== 'string') continue;
    const name = typeof params === 'object' && params !== null ? (params as { name?: unknown }).name : undefined;
    out.push({ method, toolName: typeof name === 'string' ? name : undefined });
  }
  return out;
}

/** The HTTP answer for a request: let it through, or 401 / 403 with no WWW-Authenticate. */
export type AccessDecision = 'allow' | 401 | 403;

/**
 * The two-tier gate (PLATFORM-DOCS §2.4). No or bad token: 401 for everything.
 * Service token: discovery and notifications pass; a `tools/call` is 401 so
 * Alexa starts account linking. User token: everything passes, except a care
 * tool without `mcp:care` (or any other tool without `mcp:caller`), which is
 * 403 for insufficient scope.
 */
export function decideAccess(auth: RequestAuth, body: unknown): AccessDecision {
  if (auth.kind === 'none' || auth.kind === 'invalid') return 401;
  const messages = messagesIn(body);
  if (auth.kind === 'service') {
    return messages.every((m) => SERVICE_METHODS.has(m.method) || m.method.startsWith('notifications/')) ? 'allow' : 401;
  }
  for (const m of messages) {
    if (m.method !== 'tools/call') continue;
    const needed = m.toolName !== undefined && CARE_WRITE_TOOLS.has(m.toolName) ? CARE_SCOPE : CALLER_SCOPE;
    if (!auth.scopes.includes(needed)) return 403;
  }
  return 'allow';
}
