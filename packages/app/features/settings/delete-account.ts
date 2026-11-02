'use client';

import { AuthError, type AuthResult } from '@acme/auth';
import { useInstanceStore, useStore } from '@acme/ui';
import { useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { auth } from '../onboarding/auth';
import { copy } from '../onboarding/copy';
import { hydrateOnboarding, ONBOARDING_KEYS, SAVE_KEY, useOnboarding } from '../onboarding/onboarding.store';
import { onboardingStorage, saveStorage } from '../onboarding/storage';
import { useProfile } from '../profile/profile.store';
import { worldSaveStore } from '../game/world-resume/world-save.store';
import { clearLocalAccount, deleteAccountErrorId, type DeleteAccountErrorId } from './delete-account-model.ts';

/**
 * Deletes the signed-in Caller's account on the server, then this device's
 * copy: the save, the world save, the onboarding and session flags, and the in-memory
 * stores that mirror them. The local copy is cleared only after the server
 * says the account is gone, so a failure leaves the Caller exactly where
 * they were. Never throws.
 */
export async function deleteAccountHere(): Promise<AuthResult> {
  let result: AuthResult;
  try {
    result = await auth().deleteAccount();
  } catch {
    // The client resolves on HTTP errors; a throw here means no response.
    return { ok: false, error: new AuthError('NETWORK', 'No response', 0) };
  }
  if (!result.ok) return result;
  clearLocalAccount(onboardingStorage, saveStorage, { onboarding: Object.values(ONBOARDING_KEYS), save: SAVE_KEY });
  hydrateOnboarding();
  useMonStore.getState().hydrate();
  useProfile.getState().setName('');
  // The city save belongs to the deleted Caller too: no "Continue" on a world nobody owns.
  worldSaveStore.getState().clear();
  return result;
}

/**
 * True when this device has an account to delete: the local session flag
 * (set on email and passkey sign-in) or a live Better Auth session (social
 * sign-in returns through a redirect that may not set the flag). A player
 * who never made an account gets no Delete row.
 */
export function useHasAccount(): boolean {
  const flagged = useOnboarding((s) => s.hasSession);
  const session = auth().useSession();
  return flagged || session.data != null;
}

interface DeleteFlowState {
  /** The confirm step is showing. */
  confirming: boolean;
  deleting: boolean;
  /** The last failure's copy id; the confirm button then reads "Try again". */
  errorId: DeleteAccountErrorId | undefined;
}

/**
 * One deletion flow for both Settings surfaces (the 2D Session card and the
 * glass). `ask` opens the confirm step, `cancel` closes it, `confirm` deletes
 * and calls `onDeleted` (the surface routes to Welcome with its own router).
 */
export function useDeleteAccountFlow(onDeleted: () => void) {
  const store = useInstanceStore<DeleteFlowState>(() => ({ confirming: false, deleting: false, errorId: undefined }));
  const state = useStore(store);
  return {
    ...state,
    ask: () => store.setState({ confirming: true, errorId: undefined }),
    cancel: () => {
      if (store.getState().deleting) return;
      store.setState({ confirming: false, errorId: undefined });
    },
    confirm: async () => {
      if (store.getState().deleting) return;
      store.setState({ deleting: true, errorId: undefined });
      const result = await deleteAccountHere();
      if (result.ok) {
        store.setState({ deleting: false, confirming: false });
        announcePolitely(copy('settings.delete.done.a11y'));
        onDeleted();
        return;
      }
      const errorId = deleteAccountErrorId(result);
      store.setState({ deleting: false, errorId });
      announcePolitely(copy(errorId));
    },
  };
}
