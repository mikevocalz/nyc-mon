// M20 Account, the pure half: provider labels, which change forms apply, and
// which copy line a failure shows. Pure, so node tests pin it.
import type { AuthResult, LinkedAccount } from '@acme/auth';

export type AccountCopyId =
  | 'settings.account.provider.credential'
  | 'settings.account.provider.apple'
  | 'settings.account.provider.google'
  | 'settings.account.provider.amazon'
  | 'settings.account.provider.other';

/** The copy id for one linked method. Unknown providers read as "Other". */
export function providerCopyId(providerId: string): AccountCopyId {
  switch (providerId) {
    case 'credential':
      return 'settings.account.provider.credential';
    case 'apple':
      return 'settings.account.provider.apple';
    case 'google':
      return 'settings.account.provider.google';
    case 'amazon':
      return 'settings.account.provider.amazon';
    default:
      return 'settings.account.provider.other';
  }
}

/** A password exists only on an email-and-password (`credential`) account. */
export function hasPassword(accounts: readonly LinkedAccount[]): boolean {
  return accounts.some((a) => a.providerId === 'credential');
}

/** Same check the sign-in form uses: something@something.tld, no spaces. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** The server's floor (emailAndPassword.minPasswordLength). */
export const MIN_PASSWORD_LENGTH = 10;

export type AccountErrorId =
  | 'settings.account.error.offline'
  | 'settings.account.error.reauth'
  | 'settings.account.error.password_wrong'
  | 'settings.account.error.email_taken'
  | 'settings.account.error.generic';

/** The error line for a failed change. */
export function accountErrorId(result: Extract<AuthResult, { ok: false }>): AccountErrorId {
  const { code, status } = result.error;
  if (status === 0) return 'settings.account.error.offline';
  if (code === 'INVALID_PASSWORD') return 'settings.account.error.password_wrong';
  if (code === 'USER_ALREADY_EXISTS' || code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') return 'settings.account.error.email_taken';
  if (code === 'SESSION_EXPIRED' || code === 'UNAUTHORIZED' || status === 401) return 'settings.account.error.reauth';
  return 'settings.account.error.generic';
}
