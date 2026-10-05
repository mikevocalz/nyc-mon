'use client';

import { useRouter, useSearchParams } from 'solito/navigation';
import type { SignInIntent, SignInLegalLink } from './sign-in-nav';

/**
 * Web: `/sign-in?intent=…` and the site's routes for the same destinations.
 * solito's useSearchParams reads the query identically on server and client.
 */
export function useSignInNav(): {
  intent: SignInIntent;
  ageGatePath: string;
  homePath: string;
  signInPath: string;
  legalLinks: SignInLegalLink[];
  openLink: (href: string) => void;
  replace: (path: string) => void;
} {
  const router = useRouter();
  const raw = useSearchParams()?.get('intent');
  const intent: SignInIntent = raw === 'sign_in' || raw === 'sign-in' ? 'sign_in' : 'create';
  return {
    intent,
    // There is no web age gate; account creation starts at the waitlist page.
    ageGatePath: '/get',
    homePath: '/profile',
    signInPath: '/sign-in?intent=sign_in',
    legalLinks: [
      { id: 'terms', href: '/legal/terms' },
      { id: 'privacy', href: '/legal/privacy' },
      { id: 'children', href: '/legal/childrens-privacy' },
    ],
    openLink: router.push,
    replace: router.replace,
  };
}
