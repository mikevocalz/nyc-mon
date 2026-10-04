/** Social providers enabled on the server (ADR 0001). */
export type SocialProvider = 'apple' | 'google';

/**
 * One sign-in attempt, by method. Passed to `signIn` on the object returned by
 * {@link createAuth}.
 */
export type SignInRequest =
  | { method: 'email'; email: string; password: string }
  | { method: 'passkey' }
  | {
      method: 'social';
      provider: SocialProvider;
      /** Absolute URL to land on after the provider redirects back. */
      callbackURL: string;
    };
