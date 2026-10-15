import { assertNever } from './assert-never.ts';
import { canonicaliseName, nameShapeRejection } from './name-rules.ts';

// M09 Mon naming rules: docs/design/screens/M09/08-handoff.md B4 and B5.
// Same character rule and length unit as the Caller name (M07). D-16h: no
// suggested names, no default name; the reserved list ships empty (Q17, PS-005).

/** Longest Mon nickname, in UTF-16 code units after trimming and NFC normalisation. */
export const MON_NAME_MAX_LENGTH = 16;

/**
 * Names the M09 field refuses as the Mon's nickname. Ships empty (D-16h): the
 * "Ratti" ruling and Q17 are open, and no name is reserved without a canon call.
 */
export const RESERVED_MON_NAMES: readonly string[] = [];

/** Why {@linkcode validateMonName} rejected a name. Map it to copy with {@linkcode monNameErrorCopyId}. */
export type MonNameRejection = 'blank' | 'too-long' | 'characters' | 'reserved' | 'blocked';

/** Result of {@linkcode validateMonName}. `name` is the trimmed, NFC-normalised value to store. */
export type MonNameResult =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly reason: MonNameRejection };

/** The platform block list (the same list M07 uses), loaded locally. */
export interface MonNameFilter {
  /** True when the trimmed, NFC-normalised `name` is on the block list. */
  isBlocked(name: string): boolean;
}

/** COPY_DECK ids for each {@linkcode MonNameRejection}. */
export type MonNameErrorCopyId =
  | 'm09.error.blank'
  | 'm09.error.too_long'
  | 'm09.error.characters'
  | 'm09.error.reserved'
  | 'm09.error.blocked';

/**
 * Checks a typed Mon nickname (M09). The first failing rule wins, in this order:
 *
 * 1. `blank`: no letter after trimming.
 * 2. `too-long`: more than {@linkcode MON_NAME_MAX_LENGTH} after trimming.
 * 3. `characters`: anything but letters, marks, space, `-`, `'`, `’`, `.`.
 * 4. `reserved`: on `reserved`, compared case-insensitively. Never fires while the list is empty.
 * 5. `blocked`: `filter.isBlocked` returned true.
 *
 * @param raw - the field's text, as typed or pasted.
 * @param filter - the block list. Required, so a build cannot ship without one wired.
 * @param reserved - reserved names; defaults to {@linkcode RESERVED_MON_NAMES} (empty).
 */
export function validateMonName(
  raw: string,
  filter: MonNameFilter,
  reserved: readonly string[] = RESERVED_MON_NAMES,
): MonNameResult {
  const name = canonicaliseName(raw);
  const rejection = nameShapeRejection(name, MON_NAME_MAX_LENGTH);
  if (rejection !== undefined) return { ok: false, reason: rejection };
  const folded = name.toLowerCase();
  if (reserved.some((r) => canonicaliseName(r).toLowerCase() === folded)) return { ok: false, reason: 'reserved' };
  if (filter.isBlocked(name)) return { ok: false, reason: 'blocked' };
  return { ok: true, name };
}

/**
 * True when `value` is a stored-form Mon nickname: canonical and passing every
 * shape rule. `MonNameSchema` refines with this, so the save rejects what M09 rejects.
 */
export function isStoredMonName(value: string): boolean {
  return value === canonicaliseName(value) && nameShapeRejection(value, MON_NAME_MAX_LENGTH) === undefined;
}

/** The COPY_DECK id for a {@linkcode MonNameRejection}, for the M09 error line. */
export function monNameErrorCopyId(reason: MonNameRejection): MonNameErrorCopyId {
  switch (reason) {
    case 'blank':
      return 'm09.error.blank';
    case 'too-long':
      return 'm09.error.too_long';
    case 'characters':
      return 'm09.error.characters';
    case 'reserved':
      return 'm09.error.reserved';
    case 'blocked':
      return 'm09.error.blocked';
    default:
      return assertNever(reason);
  }
}
