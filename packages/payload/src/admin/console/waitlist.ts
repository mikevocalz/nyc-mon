import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import * as z from 'zod';
import {
  normalizeWaitlistEmail,
  WAITLIST_DISTRICTS,
  WAITLIST_EMAIL_MAX_LENGTH,
  WAITLIST_SLUG,
  WAITLIST_SOURCE_MAX_LENGTH,
} from '../../collections/Waitlist.ts';
import { withIdempotency } from './v1/idempotency.ts';
import type { V1Handler } from './v1/idempotency.ts';

/**
 * Response bodies of `POST /v1/waitlist`. `status` is the stable discriminant
 * the web form maps to copy; nothing else in a body is part of the contract.
 *
 * | HTTP | body                                   | when                                    |
 * | ---- | -------------------------------------- | --------------------------------------- |
 * | 200  | `{ status: 'joined' }`                 | new row, repeat email, or honeypot hit  |
 * | 422  | `{ status: 'under13' }`                | `ageConfirmed: false`; nothing stored   |
 * | 400  | `{ status: 'invalid', field: 'email' }`| the address fails validation            |
 * | 400  | `{ status: 'invalid' }`                | bad JSON or body shape                  |
 * | 429  | `{ status: 'rate_limited' }`           | over the per-IP hourly budget           |
 * | 500  | `{ status: 'error' }`                  | anything unexpected; details only in logs|
 */
export type WaitlistResponseBody =
  | { status: 'joined' }
  | { status: 'under13' }
  | { status: 'invalid'; field?: 'email' }
  | { status: 'rate_limited' }
  | { status: 'error' };

/** Attempts one client IP may make per clock hour before it gets 429. */
export const WAITLIST_MAX_ATTEMPTS_PER_HOUR = 20;

/** Prefix of the limiter rows in the Better Auth `verifications` table. */
export const WAITLIST_RATE_KEY_PREFIX = 'waitlist-ip';

const VERIFICATIONS_SLUG = 'verifications';
const HOUR_MS = 3_600_000;

/** Test seams. Real callers use {@link handleJoinWaitlist} and leave these unset. */
export interface JoinWaitlistOptions {
  /** The Payload instance; defaults to the live one from `payload.config.ts`. */
  payload?: Payload;
  /** HMAC key for client-IP hashes; defaults to `PAYLOAD_SECRET`. */
  ipHashSecret?: string;
  /** Shared secret that lets `apps/web` vouch for the visitor IP; defaults to `WAITLIST_FORWARD_SECRET`. */
  forwardSecret?: string;
  /** Clock for the hourly limiter window. */
  nowMs?: () => number;
  /** Per-IP hourly budget; defaults to {@link WAITLIST_MAX_ATTEMPTS_PER_HOUR}. */
  maxAttemptsPerHour?: number;
}

const BodySchema = z.object({
  // Checked separately below so a bad address can answer `field: 'email'`.
  email: z.string().max(1024),
  ageConfirmed: z.boolean(),
  district: z.enum(WAITLIST_DISTRICTS).optional(),
  source: z
    .string()
    .max(WAITLIST_SOURCE_MAX_LENGTH)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  website: z.string().max(1024).optional(),
});

/**
 * zod's `email` format (an HTML-spec-like pattern: one `@`, a dotted domain
 * with a TLD, no spaces or quoted locals), after trimming and lowercasing.
 */
const EmailSchema = z.string().trim().toLowerCase().max(WAITLIST_EMAIL_MAX_LENGTH).pipe(z.email());

function reply(status: number, body: WaitlistResponseBody): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function livePayload(): Promise<Payload> {
  const { default: config } = await import('../../payload.config.ts');
  return getPayload({ config });
}

/** Visitor IP vouched for by `apps/web`; trusted only with {@link FORWARD_SECRET_HEADER}. */
export const FORWARDED_CLIENT_IP_HEADER = 'x-nycmon-client-ip';

/** Carries `WAITLIST_FORWARD_SECRET` from the `apps/web` server action. */
export const FORWARD_SECRET_HEADER = 'x-nycmon-forward-secret';

/**
 * Constant-time equality. Both sides are SHA-256'd first so the buffers
 * `timingSafeEqual` compares are always 32 bytes and the secret's length
 * doesn't leak through an early length check.
 */
function secretsMatch(sent: string, expected: string): boolean {
  const a = createHash('sha256').update(sent).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * The address the limiter keys on. When the request carries
 * `x-nycmon-forward-secret` equal to `WAITLIST_FORWARD_SECRET`, it comes from
 * the `apps/web` server action and `x-nycmon-client-ip` names the visitor.
 * An unset secret never trusts the header. Every other request is keyed on
 * its own peer as admin-vite's edge reported it ({@link readClientIp}).
 */
export function resolveClientIp(headers: Headers, forwardSecret: string | undefined): string {
  if (forwardSecret !== undefined && forwardSecret !== '') {
    const sent = headers.get(FORWARD_SECRET_HEADER);
    const vouched = headers.get(FORWARDED_CLIENT_IP_HEADER)?.trim();
    if (sent !== null && vouched !== undefined && vouched !== '' && secretsMatch(sent, forwardSecret)) {
      return vouched;
    }
  }
  return readClientIp(headers);
}

/**
 * The direct caller's address as admin-vite's edge reported it: the first
 * entry of `X-Forwarded-For`, else `X-Real-IP`, else `unknown` (one shared
 * bucket). On Vercel the edge overwrites `X-Forwarded-For`, so this is the
 * real peer; for the `apps/web` server action that peer is the web server,
 * which is why web vouches for the visitor with {@link FORWARDED_CLIENT_IP_HEADER}.
 */
export function readClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first !== undefined && first !== '') return first;
  const real = headers.get('x-real-ip')?.trim();
  if (real !== undefined && real !== '') return real;
  return 'unknown';
}

