import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
} from 'payload';
import { nobody, type StaffRole, staffRoles } from './access/roles.ts';
import type { AuditAction } from './audit/codes.ts';
import { auditReveal, revealOnly } from './audit/reveal.ts';
import { writeAuditEvent } from './audit/writeAuditEvent.ts';
import { isConsentRequired, MIN_BIRTH_YEAR } from './core.ts';
import { RecordError } from './errors.ts';
import { asRecord, assertUnchanged, mergeWrite } from './guards.ts';

export const GUARDIAN_CONSENTS_SLUG = 'guardian-consents';

export const CONSENT_READERS: readonly StaffRole[] = ['ops', 'consent'];

/**
 * `ConsentStatusSchema` (`packages/core/schemas/caller.ts`) minus
 * `not-required`, plus `expired` (ADR 0001: an unanswered request lapses at
 * `expiresAt`). TODO(core): a `GuardianConsentStatusSchema` in @acme/core.
 */
export const GUARDIAN_CONSENT_STATUSES = ['pending', 'approved', 'denied', 'expired'] as const;

export type GuardianConsentStatus = (typeof GUARDIAN_CONSENT_STATUSES)[number];

/** What a parent has asked for under 16 CFR 312.6. */
export const PARENT_REQUESTS = ['none', 'review', 'delete'] as const;

/** Fields set when the consent is requested; a different parent or year is a new record. */
export const CONSENT_IMMUTABLE_FIELDS = ['parentEmail', 'birthYear'] as const;

const STATUS_ACTIONS: Readonly<Record<Exclude<GuardianConsentStatus, 'pending'>, AuditAction>> = {
  approved: 'consent.approved',
  denied: 'consent.denied',
  expired: 'consent.expired',
};

function isStatus(value: unknown): value is GuardianConsentStatus {
  return typeof value === 'string' && (GUARDIAN_CONSENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Only an under-13 year belongs here (ADR 0001), status moves once from
 * `pending`, and the email counter never goes down.
 */
export const validateConsent: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  const incoming = asRecord(data);
  const stored = asRecord(originalDoc);
  const merged = mergeWrite(incoming, stored);
  const nowMs = Date.now();
  const currentYear = new Date(nowMs).getUTCFullYear();
  const birthYear = merged.birthYear;
  if (
    typeof birthYear !== 'number' ||
    !Number.isInteger(birthYear) ||
    birthYear < MIN_BIRTH_YEAR ||
    birthYear > currentYear
  ) {
    throw new RecordError('INVALID_RECORD', 'consent.birthYear must be a plausible year');
  }
  if (operation === 'create' && !isConsentRequired({ birthYear, nowMs })) {
    throw new RecordError('INVALID_RECORD', 'consent.birthYear does not need guardian consent');
  }
  if (!isStatus(merged.status)) throw new RecordError('INVALID_RECORD', 'consent.status is not a known status');
  const emailsSent = merged.emailsSent ?? 0;
  if (typeof emailsSent !== 'number' || !Number.isInteger(emailsSent) || emailsSent < 0) {
    throw new RecordError('INVALID_RECORD', 'consent.emailsSent must be a non-negative integer');
  }
  if (operation === 'create' && merged.status !== 'pending') {
    throw new RecordError('INVALID_TRANSITION', 'a consent request starts pending');
  }
  if (operation === 'update' && stored !== undefined) {
    assertUnchanged(CONSENT_IMMUTABLE_FIELDS, incoming, stored, 'consent');
    if (stored.status !== 'pending' && merged.status !== stored.status) {
      throw new RecordError('INVALID_TRANSITION', `consent is ${String(stored.status)} and cannot change status`);
    }
    if (typeof stored.emailsSent === 'number' && emailsSent < stored.emailsSent) {
      throw new RecordError('INVALID_TRANSITION', 'consent.emailsSent never decreases');
    }
  }
  return data;
};

/** Request, decision, expiry and each consent mail leave an audit event. */
export const auditConsentChange: CollectionAfterChangeHook = async ({ doc, operation, previousDoc, req }) => {
  const after = asRecord(doc);
  if (after === undefined) return doc;
  const targetId = String(after.id);
  if (operation === 'create') {
    await writeAuditEvent(req, { action: 'consent.requested', targetType: 'consent', targetId });
    return doc;
  }
  const before = asRecord(previousDoc);
  if (before === undefined) return doc;
  if (before.status !== after.status && isStatus(after.status) && after.status !== 'pending') {
    await writeAuditEvent(req, { action: STATUS_ACTIONS[after.status], targetType: 'consent', targetId });
  }
  if (typeof after.emailsSent === 'number' && after.emailsSent > Number(before.emailsSent ?? 0)) {
    await writeAuditEvent(req, { action: 'consent.email_sent', targetType: 'consent', targetId });
  }
  return doc;
};

/**
 * The deletion receipt (01-research.md risk 2): actor, time, record type, id
 * and reason code, never the parent's email or the child's birth year.
 */
export const auditConsentDelete: CollectionAfterDeleteHook = async ({ id, req }) => {
  await writeAuditEvent(req, { action: 'consent.deleted', targetType: 'consent', targetId: String(id) });
};

/**
 * Guardian consent requests for under-13 Callers (ADR 0001 "Age and consent").
 * Holds only what 16 CFR 312.5(c)(1) allows to seek consent: no child email,
 * no name, and no free-text field of any kind (D-A2). Written and deleted only
 * by server code (sign-up, consent link, expiry job, console endpoints); a
 * denied or expired record is deleted, which leaves a `consent.deleted` receipt.
 */
export const GuardianConsents: CollectionConfig = {
  slug: GUARDIAN_CONSENTS_SLUG,
  admin: {
    hidden: true,
    components: {
      views: {
        list: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/consent' } } },
        edit: { root: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/consent' } } } },
      },
    },
  },
  access: {
    read: staffRoles(CONSENT_READERS),
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  indexes: [{ fields: ['status', 'expiresAt'] }],
  hooks: {
    beforeChange: [validateConsent],
    afterChange: [auditConsentChange],
    afterRead: [
      auditReveal({
        collection: GUARDIAN_CONSENTS_SLUG,
        maskedFields: CONSENT_IMMUTABLE_FIELDS,
        action: 'consent.value_shown',
        targetType: 'consent',
        targetIdOf: (doc) => String(doc.id),
      }),
    ],
    afterDelete: [auditConsentDelete],
  },
  fields: [
    {
      name: 'parentEmail',
      type: 'email',
      required: true,
      access: { read: revealOnly(GUARDIAN_CONSENTS_SLUG, 'parentEmail', CONSENT_READERS) },
    },
    {
      name: 'birthYear',
      type: 'number',
      required: true,
      min: MIN_BIRTH_YEAR,
      access: { read: revealOnly(GUARDIAN_CONSENTS_SLUG, 'birthYear', CONSENT_READERS) },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [...GUARDIAN_CONSENT_STATUSES],
    },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'emailsSent', type: 'number', required: true, defaultValue: 0, min: 0 },
    { name: 'lastEmailSentAt', type: 'date' },
    { name: 'parentRequest', type: 'select', required: true, defaultValue: 'none', options: [...PARENT_REQUESTS] },
  ],
};
