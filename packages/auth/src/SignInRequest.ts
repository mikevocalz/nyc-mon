/** Social providers enabled on the server (ADR 0001). */
export type SocialProvider = 'amazon' | 'apple' | 'google';

/** Providers whose ID token the server verifies directly (native sheets). */
export type IdTokenProvider = 'apple' | 'google';

/**
 * One sign-in attempt, by method. Passed to `signIn` on the object returned by
 * {@link createAuth}.
 *
 * `birthYear` is the M04 answer. Apple and Google identities carry no age, so
 * the server creates a new account from them only when it is present; a
 * returning Caller signs in without it. A missing answer for a new account
 * comes back as `BIRTH_YEAR_REQUIRED`.
 */
export type SignInRequest =
  | { method: 'email'; email: string; password: string }
  | { method: 'passkey' }
  | {
      method: 'social';
      provider: SocialProvider;
      /** Absolute URL to land on after the provider redirects back. */
      callbackURL: string;
      /** Absolute URL the server redirects to with `?error=<code>` on failure. */
      errorCallbackURL?: string;
      birthYear?: number;
    }
  | {
      /** Native: a token from the system sheet, verified by the server (no redirect). */
      method: 'id-token';
      provider: IdTokenProvider;
      token: string;
      /** The raw nonce the token was requested with. */
      nonce?: string;
      accessToken?: string;
      /** Apple sends the name only on the first authorization. */
      name?: { firstName?: string; lastName?: string };
      birthYear?: number;
    };
