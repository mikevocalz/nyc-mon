import { AuthError } from './AuthError.ts';
import type { AuthResult } from './AuthResult.ts';

/** The error half of every Better Auth client response. */
interface ClientError {
  code?: string | undefined;
  message?: string | undefined;
  status: number;
  statusText: string;
}

/** Folds a Better Auth `{ data, error }` response into an {@link AuthResult}. */
export function toAuthResult(response: { error: ClientError | null }): AuthResult {
  const { error } = response;
  if (error === null) return { ok: true };
  return {
    ok: false,
    error: new AuthError(error.code ?? 'UNKNOWN', error.message ?? error.statusText, error.status),
  };
}
