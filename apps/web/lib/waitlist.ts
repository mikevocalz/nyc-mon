// Server-only: reads ADMIN_API_URL and WAITLIST_FORWARD_SECRET, which have no
// NEXT_PUBLIC_ prefix and so are
// never inlined into a client bundle. The only importer is the 'use server'
// action in app/(site)/get/actions.ts. (`server-only` isn't a dependency of
// apps/web; add it and `import 'server-only'` here if a client file ever needs
// guarding against this import.)

/** The districts the sign-up form offers; mirrors `WAITLIST_DISTRICTS` in @acme/payload. */
export const WAITLIST_DISTRICTS = ['downtown', 'midtown', 'harlem', 'megacity'] as const;

export type WaitlistDistrict = (typeof WAITLIST_DISTRICTS)[number];

/** Every outcome of {@link joinWaitlist}; the form maps `status` to copy. */
export type WaitlistResult =
  | { status: 'joined' }
  | { status: 'under13' }
  | { status: 'invalid'; field?: 'email' }
  | { status: 'rate_limited' }
  | { status: 'error' };

export type WaitlistStatus = WaitlistResult['status'];

/** What the form collected. */
export interface WaitlistInput {
  email: string;
  /** The visitor answered "13 or older". */
  ageConfirmed: boolean;
  district?: WaitlistDistrict;
  /** Which page the form sits on, e.g. `home` or `get`. */
  source?: string;
  /** Honeypot; empty for a person. */
  website?: string;
  /**
   * The visitor's IP. Sent as `x-nycmon-client-ip` with the forward secret so
   * admin-vite rate-limits per visitor, not per web server.
   */
  clientIp?: string;
}

/** Test seams; production callers pass nothing. */
export interface JoinWaitlistOptions {
  /** Defaults to `process.env.ADMIN_API_URL`, read per call. */
  adminApiUrl?: string;
  fetchImpl?: typeof fetch;
  /** Defaults to {@link WAITLIST_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Defaults to `process.env.WAITLIST_FORWARD_SECRET`, read per call. */
  forwardSecret?: string;
}

/** Visitor IP admin-vite trusts only alongside {@link FORWARD_SECRET_HEADER}. */
export const FORWARDED_CLIENT_IP_HEADER = 'x-nycmon-client-ip';

// Without the secret every visitor shares one rate-limit bucket keyed on this
// server's address, so a single script can lock real sign-ups out.
let warnedMissingSecret = false;
function warnMissingSecret() {
  if (warnedMissingSecret) return;
  warnedMissingSecret = true;
  console.error('[waitlist] WAITLIST_FORWARD_SECRET is not set; all visitors share one rate-limit bucket.');
}

/** Carries `WAITLIST_FORWARD_SECRET`; mirrors the handler in @acme/payload. */
export const FORWARD_SECRET_HEADER = 'x-nycmon-forward-secret';

export const WAITLIST_TIMEOUT_MS = 5000;

function isDistrict(value: unknown): value is WaitlistDistrict {
  return typeof value === 'string' && (WAITLIST_DISTRICTS as readonly string[]).includes(value);
}

/** Narrows a form value to a district, or `undefined` for blank or unknown. */
export function toWaitlistDistrict(value: unknown): WaitlistDistrict | undefined {
  return isDistrict(value) ? value : undefined;
}

/**
 * Maps the admin response to a {@link WaitlistResult}. A body whose `status`
 * doesn't agree with the HTTP code is treated as an error, so a proxy page or
 * a changed contract never reads as a sign-up.
 */
export function mapWaitlistResponse(httpStatus: number, body: unknown): WaitlistResult {
  if (httpStatus === 429) return { status: 'rate_limited' };
  const status = typeof body === 'object' && body !== null ? (body as { status?: unknown }).status : undefined;
  if (httpStatus === 200 && status === 'joined') return { status: 'joined' };
  if (httpStatus === 422 && status === 'under13') return { status: 'under13' };
  if (httpStatus === 400 && status === 'invalid') {
    const field = (body as { field?: unknown }).field;
    return field === 'email' ? { status: 'invalid', field: 'email' } : { status: 'invalid' };
  }
  return { status: 'error' };
}

/**
 * Sends a sign-up to `POST ${ADMIN_API_URL}/v1/waitlist` (PS-001). Never
 * throws: a missing URL, a network failure, a 5 s timeout or an unexpected
 * answer all resolve to `{ status: 'error' }`.
 */
export async function joinWaitlist(input: WaitlistInput, options: JoinWaitlistOptions = {}): Promise<WaitlistResult> {
  const base = (options.adminApiUrl ?? process.env.ADMIN_API_URL ?? '').trim().replace(/\/+$/, '');
  if (base === '') {
    console.error('[waitlist] ADMIN_API_URL is not set');
    return { status: 'error' };
  }
  const doFetch = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  // Without the secret, admin-vite would ignore a vouched IP anyway, so send
  // neither header and let it key on this server's own address.
  const forwardSecret = options.forwardSecret ?? process.env.WAITLIST_FORWARD_SECRET ?? '';
  if (forwardSecret === '' && process.env.NODE_ENV === 'production') warnMissingSecret();
  if (forwardSecret !== '' && input.clientIp !== undefined && input.clientIp !== '') {
    headers[FORWARDED_CLIENT_IP_HEADER] = input.clientIp;
    headers[FORWARD_SECRET_HEADER] = forwardSecret;
  }

  try {
    const response = await doFetch(`${base}/v1/waitlist`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: input.email,
        ageConfirmed: input.ageConfirmed,
        district: input.district,
        source: input.source,
        website: input.website,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? WAITLIST_TIMEOUT_MS),
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    const result = mapWaitlistResponse(response.status, body);
    if (result.status === 'error') console.error(`[waitlist] admin answered ${response.status}`);
    return result;
  } catch (error) {
    console.error('[waitlist] request failed', error instanceof Error ? error.name : 'unknown');
    return { status: 'error' };
  }
}
