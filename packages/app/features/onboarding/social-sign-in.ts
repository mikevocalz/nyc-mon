'use client';

import { auth } from './auth';
import type { SocialSignInOptions, SocialSignInOutcome, SocialSignInProvider } from './social-sign-in.types';

export type { SocialSignInOptions, SocialSignInOutcome, SocialSignInProvider } from './social-sign-in.types';

/** Web offers both providers through Better Auth's redirect flow. */
export function isSocialProviderSupported(_provider: SocialSignInProvider): boolean {
  return true;
}

/**
 * Web: Better Auth sends the browser to Apple or Google and back to
 * `returnURL` (or `errorURL` with `?error=<code>`). The client follows the
 * redirect itself, so a resolved `ok` means the page is leaving.
 */
export async function startSocialSignIn(
  provider: SocialSignInProvider,
  { birthYear, returnURL, errorURL }: SocialSignInOptions,
): Promise<SocialSignInOutcome> {
  const result = await auth().signIn({
    method: 'social',
    provider,
    callbackURL: returnURL,
    errorCallbackURL: errorURL,
    ...(birthYear === undefined ? {} : { birthYear }),
  });
  return result.ok ? { kind: 'redirecting' } : { kind: 'failed', error: result.error };
}
