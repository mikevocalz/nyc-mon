import type { CollectionBeforeDeleteHook } from 'payload';
import { RecordError } from './errors.ts';

/** The part of a zod schema these guards use; core schemas satisfy it. */
export interface SafeParser<T> {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } };
}

/**
 * Parses `value` with a core schema (Law 5) and throws `INVALID_RECORD` on
 * failure. The message names paths and rules only, never the rejected values.
 */
export function parseRecord<T>(schema: SafeParser<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const detail = result.error.issues
    .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  throw new RecordError('INVALID_RECORD', `${label} failed schema validation: ${detail}`);
}

/** The document as it will be after this write: stored values overlaid with the incoming ones. */
export function mergeWrite(
  data: Record<string, unknown> | undefined,
  originalDoc: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return { ...originalDoc, ...data };
}

/** Throws `IMMUTABLE_FIELD` when an update changes any of `fields`. */
export function assertUnchanged(
  fields: readonly string[],
  data: Record<string, unknown> | undefined,
  originalDoc: Record<string, unknown> | undefined,
  label: string,
): void {
  if (data === undefined || originalDoc === undefined) return;
  for (const field of fields) {
    if (field in data && data[field] !== originalDoc[field]) {
      throw new RecordError('IMMUTABLE_FIELD', `${label}.${field} cannot change after creation`);
    }
  }
}

/**
 * `beforeDelete` hook that refuses every delete, including server code running
 * with `overrideAccess: true` (hooks run regardless of access). Law 8: a Mon,
 * its egg and its care record are never deleted; ownership moves instead
 * (Decision #15).
 */
export function refuseDelete(label: string): CollectionBeforeDeleteHook {
  return () => {
    throw new RecordError('DELETE_FORBIDDEN', `${label} records are never deleted`);
  };
}

/** Plain-object narrowing for hook payloads typed `any` by Payload. */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}
