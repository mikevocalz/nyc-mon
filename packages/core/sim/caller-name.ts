import { assertNever } from './assert-never.ts';
import { canonicaliseName, nameShapeRejection } from './name-rules.ts';

// M07 Caller name rules: docs/design/screens/M07/05-copy.md § Name rules and
// 08-handoff.md § Data. Digits stay out until COPY_DECK open question 2 is ruled.

/**
 * Longest Caller name, in UTF-16 code units after trimming and NFC
 * normalisation. The same unit as the M07 field's `maxLength` and zod's
 * `.max()`, so the field, {@linkcode validateCallerName} and the stored
 * `CallerProfile.callerName` agree.
 */
export const CALLER_NAME_MAX_LENGTH = 16;

/** Why {@linkcode validateCallerName} rejected a name. Map it to copy with {@linkcode callerNameErrorCopyId}. */
export type CallerNameRejection = 'blank' | 'too-long' | 'characters' | 'blocked';

/** Result of {@linkcode validateCallerName}. `name` is the trimmed, NFC-normalised value to store. */
export type CallerNameResult =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly reason: CallerNameRejection };

/**
 * The platform-owned block list, loaded locally (no network per keystroke).
 * Passed to {@linkcode validateCallerName}.
 */
export interface CallerNameFilter {
  /** True when the trimmed, NFC-normalised `name` is on the block list. */
  isBlocked(name: string): boolean;
}

/** COPY_DECK ids for each {@linkcode CallerNameRejection}. */
export type CallerNameErrorCopyId =
  | 'm07.error.blank'
  | 'm07.error.too_long'
  | 'm07.error.characters'
  | 'm07.error.blocked';

const canonicalise = canonicaliseName;
const shapeRejection = (name: string) => nameShapeRejection(name, CALLER_NAME_MAX_LENGTH);

/**
 * Checks a typed Caller name (M07). The first failing rule wins, in this order:
 *
 * 1. `blank`: no letter after trimming (empty, spaces, punctuation only, digits only).
 * 2. `too-long`: more than {@linkcode CALLER_NAME_MAX_LENGTH} after trimming.
 * 3. `characters`: anything but letters, marks, space, `-`, `'`, `’`, `.` (digits, emoji, symbols).
 * 4. `blocked`: `filter.isBlocked` returned true. Only consulted for names that passed 1–3.
 *
 * @param raw - the field's text, as typed or pasted.
 * @param filter - the block list. Required, so a build cannot ship without one wired (M07 B4).
 * @example
 * ```ts
 * const result = validateCallerName(text, blockList);
 * if (result.ok) saveCallerName(result.name);
 * else showError(callerNameErrorCopyId(result.reason));
 * ```
 */
export function validateCallerName(raw: string, filter: CallerNameFilter): CallerNameResult {
  const name = canonicalise(raw);
  const rejection = shapeRejection(name);
  if (rejection !== undefined) return { ok: false, reason: rejection };
  if (filter.isBlocked(name)) return { ok: false, reason: 'blocked' };
  return { ok: true, name };
}

/**
 * True when `value` is a stored-form Caller name: already trimmed and NFC, and
 * passing every {@linkcode validateCallerName} rule except the block list.
 * `CallerProfileSchema.callerName` refines with this, so the save rejects
 * what the UI rejects.
 */
export function isStoredCallerName(value: string): boolean {
  return value === canonicalise(value) && shapeRejection(value) === undefined;
}

/** The COPY_DECK id for a {@linkcode CallerNameRejection}, for the M07 `ErrorMessage`. */
export function callerNameErrorCopyId(reason: CallerNameRejection): CallerNameErrorCopyId {
  switch (reason) {
    case 'blank':
      return 'm07.error.blank';
    case 'too-long':
      return 'm07.error.too_long';
    case 'characters':
      return 'm07.error.characters';
    case 'blocked':
      return 'm07.error.blocked';
    default:
      return assertNever(reason);
  }
}
