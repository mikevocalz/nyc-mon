'use client';

import { auth } from '../onboarding/auth';
import { setSyncTransport } from '../system/sync.store';
import { stopMonVoice } from '../voice/use-mon-voice';

/**
 * Ends the auth session on this device (Better Auth `signOut`). The local
 * save is untouched. Resolves false when the server could not be reached or
 * refused; the caller shows the error and stays put.
 */
export async function signOutHere(): Promise<boolean> {
  // The Mon stops mid-line: the next request would be unauthenticated anyway.
  stopMonVoice();
  try {
    const ok = (await auth().signOut()).ok;
    // Queued care stays in the save; it syncs after the next sign-in.
    if (ok) setSyncTransport(null);
    return ok;
  } catch {
    return false;
  }
}

/** Where the app goes after signing out: M03, signing in (the same href boot uses). */
export const SIGNED_OUT_PATH = '/(auth)/sign-in?intent=sign-in';
