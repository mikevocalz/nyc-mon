import type { PayloadRequest } from 'payload';
import { sendMail } from '../../../auth/options.ts';
import { guardianConsentMail } from '../../../auth/templates.ts';
import { AUDIT_REASON_CONTEXT_KEY } from '../../../collections/audit/writeAuditEvent.ts';
import {
  applyConsentDecision,
  consentBlock,
  findConsentRecord,
  isConsentDecision,
} from '../consent-decision.ts';
import { CONSENT_DECISIONS_ENABLED, CONSENT_RESEND_LOCKOUT_MS, CONSENT_RETENTION_DAYS } from '../features.ts';
import { ConsoleError } from './errors.ts';
import { idParam, readBody, readReasonCode, requireStaff, withTransaction } from './helpers.ts';

const CONSENT_MANAGER_ROLES = ['ops', 'consent'] as const;
const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:5174';

async function loadConsent(req: PayloadRequest, id: string): Promise<Record<string, unknown>> {
  const doc = await findConsentRecord(req.payload, req, id);
  if (doc === null) {
    throw new ConsoleError('NOT_FOUND', 404, 'Consent request not found.');
  }
  return doc;
}

function consentUpdatedAt(doc: Record<string, unknown>): string | undefined {
  const value = doc.updatedAt;
  return typeof value === 'string' ? value : undefined;
}

function assertUnchanged(doc: Record<string, unknown>, expectedUpdatedAt: unknown): void {
  if (expectedUpdatedAt === undefined) return;
  if (consentUpdatedAt(doc) !== expectedUpdatedAt) {
    throw new ConsoleError('RECORD_CHANGED', 409, 'The consent request was changed by someone else.');
  }
}

function setReasonContext(req: PayloadRequest, reasonCode: string | undefined): void {
  if (reasonCode !== undefined) {
    req.context[AUDIT_REASON_CONTEXT_KEY] = reasonCode;
  }
}

function confirmCodeFor(id: string): string {
  return id.slice(-6);
}

export async function resendConsentEmail(req: PayloadRequest): Promise<Response> {
  requireStaff(req, CONSENT_MANAGER_ROLES);
  const id = idParam(req);

  return withTransaction(req, async () => {
    const consent = await loadConsent(req, id);
    if (consent.status !== 'pending') {
      throw new ConsoleError('NOT_PENDING', 409, 'Only pending consent requests can be resent.');
    }

    const lastSent = consent.lastEmailSentAt;
    const now = Date.now();
    if (typeof lastSent === 'string') {
      const unlocksAt = Date.parse(lastSent) + CONSENT_RESEND_LOCKOUT_MS;
      if (now < unlocksAt) {
        throw new ConsoleError('RESEND_LOCKED', 429, 'Resend is locked.', {
          unlocksAt: new Date(unlocksAt).toISOString(),
        });
      }
    }

    if (sendMail === undefined) {
      throw new ConsoleError('EMAIL_DISABLED', 503, 'Email sending is not configured.');
    }

    const parentEmail = consent.parentEmail;
    if (typeof parentEmail !== 'string') {
      throw new ConsoleError('INVALID_RECORD', 500, 'Consent request has no parent email.');
    }

    await sendMail({
      to: parentEmail,
      ...guardianConsentMail(Number(consent.id), CONSENT_RETENTION_DAYS, baseURL),
    });

    const lastEmailSentAt = new Date().toISOString();
    const emailsSent = typeof consent.emailsSent === 'number' ? consent.emailsSent + 1 : 1;

    const updated = await req.payload.update({
      collection: 'guardian-consents',
      id: consent.id as string | number,
      data: { emailsSent, lastEmailSentAt },
      depth: 0,
      overrideAccess: true,
      req,
    });

    return Response.json({
      lastEmailSentAt:
        ((updated as unknown as Record<string, unknown>).lastEmailSentAt as string | undefined) ?? lastEmailSentAt,
    });
  });
}

export async function deleteConsentRecord(req: PayloadRequest): Promise<Response> {
  requireStaff(req, CONSENT_MANAGER_ROLES);
  const id = idParam(req);
  const body = await readBody(req);

  return withTransaction(req, async () => {
    const consent = await loadConsent(req, id);
    const confirmText = body?.confirmText;
    if (typeof confirmText !== 'string' || confirmText.trim() !== confirmCodeFor(id)) {
      throw new ConsoleError('CONFIRM_MISMATCH', 400, 'The confirmation text does not match.');
    }

    const reasonCode = readReasonCode(body);
    setReasonContext(req, reasonCode);

    await req.payload.delete({
      collection: 'guardian-consents',
      id: consent.id as string | number,
      overrideAccess: true,
      req,
    });

    const receipt = await req.payload.find({
      collection: 'audit-events',
      where: {
        action: { equals: 'consent.deleted' },
        targetType: { equals: 'consent' },
        targetId: { equals: String(consent.id) },
      },
      limit: 1,
      sort: '-at',
      depth: 0,
      overrideAccess: true,
      req,
    });

    const receiptEventId =
      receipt.docs[0] !== undefined ? Number((receipt.docs[0] as unknown as Record<string, unknown>).id) : null;

    return Response.json({ receiptEventId });
  });
}

export async function decideConsent(req: PayloadRequest): Promise<Response> {
  requireStaff(req, CONSENT_MANAGER_ROLES);
  if (!CONSENT_DECISIONS_ENABLED) {
    throw new ConsoleError('NOT_FOUND', 404, 'Consent decisions are not enabled.');
  }
  const id = idParam(req);
  const body = await readBody(req);

  return withTransaction(req, async () => {
    const consent = await loadConsent(req, id);
    assertUnchanged(consent, body?.expectedUpdatedAt);

    const decision = body?.decision;
    if (!isConsentDecision(decision)) {
      throw new ConsoleError('INVALID_RECORD', 400, 'decision must be "approve" or "deny".');
    }
    // `consentBlock` is shared with the parent's email link, so a decided or
    // lapsed request is closed to everyone; `parentRequest === 'review'` is
    // the staff-only gate for the B3 needs-review lane.
    if (consentBlock(consent) !== null || consent.parentRequest !== 'review') {
      throw new ConsoleError('NOT_REVIEWABLE', 409, 'This consent request is not awaiting a decision.');
    }

    const reasonCode = readReasonCode(body);
    setReasonContext(req, reasonCode);

    const status = await applyConsentDecision(req.payload, req, consent, decision);

    return Response.json({ status });
  });
}