/**
 * HMAC-SHA256 of the IP under a server secret. A plain hash of an IPv4
 * address is reversible by trying all 2^32 of them; the keyed hash is not
 * without the secret. The raw IP is never written anywhere.
 */
export function hashClientIp(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(ip).digest('hex');
}

/** `waitlist-ip:<hmac>:2026-10-07T14` — one counter per IP per UTC hour. */
export function rateLimitIdentifier(ipHash: string, nowMs: number): string {
  return `${WAITLIST_RATE_KEY_PREFIX}:${ipHash}:${new Date(nowMs).toISOString().slice(0, 13)}`;
}

/**
 * Counts this attempt against the IP's hourly budget and reports whether it
 * is over. Same counter shape as `auth/sms-quota.ts`: a row in Better Auth's
 * `verifications` table whose `value` is the count and whose `expiresAt`
 * closes the window. Not atomic under concurrent requests; the overshoot is a
 * request or two.
 */
async function overHourlyBudget(payload: Payload, identifier: string, max: number, nowMs: number): Promise<boolean> {
  const found = await payload.find({
    collection: VERIFICATIONS_SLUG,
    where: { identifier: { equals: identifier } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const row = found.docs[0] as { id: string | number; value?: unknown } | undefined;
  const used = row === undefined ? 0 : Number.parseInt(String(row.value), 10) || 0;
  if (used >= max) return true;
  if (row === undefined) {
    await payload.create({
      collection: VERIFICATIONS_SLUG,
      data: { identifier, value: '1', expiresAt: new Date(nowMs + 2 * HOUR_MS).toISOString() },
      overrideAccess: true,
    });
  } else {
    await payload.update({
      collection: VERIFICATIONS_SLUG,
      id: row.id,
      data: { value: String(used + 1) },
      overrideAccess: true,
    });
  }
  return false;
}

async function emailExists(payload: Payload, email: string): Promise<boolean> {
  const found = await payload.find({
    collection: WAITLIST_SLUG,
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  return found.docs.length > 0;
}

/**
 * Builds the `POST /v1/waitlist` handler. The order of checks is the
 * contract: rate limit, JSON, honeypot, shape, age, email, write. The age
 * answer is read before the address, so an under-13 email is never parsed,
 * looked up or stored (ADR 0001).
 */
export function createJoinWaitlistHandler(options: JoinWaitlistOptions = {}): V1Handler<[]> {
  const now = options.nowMs ?? Date.now;
  const max = options.maxAttemptsPerHour ?? WAITLIST_MAX_ATTEMPTS_PER_HOUR;

  async function joinWaitlist(request: Request): Promise<Response> {
    let payload: Payload | undefined = options.payload;
    try {
      if (payload === undefined) payload = await livePayload();

      const secret = options.ipHashSecret ?? process.env.PAYLOAD_SECRET ?? '';
      if (secret === '') throw new Error('PAYLOAD_SECRET is required to hash client IPs');
      const nowMs = now();
      const forwardSecret = options.forwardSecret ?? process.env.WAITLIST_FORWARD_SECRET;
      const clientIp = resolveClientIp(request.headers, forwardSecret);
      const identifier = rateLimitIdentifier(hashClientIp(clientIp, secret), nowMs);
      if (await overHourlyBudget(payload, identifier, max, nowMs)) {
        return reply(429, { status: 'rate_limited' });
      }

      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return reply(400, { status: 'invalid' });
      }

      // Honeypot: a person never sees `website`; a bot that fills it gets the
      // success body and nothing is stored.
      if (typeof raw === 'object' && raw !== null && 'website' in raw) {
        const website = (raw as { website?: unknown }).website;
        if (typeof website === 'string' && website.trim() !== '') return reply(200, { status: 'joined' });
      }

      const body = BodySchema.safeParse(raw);
      if (!body.success) return reply(400, { status: 'invalid' });

      if (!body.data.ageConfirmed) return reply(422, { status: 'under13' });

      const email = EmailSchema.safeParse(body.data.email);
      if (!email.success) return reply(400, { status: 'invalid', field: 'email' });
      const address = normalizeWaitlistEmail(email.data);

      // A repeat address gets the same body as a new one, so the endpoint
      // never says who has signed up, and no second row is written.
      if (await emailExists(payload, address)) return reply(200, { status: 'joined' });

      try {
        await payload.create({
          collection: WAITLIST_SLUG,
          data: { email: address, district: body.data.district, source: body.data.source },
          overrideAccess: true,
        });
      } catch (error) {
        // A concurrent sign-up with the same address won the unique index.
        if (await emailExists(payload, address)) return reply(200, { status: 'joined' });
        throw error;
      }
      return reply(200, { status: 'joined' });
    } catch (error) {
      if (payload !== undefined) {
        payload.logger.error({ err: error }, '[waitlist] sign-up failed');
      } else {
        console.error('[waitlist] sign-up failed', error);
      }
      return reply(500, { status: 'error' });
    }
  }

  // Anonymous: there is no account. A retried request with the same
  // Idempotency-Key replays the first answer (ADR 0001 §1.4).
  return withIdempotency(joinWaitlist, { scope: 'anonymous', payload: options.payload });
}

/**
 * Handles `POST /v1/waitlist` from the `apps/web` server action (PS-001).
 * See {@link WaitlistResponseBody} for every answer it gives.
 */
export const handleJoinWaitlist = createJoinWaitlistHandler();
