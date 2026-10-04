/**
 * Email + password sign-up. `birthYear` comes from the §1.5 gate shown before
 * sign-up; the server refuses years that could be under 13 with
 * `GUARDIAN_CONSENT_REQUIRED`.
 */
export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
  birthYear: number;
  /** Absolute URL the verification link returns to, once verification is on. */
  callbackURL?: string;
}
