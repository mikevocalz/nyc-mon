import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook, CollectionConfig } from 'payload';
import { nobody, staffRoles } from './access/roles.ts';
import { RecordError } from './errors.ts';
import { asRecord, assertUnchanged, mergeWrite } from './guards.ts';

export const WAITLIST_SLUG = 'waitlist';

/** The four Phase 1 districts a sign-up may name (PS-001). */
export const WAITLIST_DISTRICTS = ['downtown', 'midtown', 'harlem', 'megacity'] as const;

export type WaitlistDistrict = (typeof WAITLIST_DISTRICTS)[number];

/** Longest `source` tag a form may send, e.g. `home` or `get`. */
export const WAITLIST_SOURCE_MAX_LENGTH = 32;

/** RFC 5321 caps a forward path at 254 characters. */
export const WAITLIST_EMAIL_MAX_LENGTH = 254;

/** Trims and lowercases an address so one inbox maps to one row. */
export function normalizeWaitlistEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Normalizes `email` before Payload's own field validation runs. */
export const normalizeWaitlistEntry: CollectionBeforeValidateHook = ({ data }) => {
  if (data !== undefined && typeof data.email === 'string') {
    data.email = normalizeWaitlistEmail(data.email);
  }
  return data;
};

/** An entry keeps the address it was created with; a new address is a new row. */
export const validateWaitlistEntry: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  const incoming = asRecord(data);
  const stored = asRecord(originalDoc);
  const merged = mergeWrite(incoming, stored);
  const email = merged.email;
  if (typeof email !== 'string' || email === '' || email.length > WAITLIST_EMAIL_MAX_LENGTH) {
    throw new RecordError('INVALID_RECORD', 'waitlist.email must be an address of at most 254 characters');
  }
  if (email !== normalizeWaitlistEmail(email)) {
    throw new RecordError('INVALID_RECORD', 'waitlist.email must be trimmed and lowercase');
  }
  if (operation === 'update') assertUnchanged(['email'], incoming, stored, 'waitlist');
  return data;
};

/**
 * Launch waitlist sign-ups from the marketing site (PS-001). Rows are written
 * only by `POST /v1/waitlist` (`admin/console/waitlist.ts`) through the Local
 * API with `overrideAccess: true`; no request may create or edit one. `ops`
 * reads the list and deletes a row on an erasure request.
 *
 * Every row belongs to someone who said they are 13 or older: an under-13
 * answer stores nothing (ADR 0001), so this collection never holds a child's
 * address. `versions: false` opts out of the canary's versions-by-default.
 */
export const Waitlist: CollectionConfig = {
  slug: WAITLIST_SLUG,
  admin: { hidden: true, useAsTitle: 'email' },
  versions: false,
  timestamps: true,
  access: {
    read: staffRoles(['ops']),
    create: nobody,
    update: nobody,
    delete: staffRoles(['ops']),
  },
  hooks: {
    beforeValidate: [normalizeWaitlistEntry],
    beforeChange: [validateWaitlistEntry],
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'district', type: 'select', options: [...WAITLIST_DISTRICTS] },
    { name: 'source', type: 'text', maxLength: WAITLIST_SOURCE_MAX_LENGTH },
  ],
};
