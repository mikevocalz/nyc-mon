// Form rules and per-client copy for the linking pages (LinkPages.tsx). Kept
// free of React so the checks run in unit tests and match what the server
// enforces: Better Auth's 10-character password minimum (auth/options.ts) and
// the 18+ linking rule (adult.ts).
import { linkRefusal } from './adult';

/** Which kind of app is asking to link. Decides where the Caller unlinks. */
export type LinkClientKind = 'alexa' | 'companion';

/** Better Auth's `minPasswordLength` (auth/options.ts). */
export const MIN_PASSWORD_LENGTH = 10;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function hasFieldErrors(errors: FieldErrors<string>): boolean {
  return Object.values(errors).some((message) => message !== undefined);
}

function emailError(email: string): string | undefined {
  const value = email.trim();
  if (value === '') return 'Enter your email';
  if (!/^[^\s@]+@[^\s@]+$/.test(value)) return 'Enter an email address like name@example.com';
  return undefined;
}

function compact<K extends string>(errors: Record<K, string | undefined>): FieldErrors<K> {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== undefined)) as FieldErrors<K>;
}

/** Sign-in: name the empty field rather than sending a request the server can only call a mismatch. */
export function signInErrors(input: { email: string; password: string }): FieldErrors<'email' | 'password'> {
  return compact({
    email: emailError(input.email),
    password: input.password === '' ? 'Enter your password' : undefined,
  });
}

/**
 * Sign-up on the linking page. Linking is adults only, so a birth year that
 * could belong to someone under 18 is stopped here, before an account exists
 * that could never link.
 */
export function signUpErrors(
  input: { email: string; password: string; birthYear: string },
  nowMs: number,
): FieldErrors<'email' | 'password' | 'birthYear'> {
  const currentYear = new Date(nowMs).getUTCFullYear();
  const raw = input.birthYear.trim();
  let birthYear: string | undefined;
  if (raw === '') birthYear = 'Enter the year you were born';
  else if (!/^\d{4}$/.test(raw) || Number(raw) < 1900 || Number(raw) > currentYear) birthYear = 'Enter a four-digit year, like 1990';
  else if (linkRefusal({ birthYear: Number(raw), consentStatus: 'not-required' }, nowMs) !== undefined) birthYear = 'Linking is for adults 18 and over.';
  return compact({
    email: emailError(input.email),
    password:
      input.password === '' ? 'Enter a password' : input.password.length < MIN_PASSWORD_LENGTH ? `Use at least ${MIN_PASSWORD_LENGTH} characters` : undefined,
    birthYear,
  });
}

/** A failed email sign-in. Offers a reset only when this server can send one. */
export function credentialsError(passwordResetEnabled: boolean): string {
  return passwordResetEnabled
    ? "That email and password don't match. Check both, or reset your password."
    : "That email and password don't match. Check both and try again.";
}

/** Better Auth needs a name at sign-up; the part before the @ is a starting point the Caller can change in the app. */
export function nameFromEmail(email: string): string {
  const local = email.trim().split('@')[0] ?? '';
  return local === '' ? 'Caller' : local;
}

/** Copy that depends on which app is linking. */
export function linkCopyFor(kind: LinkClientKind) {
  return kind === 'companion'
    ? {
        unlinkNote: 'You can unlink any time by signing out of the companion.',
        startAgain: 'Start again from the companion.',
      }
    : {
        unlinkNote: 'You can unlink any time in the Alexa app.',
        startAgain: 'Start again from the Alexa app.',
      };
}
