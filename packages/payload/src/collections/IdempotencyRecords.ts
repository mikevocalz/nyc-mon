import type { CollectionConfig } from 'payload';
import { nobody } from './access/roles.ts';

export const IDEMPOTENCY_RECORDS_SLUG = 'idempotency-records';

/**
 * Stored first responses for `Idempotency-Key` requests on mutating `/v1`
 * endpoints (ADR 0001: "a retried request returns the first response").
 * Server code alone reads and writes it with `overrideAccess: true`
 * (`admin/console/v1/idempotency.ts`); nothing here is a console surface and
 * rows are never edited by a request, so access denies everyone.
 *
 * `versions: false` opts out of this Payload canary's versions-on-by-default
 * (`collections/config/defaults.js`): a replay row has no history to keep.
 */
export const IdempotencyRecords: CollectionConfig = {
  slug: IDEMPOTENCY_RECORDS_SLUG,
  admin: { hidden: true },
  versions: false,
  access: {
    read: nobody,
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  fields: [
    // Scoped storage key: `caller:<id>` (or `anonymous`), `METHOD /path`, then
    // the client-sent key, pipe-joined. Putting caller and endpoint inside the
    // unique column means two Callers — or two endpoints — may reuse a key
    // without colliding (ADR 0001 scopes a retry to its own call).
    { name: 'key', type: 'text', required: true, unique: true, maxLength: 512 },
    // `METHOD /path` again as its own column for diagnostics and clean-up.
    { name: 'path', type: 'text', required: true, index: true, maxLength: 256 },
    { name: 'status', type: 'number', required: true },
    { name: 'contentType', type: 'text', required: true, maxLength: 128 },
    // The exact response body text. Not `json`: Postgres jsonb normalizes key
    // order and whitespace, which would break the byte-identical replay.
    { name: 'body', type: 'text', required: true },
  ],
};
