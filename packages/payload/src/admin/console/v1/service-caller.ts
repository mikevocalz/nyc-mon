import { createHash, timingSafeEqual } from 'node:crypto';

/** Verified server delegation to the existing Caller-owned `/v1` API; never MCP-token passthrough. */
export const SERVICE_KEY_HEADER = 'X-NYC-MON-Service-Key';
export const ON_BEHALF_OF_HEADER = 'X-NYC-MON-On-Behalf-Of';
export const MIN_SERVICE_KEY_LENGTH = 32;
export const ADULT_AGE_YEARS = 18;
export type ServiceCallerResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'rejected' }
  | { readonly kind: 'caller'; readonly callerId: string };
function digest(value: string): Buffer { return createHash('sha256').update(value,'utf8').digest(); }
export function serviceKeyMatches(presented: string, configured: string | undefined): boolean {
  if (configured === undefined || configured.length < MIN_SERVICE_KEY_LENGTH) return false;
  return timingSafeEqual(digest(presented),digest(configured));
}
/** Exact methods/routes only. Memory writes are user-operated simulator controls, never agent tools. */
const SERVICE_ROUTES: readonly { method: string; path: RegExp }[] = [
  { method:'GET',path:/^\/v1\/me\/mons\/?$/ },
  { method:'GET',path:/^\/v1\/me\/eggs\/?$/ },
  { method:'PUT',path:/^\/v1\/mons\/[^/]+\/care\/?$/ },
  { method:'POST',path:/^\/v1\/eggs\/[^/]+\/hatch\/?$/ },
  { method:'GET',path:/^\/v1\/me\/companion-memory\/?$/ },
  { method:'PUT',path:/^\/v1\/me\/companion-memory\/?$/ },
  { method:'DELETE',path:/^\/v1\/me\/companion-memory\/?$/ },
];
export function isServiceRoute(request: Request): boolean {
  return SERVICE_ROUTES.some((route) => route.method === request.method.toUpperCase() && route.path.test(new URL(request.url).pathname));
}
export function readServiceCaller(request: Request, configuredKey: string | undefined): ServiceCallerResult {
  const presented = request.headers.get(SERVICE_KEY_HEADER);
  if (presented === null) return { kind:'none' };
  if (!serviceKeyMatches(presented,configuredKey)) return { kind:'rejected' };
  const callerId = request.headers.get(ON_BEHALF_OF_HEADER)?.trim() ?? '';
  if (callerId === '' || callerId.length > 128) return { kind:'rejected' };
  return { kind:'caller',callerId };
}
/** A birth year must prove adulthood for every possible birthday; unknown years are refused. */
export function isAdultByBirthYear(birthYear: unknown, nowMs: number): boolean {
  if (typeof birthYear !== 'number' || !Number.isInteger(birthYear)) return false;
  return new Date(nowMs).getUTCFullYear() - birthYear > ADULT_AGE_YEARS;
}
