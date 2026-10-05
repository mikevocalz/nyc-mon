'use client';

import { useRouter, useSearchParams } from 'solito/navigation';
import type { SignInIntent } from './sign-in-nav';

/**
 * Web: `/sign-in?intent=…` and the site's routes for the same destinations.
 * solito's useSearchParams reads the query identically on server and client.
 */
export function useSignInNav(): {
  intent: SignInIntent;
  ageGatePath: string;
  homePath: string;
  replace: (path: string) => void;
} {
  const router = useRouter();
  const intent: SignInIntent =
    useSearchParams()?.get('intent') === 'sign_in' ? 'sign_in' : 'create';
  return {
    intent,
    // There is no web age gate; account creation starts at the waitlist page.
    ageGatePath: '/get',
    homePath: '/profile',
    replace: router.replace,
  };
}
