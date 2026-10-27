'use client';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { APP_HOME_PATH } from './boot';

export type SignInIntent = 'create' | 'sign_in';

export interface SignInLegalLink {
  id: 'terms' | 'privacy' | 'children';
  href: string;
}

/**
 * What M03 needs from the router, resolved per platform. In the app the
 * intent is an expo-router param and the destinations are expo hrefs.
 */
export function useSignInNav(): {
  intent: SignInIntent;
  /** The birth-year gate — create intent without an age answer goes here. */
  ageGatePath: string;
  /** The app's home after a successful sign-in. */
  homePath: string;
  /** The sign-in intent href — the create intent's "Already a Caller?" switch. */
  signInPath: string;
  /** Terms/privacy destinations, opened on the product site. */
  legalLinks: SignInLegalLink[];
  /** Opens a legal href in the app's own /legal/* screens (the site's on web). */
  openLink: (href: string) => void;
  replace: (path: string) => void;
  /** The ‹ in the stack header (M03 direction): back to the previous route. */
  back: () => void;
  /** Draw the ‹ inside the screen. False in the app: the native stack header carries it. */
  inlineBack: boolean;
} {
  const router = useRouter();
  const params = useLocalSearchParams<{ intent?: string }>();
  // Both spellings land here: boot.ts uses `sign-in`, the web hook `sign_in`.
  const intent: SignInIntent =
    params.intent === 'sign_in' || params.intent === 'sign-in' ? 'sign_in' : 'create';
  return {
    intent,
    ageGatePath: '/(auth)/age',
    homePath: APP_HOME_PATH,
    signInPath: '/(auth)/sign-in?intent=sign-in',
    legalLinks: [
      { id: 'terms', href: '/legal/terms' },
      { id: 'privacy', href: '/legal/privacy' },
      { id: 'children', href: '/legal/childrens-privacy' },
    ],
    openLink: (href) => router.push(href as never),
    replace: (path) => router.replace(path as never),
    // Sign-in is often reached by replace (from the age gate), so there may be no history.
    back: () => (router.canGoBack() ? router.back() : router.replace('/(onboarding)/welcome' as never)),
    inlineBack: false,
  };
}
