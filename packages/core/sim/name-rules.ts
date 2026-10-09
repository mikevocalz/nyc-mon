// Shared shape rules for the two names a player types: the Caller name (M07)
// and the Mon's nickname (M09). One character rule and one length unit, so
// both fields, both validators and both schemas agree.

/** Letters and combining marks in any script, plus space, hyphen, apostrophe (straight or curly) and period. */
const ALLOWED_CHARACTERS = /^[\p{L}\p{M} \-'’.]*$/u;
const HAS_LETTER = /\p{L}/u;

/** Shape failures shared by every typed name, in the order they are checked. */
export type NameShapeRejection = 'blank' | 'too-long' | 'characters';

/** NFC-normalises and trims, which is the stored form of every typed name. */
export function canonicaliseName(raw: string): string {
  return raw.normalize('NFC').trim();
}

/**
 * The first shape rule `name` fails, or `undefined`. `name` must already be
 * canonical. Length is in UTF-16 code units, the unit of zod's `.max()` and
 * a text field's `maxLength`.
 */
export function nameShapeRejection(name: string, maxLength: number): NameShapeRejection | undefined {
  if (!HAS_LETTER.test(name)) return 'blank';
  if (name.length > maxLength) return 'too-long';
  if (!ALLOWED_CHARACTERS.test(name)) return 'characters';
  return undefined;
}
