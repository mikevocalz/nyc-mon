'use client';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { APP_HOME_PATH } from './boot';

export type SignInIntent = 'create' | 'sign_in';

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
  replace: (path: string) => void;
} {
  const router = useRouter();
  const params = useLocalSearchParams<{ intent?: string }>();
  return {
    intent: params.intent === 'sign_in' ? 'sign_in' : 'create',
    ageGatePath: '/(auth)/age',
    homePath: APP_HOME_PATH,
    replace: (path) => router.replace(path as never),
  };
}
