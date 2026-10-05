/**
 * The rules a consent decision answers to, shared by the staff console
 * endpoint (`endpoints/consents.ts` `decideConsent`) and the anonymous parent
 * link (`guardian-consent.ts` `handleGuardianConsentDecision`). They live in
 * one module so the two paths cannot drift apart: a request is answerable
 * only while `pending` and inside `expiresAt`, and both answers flip
 * `status` the same way.
 *
 * The staff path adds its own gates on top — `requireStaff`, `parentRequest
 * === 'review'` (the B3 needs-review lane), `expectedUpdatedAt` and a reason
 * code — because a staff decision is an auditable staff act. The parent's
 * email link is itself the capability and needs none of them.
 */
import type { Payload, PayloadRequest } from 'payload';
import { GUARDIAN_CONSENTS_SLUG } from '../../collections/GuardianConsents.ts';

/** The two answers the parent email offers (`?decision=` in auth/templates.ts). */
export type ConsentDecision = 'approve' | 'deny';

export function isConsentDecision(value: unknown): value is ConsentDecision {
  return value === 'approve' || value === 'deny';
}

/** Each answer maps to the terminal status the consent record carries. */
export function decisionToStatus(decision: ConsentDecision): 'approved' | 'denied' {
  return decision === 'approve' ? 'approved' : 'denied';
}

/** Loads a consent by its route id; numeric ids reach Postgres as numbers. */
export async function findConsentRecord(
  payload: Payload,
  req: PayloadRequest,
  id: string,
): Promise<Record<string, unknown> | null> {
  const numeric = Number(id);
  const doc = await payload.findByID({
    collection: GUARDIAN_CONSENTS_SLUG,
    id: Number.isNaN(numeric) ? id : numeric,
    depth: 0,
    overrideAccess: true,
    req,
  });
  return doc === null || doc === undefined ? null : (doc as unknown as Record<string, unknown>);
}

/** Why a consent can no longer be answered, or `null` while it still can. */
export type ConsentBlock = 'not-reviewable' | 'expired';

export function consentBlock(consent: Record<string, unknown>, nowMs: number = Date.now()): ConsentBlock | null {
  if (consent.status !== 'pending') return 'not-reviewable';
  const expiresAt = typeof consent.expiresAt === 'string' ? Date.parse(consent.expiresAt) : Number.NaN;
  if (Number.isFinite(expiresAt) && expiresAt <= nowMs) return 'expired';
  return null;
}

/**
 * Flips a pending consent to its decided status; the collection hooks write
 * the `consent.approved` / `consent.denied` audit event. There is no
 * `decidedAt` field — `updatedAt` carries the decision time.
 */
export async function applyConsentDecision(
  payload: Payload,
  req: PayloadRequest,
  consent: Record<string, unknown>,
  decision: ConsentDecision,
): Promise<'approved' | 'denied'> {
  const status = decisionToStatus(decision);
  await payload.update({
    collection: GUARDIAN_CONSENTS_SLUG,
    id: consent.id as string | number,
    data: { status },
    depth: 0,
    overrideAccess: true,
    req,
  });
  return status;
}

/**
 * Closes out an unanswered request past `expiresAt`, as 16 CFR 312.5(c)(1)
 * requires: `status` moves to `expired` (the `consent.expired` audit event),
 * then the record — parent email included — is deleted, leaving the
 * `consent.deleted` receipt.
 */
export async function expireConsentRecord(
  payload: Payload,
  req: PayloadRequest,
  consent: Record<string, unknown>,
): Promise<void> {
  await payload.update({
    collection: GUARDIAN_CONSENTS_SLUG,
    id: consent.id as string | number,
    data: { status: 'expired' },
    depth: 0,
    overrideAccess: true,
    req,
  });
  await payload.delete({
    collection: GUARDIAN_CONSENTS_SLUG,
    id: consent.id as string | number,
    overrideAccess: true,
    req,
  });
}
