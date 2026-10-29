import type { AuthError } from './AuthError.ts';

/**
 * One sign-in method linked to the Caller (Better Auth `/list-accounts`).
 * `providerId` is `credential` for email and password, otherwise the social
 * provider's id (`apple`, `google`, `amazon`). Passkeys live in their own
 * table and are not listed here.
 */
export interface LinkedAccount {
  readonly id: string;
  readonly providerId: string;
  readonly createdAt: string | undefined;
}

/** {@link AuthResult} with a value on success. */
export type AuthDataResult<T> = { ok: true; data: T } | { ok: false; error: AuthError };
