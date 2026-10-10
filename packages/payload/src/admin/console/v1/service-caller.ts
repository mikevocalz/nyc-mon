import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Server-to-server access to `/v1` on behalf of one Caller, used by the
 * NYC-MON MCP server (`packages/mcp-server`, ADR 0005, ADR 0015).
 *
 * The MCP spec forbids passing the MCP access token through to upstream APIs
 * (2025-11-25 authorization, "token passthrough"), so the MCP server never
 * forwards the Alexa token here. It validates that token itself, then calls
 * `/v1` with its own shared key and names the Caller it acts for. The key is
 * `V1_MCP_SERVICE_KEY`; when unset, this path is off and the headers are
 * ignored.
 *
 * Every request on this path is an Alexa+ request, so it carries the ADR 0015
 * rule with it: the account must be 18 or older, judged from the stored birth
 * year and erring toward "under 18" (see {@link isAdultByBirthYear}).
 */
export const SERVICE_KEY_HEADER = 'X-NYC-MON-Service-Key';
export const ON_BEHALF_OF_HEADER = 'X-NYC-MON-On-Behalf-Of';

/** Shortest key accepted; a shorter configured key disables the path. */
export const MIN_SERVICE_KEY_LENGTH = 32;

/** Age the Alexa+ add-on requires (ADR 0015 §1). */
export const ADULT_AGE_YEARS = 18;

export type ServiceCallerResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'rejected' }
  | { readonly kind: 'caller'; readonly callerId: string };

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/** Constant-time comparison of a presented key against the configured one. */
export function serviceKeyMatches(presented: string, configured: string | undefined): boolean {
  if (configured === undefined || configured.length < MIN_SERVICE_KEY_LENGTH) return false;
  return timingSafeEqual(digest(presented), digest(configured));
}

/** The `/v1` routes the MCP server calls with the service key, and nothing else. */
const SERVICE_ROUTES: readonly { method: string; path: RegExp }[] = [
  { method: 'GET', path: /^\/v1\/me\/mons\/?$/ },
  { method: 'GET', path: /^\/v1\/me\/eggs\/?$/ },
  { method: 'PUT', path: /^\/v1\/mons\/[^/]+\/care\/?$/ },
];

/** True when `request` is one of the routes the service key may reach. */
export function isServiceRoute(request: Request): boolean {
  const method = request.method.toUpperCase();
  const { pathname } = new URL(request.url);
  return SERVICE_ROUTES.some((route) => route.method === method && route.path.test(pathname));
}

/**
 * Reads the service headers. `none` means the request did not use this path
 * (fall back to the session); `rejected` means it tried and failed, which must
 * end in a 401 rather than a session fallback.
 */
export function readServiceCaller(request: Request, configuredKey: string | undefined): ServiceCallerResult {
  const presented = request.headers.get(SERVICE_KEY_HEADER);
  if (presented === null) return { kind: 'none' };
  if (!serviceKeyMatches(presented, configuredKey)) return { kind: 'rejected' };
  const callerId = request.headers.get(ON_BEHALF_OF_HEADER)?.trim() ?? '';
  if (callerId === '' || callerId.length > 128) return { kind: 'rejected' };
  return { kind: 'caller', callerId };
}

/**
 * True only when the birth year proves the holder is at least 18 in UTC
 * `nowMs`'s year for every possible birthday: `currentYear - birthYear > 18`.
 * Someone born in 2008 may still be 17 for part of 2026, so 2008 is refused
 * until 2027. A missing or malformed year is refused.
 */
export function isAdultByBirthYear(birthYear: unknown, nowMs: number): boolean {
  if (typeof birthYear !== 'number' || !Number.isInteger(birthYear)) return false;
  return new Date(nowMs).getUTCFullYear() - birthYear > ADULT_AGE_YEARS;
}
