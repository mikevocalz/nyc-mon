// Delete account (M20, App Store 5.1.1(v)): the pure half. Which error
// line a failure shows, and which local keys go once the server has deleted
// the account. Pure, so node tests pin it; delete-account.ts binds it to the
// real client and storage.
import type { AuthResult } from '@acme/auth';
import type { KeyValueStorage } from '../onboarding/storage.types.ts';

/** Where the app goes once the account is gone: M02, the first-run Welcome. */
export const DELETED_PATH = '/(onboarding)/welcome';

/** The save store's minted device id (save-store.ts `DEVICE_ID_KEY`). */
const DEVICE_ID_KEY = 'device-id';

export type DeleteAccountErrorId =
  | 'settings.delete.error.offline'
  | 'settings.delete.error.reauth'
  | 'settings.delete.error.generic';

/**
 * The error line for a failed deletion. No response: offline. A session past
 * Better Auth's fresh age (`SESSION_EXPIRED`) or no session at all: sign in
 * again. Anything else: try again later.
 */
export function deleteAccountErrorId(result: Extract<AuthResult, { ok: false }>): DeleteAccountErrorId {
  const { code, status } = result.error;
  if (status === 0) return 'settings.delete.error.offline';
  if (code === 'SESSION_EXPIRED' || code === 'UNAUTHORIZED' || status === 401) return 'settings.delete.error.reauth';
  return 'settings.delete.error.generic';
}

/** The local keys an account leaves behind (onboarding.store.ts `ONBOARDING_KEYS` and `SAVE_KEY`). */
export interface LocalAccountKeys {
  /** Every onboarding flag: age answer, session, consent, notifications, permission review, nickname prompts. */
  readonly onboarding: readonly string[];
  /** The sim save's key in the save storage. */
  readonly save: string;
}

/**
 * Removes everything this device kept for the deleted account: the sim save
 * and its device id, and every onboarding flag. Boot then reads a first run.
 * Run only after the server confirms the deletion. The keys come in from
 * delete-account.ts so this file stays free of the store module.
 */
export function clearLocalAccount(onboarding: KeyValueStorage, save: KeyValueStorage, keys: LocalAccountKeys): void {
  save.remove(keys.save);
  save.remove(DEVICE_ID_KEY);
  for (const key of keys.onboarding) onboarding.remove(key);
}
