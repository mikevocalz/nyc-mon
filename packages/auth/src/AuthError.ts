/**
 * A failed auth call. `code` is Better Auth's error code when it sent one
 * (for example `EMAIL_NOT_VERIFIED`, `GUARDIAN_CONSENT_REQUIRED`), otherwise
 * `UNKNOWN`. Returned inside {@link AuthResult}, never thrown.
 */
export class AuthError extends Error {
  readonly code: string;
  /** HTTP status of the failed request, or 0 when no response arrived. */
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}
