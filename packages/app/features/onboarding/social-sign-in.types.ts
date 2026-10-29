import type { AuthError } from '@acme/auth';

/** The two social providers M03 offers. */
export type SocialSignInProvider = 'apple' | 'google';

/**
 * How a social attempt ended. `redirecting` is web only: the page is leaving
 * for the provider and the screen finishes on return. `cancelled` shows
 * nothing (M03: the Caller closed the sheet). `failed` without an error is a
 * provider-side failure; with one, the server answered.
 */
export type SocialSignInOutcome =
  | { kind: 'signed_in' }
  | { kind: 'redirecting' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error?: AuthError };

export interface SocialSignInOptions {
  /** The stored M04 answer, when there is one. Required by the server for a new account. */
  birthYear: number | undefined;
  /** Web: absolute URLs the provider round trip returns to. Ignored on native. */
  returnURL: string;
  errorURL: string;
}
