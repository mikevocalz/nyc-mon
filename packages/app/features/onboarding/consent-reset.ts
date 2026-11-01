import { loadSave } from '@acme/core/save';
import type { KeyValueStorage } from './storage.types';

/** The keys {@linkcode resetAfterConsentDenied} clears. Same strings as `ONBOARDING_KEYS` / `SAVE_KEY`. */
export const CONSENT_RESET_KEYS = {
  ageAnswer: 'age-answer',
  consentRequested: 'consent-requested',
  hasSession: 'has-session',
  save: 'save',
} as const;

/** What {@linkcode resetAfterConsentDenied} removed, for the store and the tests. */
export interface ConsentResetResult {
  /** The local save held a Caller whose guardian said no, and it is gone. */
  readonly removedDeniedSave: boolean;
}

function savedCallerIsDenied(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  try {
    return loadSave(raw).caller?.consentStatus === 'denied';
  } catch {
    // An unreadable save is M22's to recover, never this screen's to delete.
    return false;
  }
}

/**
 * M05 denied → Close. The rule:
 *
 * The denied screen tells the child "We've deleted everything this app saved
 * about you … you can start fresh". Close makes that true on this device and
 * leaves it as a fresh install would: the M04 age answer, the consent-sent
 * marker, and a save whose Caller is `denied` (with the local session flag
 * that belongs to that account) are removed. Boot then resolves `first-run`
 * and lands on Welcome, not on the denied screen again.
 *
 * A save whose Caller is NOT denied (the `?state=denied` param arrived
 * without one) is left alone, so a stray link cannot wipe a real player. The
 * server-side account and its session are the consent service's to delete;
 * nothing here calls the network.
 */
export function resetAfterConsentDenied(onboarding: KeyValueStorage, save: KeyValueStorage): ConsentResetResult {
  onboarding.remove(CONSENT_RESET_KEYS.ageAnswer);
  onboarding.remove(CONSENT_RESET_KEYS.consentRequested);
  const removedDeniedSave = savedCallerIsDenied(save.getString(CONSENT_RESET_KEYS.save));
  if (removedDeniedSave) {
    save.remove(CONSENT_RESET_KEYS.save);
    onboarding.remove(CONSENT_RESET_KEYS.hasSession);
  }
  return { removedDeniedSave };
}
