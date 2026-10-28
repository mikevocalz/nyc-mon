'use client';

import { useRouter, useSearchParams } from 'solito/navigation';
import type { SignInIntent, SignInLegalLink, SocialReturn } from './sign-in-nav';

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
  back: () => void;
  inlineBack: boolean;
  socialReturn: SocialReturn | undefined;
  socialURLs: (provider: 'apple' | 'google') => { returnURL: string; errorURL: string };
} {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params?.get('intent');
  const intent: SignInIntent = raw === 'sign_in' || raw === 'sign-in' ? 'sign_in' : 'create';
  // Better Auth sends the browser back here: `?social=<provider>` on success,
  // plus `error=<code>` (appended by the server) on failure.
  const social = params?.get('social');
  const socialReturn: SocialReturn | undefined =
    social === 'apple' || social === 'google'
      ? { provider: social, error: params?.get('error') ?? undefined }
      : undefined;
  const intentParam = intent === 'sign_in' ? 'sign_in' : 'create';
  const socialURLs = (provider: 'apple' | 'google') => {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const url = `${origin}/sign-in?intent=${intentParam}&social=${provider}`;
    return { returnURL: url, errorURL: url };
  };
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
    back: router.back,
    inlineBack: true,
    socialReturn,
    socialURLs,
  };
}
