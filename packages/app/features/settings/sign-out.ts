'use client';

import { auth } from '../onboarding/auth';

/**
 * Ends the auth session on this device (Better Auth `signOut`). The local
 * save is untouched. Resolves false when the server could not be reached or
 * refused; the caller shows the error and stays put.
 */
export async function signOutHere(): Promise<boolean> {
  try {
    return (await auth().signOut()).ok;
  } catch {
    return false;
  }
}

/** Where the app goes after signing out: M03, signing in (the same href boot uses). */
export const SIGNED_OUT_PATH = '/(auth)/sign-in?intent=sign-in';
