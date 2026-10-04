// Sign-in usernames (ADR 0004 §1). A username is a handle for signing in on
// the family device and for support. It is never shown to a Mon or to another
// Caller, and it is separate from the Caller name the Mon uses (M07).

export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 20;

// No `@`, so an email address can never be a username.
const USERNAME_SHAPE = /^[a-z0-9_.]+$/;
const DIGITS = /\d/g;
/** Seven or more digits reads as a phone number, which would make the handle contact info (COPPA). */
const MAX_DIGITS = 6;

/**
 * True when `username` (already normalised to lower case by the plugin) is a
 * valid handle: 3–20 of `a-z 0-9 _ .`, at most six digits, and
 * no leading, trailing or doubled dot.
 *
 * The word block list M07 uses (`CallerNameFilter` in @acme/core) has no
 * shipped implementation yet; when it does, it plugs in here.
 */
export function isValidUsername(username: string): boolean {
  if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) return false;
  if (!USERNAME_SHAPE.test(username)) return false;
  if ((username.match(DIGITS) ?? []).length > MAX_DIGITS) return false;
  if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) return false;
  return true;
}
